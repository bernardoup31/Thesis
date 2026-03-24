# Separar este ficheiro em 2, um para a configuração do FIWARE e outro para o servidor Flask que corre a simulação. O setup do FIWARE só precisa de ser feito uma vez, enquanto o servidor Flask tem de estar sempre a correr para receber as notificações do FIWARE.
import os
import shutil
import socket
import sys
import time
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
                    "uri": "http://host.docker.internal:5000/run-matsim",
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
        start_simwrapper() # Start the SimWrapper server to serve the output files after the simulation finishes.
    except subprocess.CalledProcessError as e:
        print(f"Simulation failed: {e}")



@app.route('/run-matsim', methods=['POST'])
def fiware_webhook():
    print("\n Notification received from FIWARE!")
    thread = threading.Thread(target=run_matsim)
    thread.start()
    return jsonify({"status": "Simulation triggered successfully"}), 200

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_simwrapper():
    # 1. Definir os caminhos (vêm do teu runner.py)
    # Assume que o original está na raiz do projeto e queres levar para o /output
    source_path = os.path.join(root_path, "Simulation/simwrapper-feed.py")
    dest_path = os.path.join(OUTPUT_DIR, "simwrapper-feed.py")

    print (f"Source path: {source_path}")
    print(f"Starting SimWrapper server from {dest_path}...")

    try:
        # 2. GARANTIR QUE O FICHEIRO EXISTE LÁ DENTRO
        # Se o ficheiro não estiver lá, copiamos o original para a pasta de output
        if not os.path.exists(dest_path):
            print(f"Copying file to {OUTPUT_DIR}...")
            shutil.copy2(source_path, dest_path)

        # 3. EXECUTAR (O comando que tu já tinhas)
        command = ["nohup", sys.executable, "simwrapper-feed.py"]
        
        subprocess.Popen(
            command,
            cwd=OUTPUT_DIR, # Isto faz com que ele corra "lá dentro"
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        print("SimWrapper server started successfully from output directory!")
        
    except Exception as e:
        print(f"Error instantiating SimWrapper: {e}")

def watch_status():
    port = int(os.getenv('OUTPUT_PORT', '8000'))
    headers = {'Accept': 'application/ld+json'}
    url = f"{FIWARE_URL}/entities/urn:ngsi-ld:TrafficSimulationControl:001"
    
    while True:
        print("Checking simulation status and SimWrapper server...")
        if not is_port_in_use(port):
            try:
                response = requests.get(url, headers=headers, timeout=5)
                if response.status_code == 200:
                    entity = response.json()
                    status = entity.get('status', {}).get('value')
                    
                    if status == 'FINISHED':
                        print(f"Status is FINISHED but host is idle. Starting SimWrapper...")
                        start_simwrapper()
                        
            except requests.exceptions.RequestException as e:
                print(f"Error checking simulation status: {e}")
        
        time.sleep(30)

if __name__ == '__main__':
    setup_fiware()
    print("Listening for FIWARE notifications on port 5000...")
    threading.Thread(target=watch_status, daemon=True).start()
    app.run(host='0.0.0.0', port=5000)