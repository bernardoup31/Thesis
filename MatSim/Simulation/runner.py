import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import threading
import requests
from dotenv import load_dotenv
from pathlib import Path

app = Flask(__name__, static_folder='output', static_url_path='/output')
CORS(app)

root_path = Path(__file__).resolve().parent.parent
env_path = root_path / '.env'
load_dotenv(dotenv_path=env_path)

fiware_base = os.getenv('FIWARE_URL', 'http://localhost:1026')
FIWARE_URL = f"{fiware_base}/ngsi-ld/v1"
CONTEXT_URL = os.getenv('TRAFFIC_CONTEXT_URL')

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
            "value": "STOPPED" # Default state. Next.js will update this to "START" to trigger the simulation.
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
            "q": "status==%22START%22",
            "notification": {
                "endpoint": {
                    "uri": "http://host.docker.internal:5000/run-matsim",
                    "accept": "application/json"
                }
            },
            "@context": [CONTEXT_URL]
        }
        
        r_sub = requests.post(f"{FIWARE_URL}/subscriptions", json=sub_payload, headers=headers)
        if r_sub.status_code == 201:
            print("Subscription successfully created!")
        else:
            print("Subscription check completed. It may already be set up.")
            print(f"Sub check: {r_sub.status_code} - {r_sub.text}")
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to FIWARE.")


def run_matsim():
    print("\n Starting MATSim simulation...")
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
            "@context": [CONTEXT_URL]
        }
        requests.patch(f"{FIWARE_URL}/entities/urn:ngsi-ld:TrafficSimulationControl:001/attrs", 
                      json=patch_payload, 
                      headers={'Content-Type': 'application/ld+json'})
        print("✅ FIWARE atualizado para FINISHED!")
    except subprocess.CalledProcessError as e:
        print(f"Simulation failed: {e}")

@app.route('/run-matsim', methods=['POST'])
def fiware_webhook():
    print("\n Notification received from FIWARE!")
    thread = threading.Thread(target=run_matsim)
    thread.start()
    return jsonify({"status": "Simulation triggered successfully"}), 200

if __name__ == '__main__':
    setup_fiware()
    print("Listening for FIWARE notifications on port 5000...")
    app.run(host='0.0.0.0', port=5000)