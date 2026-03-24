# Separar este ficheiro em 2, um para a configuração do FIWARE e outro para o servidor Flask que corre a simulação. O setup do FIWARE só precisa de ser feito uma vez, enquanto o servidor Flask tem de estar sempre a correr para receber as notificações do FIWARE.
import os
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import subprocess
import threading
import requests
from dotenv import load_dotenv
from pathlib import Path

app = Flask(__name__)
CORS(app)

root_path = Path(__file__).resolve().parent.parent
env_path = root_path / '.env'
load_dotenv(dotenv_path=env_path)

fiware_base = os.getenv('FIWARE_URL', 'http://localhost:1026')
FIWARE_URL = f"{fiware_base}/ngsi-ld/v1"
CONTEXT_URL = os.getenv('TRAFFIC_CONTEXT_URL')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'output')

def setup_fiware():
    """
    Auto-configures FIWARE on startup. Creates the entity and subscription if they don't exist.
    """
    headers = {'Content-Type': 'application/ld+json'}
    
    # 1. Create Entity (The Switch)
    entity_payload = {
        "id": "urn:ngsi-ld:TrafficSimulationControl:001",
        "type": "TrafficSimulationControl",
        "status": {
            "type": "Property",
            "value": "STOPPED" # Default state. Next.js will update this to "STARTED" to trigger the simulation.
        },
        "mapURL": {
            "type": "Property",
            "value": "" # This will be updated with the output URL once the simulation finishes.
        },
        "@context": [CONTEXT_URL]
    }
    
    try:
        response = requests.post(f"{FIWARE_URL}/entities", json=entity_payload, headers=headers)
        if response.status_code == 201:
            print("Entity 'TrafficSimulationControl:001' successfully created!")
        elif response.status_code == 409: # 409 means Conflict (it already exists)
            print("Entity already exists. Skipping creation.")
        else:
            print(f"Failed to create entity: {response.text}")
            
        sub_payload = {
            "description": "Trigger MATSim from Next.js",
            "type": "Subscription",
            "entities": [{"type": "TrafficSimulationControl"}],
            "watchedAttributes": ["status"],
            "q": "status==%22STARTED%22",
            "notification": {
                "endpoint": {
                    "uri": "http://host.docker.internal:8000/run-matsim",
                    "accept": "application/json"
                }
            },
            "@context": [CONTEXT_URL]
        }
        
        r_sub = requests.post(f"{FIWARE_URL}/subscriptions", json=sub_payload, headers=headers)
        if r_sub.status_code == 201:
            print("Subscription created successfully!")
        else:
            print("Subscription check completed. It may already be set up.")
            print(f"Sub check: {r_sub.status_code} - {r_sub.text}")
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to FIWARE.")


def run_matsim():
    print("\n Starting MATSim simulation...") # If changes made in MatSim code, make sure to rebuild the JAR file with 'mvn clean package' before running the simulation.
    command = [
        "java", "-Xmx8G", "-jar", 
        "matsim-example-project/matsim-example-project-0.0.1-SNAPSHOT.jar", 
        "input/config.xml"
    ]
    try:
        subprocess.run(command, check=True)
        print("Simulation finished successfully!")

        patch_payload = {
            "status": {"type": "Property", "value": "FINISHED"},
            "mapURL": {"type": "Property", "value": os.getenv('OUTPUT_URL')},
            "@context": [CONTEXT_URL]
        }
        requests.patch(f"{FIWARE_URL}/entities/urn:ngsi-ld:TrafficSimulationControl:001/attrs", 
                      json=patch_payload, 
                      headers={'Content-Type': 'application/ld+json'})
        print("Finnished status updated in FIWARE.")
    except subprocess.CalledProcessError as e:
        print(f"Simulation failed: {e}")

@app.route('/run-matsim', methods=['POST'])
def fiware_webhook():
    print("\n Notification received from FIWARE!")
    thread = threading.Thread(target=run_matsim)
    thread.start()
    return jsonify({"status": "Simulation triggered successfully"}), 200

@app.route('/')
def list_output_folder():
    print("\n Request received to list output folder contents ye.")
    try:
        files = os.listdir(OUTPUT_DIR)
        
        links = []
        for f in files:
            if os.path.isdir(os.path.join(OUTPUT_DIR, f)):
                links.append(f'<li><a href="{f}/">{f}/</a></li>')
            else:
                links.append(f'<li><a href="{f}">{f}</a></li>')
                
        html_links = "\n".join(links)
        
        html_page = f"""<!DOCTYPE html>
            <html>
                <head>
                    <title>Directory listing for /</title>
                </head>
                <body>
                    <h2>Directory listing for /</h2>
                    <hr>
                    <ul>
                        {html_links}
                    </ul>
                    <hr>
                </body>
            </html>"""

        response = make_response(html_page)
        
        return response
    except FileNotFoundError:
        return "Output folder not found.", 404

@app.route('/<path:filename>', methods=['GET', 'OPTIONS'])
def serve_output_files(filename):
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Accept-Ranges, Range, Origin, Accept, Content-Type, *'
        return response

    full_path = os.path.abspath(os.path.join(OUTPUT_DIR, filename))
    
    if not full_path.startswith(os.path.abspath(OUTPUT_DIR)):
        return "Access Denied", 403

    if os.path.isdir(full_path):
        files = os.listdir(full_path)
        links = []
        for f in files:
            s = "/" if os.path.isdir(os.path.join(full_path, f)) else ""
            links.append(f'<li><a href="{f}{s}">{f}{s}</a></li>')
            
        response = make_response(f"<html><body><ul>{''.join(links)}</ul></body></html>")
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response

    if os.path.isfile(full_path):
        content_type, _ = mimetypes.guess_type(full_path)
        
        if filename.endswith('.csv'):
            content_type = 'text/csv'
        elif filename.endswith('.json'):
            content_type = 'application/json'
        elif not content_type:
            content_type = 'application/octet-stream'

        response = make_response(send_from_directory(OUTPUT_DIR, filename))
        response.headers['Content-Type'] = content_type
        
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Accept-Ranges, Range, Origin, Accept, Content-Type, *'
        response.headers['Access-Control-Expose-Headers'] = 'Accept-Ranges, Content-Length, Content-Range'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        
        if 'Content-Encoding' in response.headers:
            del response.headers['Content-Encoding']
            
        return response

    return "Not Found", 404

if __name__ == '__main__':
    setup_fiware()
    print("Listening for FIWARE notifications on port 8000...")
    app.run(host='0.0.0.0', port=8000)