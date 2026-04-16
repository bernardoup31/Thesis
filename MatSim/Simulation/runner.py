#TODO - Separar este ficheiro em 2, um para a configuração do FIWARE e outro para o servidor Flask que corre a simulação. O setup do FIWARE só precisa de ser feito uma vez, enquanto o servidor Flask tem de estar sempre a correr para receber as notificações do FIWARE.
import os
import re
import shutil
import socket
import sys
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import subprocess
import threading
import requests
from dotenv import load_dotenv
from pathlib import Path
import sqlite3
import json
import socket

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
    
root_path = Path(__file__).resolve().parent.parent
env_path = root_path / '.env'
load_dotenv(dotenv_path=env_path)

db_path = os.getenv('DB_PATH', './live_information.db')
if os.path.exists(db_path): # Temporary database file to store live information during the simulation. It will be created by the SimWrapper and read by the Next.js app to show real-time traffic updates on the map. It is deleted and recreated on each run to ensure a clean state.
    os.remove(db_path)
conn = sqlite3.connect(db_path, check_same_thread=False)
cursor = conn.cursor()

db_lock = threading.Lock()  # Lock to ensure thread-safe database operations

cursor.execute('''
    CREATE TABLE IF NOT EXISTS traffic_history (
        sim_time INTEGER PRIMARY KEY,
        traffic_data TEXT
    )
''')
conn.commit()



fiware_base = os.getenv('FIWARE_URL', 'http://localhost:1026')
FIWARE_URL = f"{fiware_base}/ngsi-ld/v1"
CONTEXT_URL = os.getenv('TRAFFIC_CONTEXT_URL')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'output')
JAVA_SERVER_URL = os.getenv('JAVA_LISTENER', 'http://localhost:8080/')
PYTHON_MIDDLEWARE_LISTENER = os.getenv('PYTHON_MIDDLEWARE_LISTENER', 'http://localhost:5000/')
finished_now = False

def create_subscription(payload):
    headers = {'Content-Type': 'application/ld+json'}
    try:
        response = requests.post(f"{FIWARE_URL}/subscriptions", json=payload, headers=headers)
        if response.status_code == 201:
            print(payload['description'] + " subscription created successfully!")
        else:
            print(f"Subscription check completed. It may already be set up.")
            print(f"Sub check: {response.status_code} - {response.text}")
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to FIWARE.")

def setup_fiware():
    """
    Auto-configures FIWARE on startup. Creates the entity and subscription if they don't exist.
    """
    headers = {'Content-Type': 'application/ld+json'}
    
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
        "runMode": {
            "type": "Property",
            "value": "NONE" # 3 modes: NONE (default), LIVE (real-time updates to Next.js), ANALYSIS (only update Next.js when simulation finishes with the final output URL)
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
            
        sub_start_payload = {
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
        create_subscription(sub_start_payload)

        sub_road_payload = {
            "description": "Notify MATSim in runtime when a road is closed",
            "type": "Subscription",
            "entities": [{"type": "RoadSegment"}],
            "watchedAttributes": ["status"],
            "notification": {
                "endpoint": {
                    "uri": "http://host.docker.internal:5000/update-road",
                    "accept": "application/json"
                }
            },
            "@context": [
                "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",  
                "https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld" 
            ]
        }
        create_subscription(sub_road_payload)
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to FIWARE.")

    initialize_road_entities()

def initialize_road_entities():
    try:
        with open('link_dict.json', 'r', encoding='utf-8') as f:
            roads = json.load(f)
    except FileNotFoundError:
        print("link_dict.json not found. Skipping road sync.")
        return

    headers = {'Content-Type': 'application/ld+json'}
    
    check_response = requests.get(f"{FIWARE_URL}/entities?type=RoadSegment&limit=1", headers=headers)
    if check_response.status_code == 200 and len(check_response.json()) > 0:
        print("Roads already exist in FIWARE. Skipping upload.") #TODO - instead of skipping, restart the attributes of all existing road entities to "open" to ensure a clean state on each run.
        return
    
    entities = []
    for osm_id, details in roads.items():
        lanes_count = details.get("lanes", 1)
        max_lanes = details.get("maxLanes", lanes_count)

        entity = {
            "id": f"urn:ngsi-ld:RoadSegment:{osm_id}",
            "type": "RoadSegment",
            "name": {
                "type": "Property",
                "value": details.get("name", "Unknown")
            },
            "totalLaneNumber": {
                "type": "Property",
                "value": max_lanes
            },
            "status": {
                "type": "Property",
                "value": ["open"]
            },
            "statusDescription": {
                "type": "Property",
                "value": "1.0"
            },
            "@context": [
                "https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld",
                "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld" 
            ]
        }
        entities.append(entity)

    batch_size = len(entities) // 30 # Adjust batch size based on total number of entities to avoid overwhelming the server.
    for i in range(0, len(entities), batch_size):
        batch = entities[i:i + batch_size]
        response = requests.post(
            f"{FIWARE_URL}/entityOperations/upsert", 
            json=batch, 
            headers=headers
        )
        if response.status_code not in [201, 204]:
            print(f"Warning: One upload returned status {response.status_code}")
        else:
            print(f"Uploaded batch of {len(batch)} road entities to FIWARE.")
    
    print("Road sync complete!")


def run_matsim(mode):
    print(f"\nStarting MATSim simulation in {mode} mode...") # If changes made in MatSim code, make sure to rebuild the JAR file with 'mvn clean package -DskipTests' before running the simulation.
    command = [
        "java", "-Xmx8G", "-jar", 
        "matsim-example-project/matsim-example-project-0.0.1-SNAPSHOT.jar", 
        "input/config.xml"
    ]
    if mode == "LIVE":
        command.append("0")  # Argument to enable real-time updates to Next.js
    try:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
            text=True,
            bufsize=1 
        )

        matsim_log_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}T')

        for line in process.stdout:
            if matsim_log_pattern.match(line):
                print(f"[MATSim] {line}", end="")
            else:
                clean_line = line.strip()
                if clean_line:
                    print(f"\n========================================")
                    print(f" [MATSim Java Print]: {clean_line}")
                    print(f"========================================\n")

        process.wait()

        if process.returncode == 0:
            print("Simulation finished successfully!")
        else:
            raise subprocess.CalledProcessError(process.returncode, command)

        analysis_dir = os.path.join(OUTPUT_DIR, 'analysis')
        old_folder = os.path.join(analysis_dir, 'network-all')
        new_folder = os.path.join(analysis_dir, 'network')

        if os.path.exists(old_folder):
            try:
                # If the destination folder already exists from a previous run, remove it before renaming
                if os.path.exists(new_folder):
                    shutil.rmtree(new_folder)
                
                # Rename the folder
                os.rename(old_folder, new_folder)
                print(f"Renaming done")
                
            except Exception as e:
                print(f"Error while renaming the network folder: {e}")
        else:
            print(f"Folder '{old_folder}' was not found. Skipping rename operation.")

        patch_payload = {
            "status": {"type": "Property", "value": "FINISHED"},
            "mapURL": {"type": "Property", "value": os.getenv('OUTPUT_URL')},
            "@context": [CONTEXT_URL]
        }
        requests.patch(f"{FIWARE_URL}/entities/urn:ngsi-ld:TrafficSimulationControl:001/attrs", 
                      json=patch_payload, 
                      headers={'Content-Type': 'application/ld+json'})
        print("Finnished status updated in FIWARE.")
        global finished_now
        finished_now = True
        
    except subprocess.CalledProcessError as e:
        patch_payload = {
            "status": {"type": "Property", "value": "STOPPED"},
            "mapURL": {"type": "Property", "value": ""},
            "@context": [CONTEXT_URL]
        }
        requests.patch(f"{FIWARE_URL}/entities/urn:ngsi-ld:TrafficSimulationControl:001/attrs", 
                      json=patch_payload, 
                      headers={'Content-Type': 'application/ld+json'})
        print(f"Simulation failed: {e}")



@app.route('/run-matsim', methods=['POST'])
def fiware_webhook():
    print("\n Notification received from FIWARE!")
    data = request.get_json().get('data', {})[0]  # Get the first (and only) element of the data array
    mode = data.get('runMode', 'NONE').get('value', 'NONE')  # Extract the runMode value, defaulting to 'NONE' if not found
    thread = threading.Thread(target=run_matsim, args=(mode,), daemon=True)
    thread.start()
    return jsonify({"status": "Simulation triggered successfully"}), 200

@app.route('/update-road', methods=['POST'])
def update_road():
    notification = request.get_json() or {}
    data = notification.get('data', [])

    if not data:
        return jsonify({"status": "No data received"}), 200
    entity = data[0]
    
    # Extract the road ID from the entity ID (format is "urn:ngsi-ld:RoadSegment:{osm_id}")
    full_id = entity.get('id', '')
    road_id = full_id.split(':')[-1] if full_id else None

    status_attr = entity.get('statusDescription', {})
    status_value = status_attr.get('value', '1.0') if isinstance(status_attr, dict) else status_attr

    if road_id:
        # Preparamos o payload para o Java
        payload_for_java = {
            "linkId": road_id,
            "capacityFactor": float(status_value)
        }

        print(f"Updating  road: {road_id} to factor {status_value}")

        try:
            java_uri = f"{JAVA_SERVER_URL}/update-road"
            requests.post(java_uri, json=payload_for_java, timeout=5)
            return jsonify({"status": "Forwarded to Java", "id": road_id}), 200
        except Exception as e:
            print(f"Error connecting to Java: {e}")
            return jsonify({"status": "Java connection error"}), 500

    return jsonify({"status": "Invalid entity data"}), 400
    
@app.route('/stream-traffic', methods=['POST'])
def stream_traffic():
    data = request.get_json()
    sim_time = data['time']

    traffic_data_json = json.dumps(data['links'])
    if sim_time % 1800 == 0:  # Store traffic data every 30 minutes of simulation time (1800 seconds) to avoid excessive database growth.
        print(f"Storing traffic data for simulation time {sim_time} in the database...")
        with db_lock:  # Ensure that only one thread can write to the database at a time
            cursor.execute('''
                INSERT INTO traffic_history (sim_time, traffic_data) 
                VALUES (?, ?)
            ''', (sim_time, traffic_data_json))
            conn.commit()

    socketio.emit('traffic_update', {'time': sim_time, 'links': data['links']})
    return jsonify({"status": "Traffic data received and broadcasted"}), 200

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_simwrapper():
    source_path = os.path.join(root_path, "Simulation/simwrapper-feed.py")
    dest_path = os.path.join(OUTPUT_DIR, "simwrapper-feed.py")

    print (f"Source path: {source_path}")
    print(f"Starting SimWrapper server from {dest_path}...")

    try:
        subprocess.run(["fuser", "-k", "8000/tcp"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        time.sleep(1)

        if not os.path.exists(dest_path):
            print(f"Copying file to {OUTPUT_DIR}...")
            shutil.copy2(source_path, dest_path)

        command = ["nohup", sys.executable, "simwrapper-feed.py"]
        
        subprocess.Popen(
            command,
            cwd=OUTPUT_DIR,
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
    global finished_now
    
    while True:
        print("Checking simulation status and SimWrapper server...")
        if not is_port_in_use(port) or finished_now:
            finished_now = False
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
    raw_port = PYTHON_MIDDLEWARE_LISTENER.split(':')[-1].replace('/', '').strip()
    port_number = int(raw_port)
    threading.Thread(target=watch_status, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=port_number, allow_unsafe_werkzeug=True)