import os
import re
import shutil
import socket
import sys
import time
import threading
import subprocess
import json

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from dotenv import load_dotenv
from pathlib import Path

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

root_path = Path(__file__).resolve().parent.parent
env_path = root_path / '.env'
load_dotenv(dotenv_path=env_path)

fiware_base = os.getenv('FIWARE_URL', 'http://localhost:1026')
FIWARE_URL = f"{fiware_base}/ngsi-ld/v1"
CONTEXT_URL = os.getenv('EV_CONTEXT_URL')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'output')
JAVA_SERVER_URL = os.getenv('JAVA_LISTENER', 'http://localhost:8080/')
PYTHON_MIDDLEWARE_LISTENER = os.getenv('PYTHON_MIDDLEWARE_LISTENER', 'http://localhost:5001/')

# Use a lock-protected dict so shared state is safe across threads
_state_lock = threading.Lock()
_state = {
    "finished_now": False,
    "first_run": True,
    "charging_snapshot": {"time": None, "stations": []},
}


def _get_state(key):
    with _state_lock:
        return _state[key]

def _set_state(key, value):
    with _state_lock:
        _state[key] = value


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
    Auto-configures FIWARE on startup.
    Creates the EVSimulationControl entity and trigger subscription if they do not exist.
    """
    headers = {'Content-Type': 'application/ld+json'}

    entity_payload = {
        "id": "urn:ngsi-ld:EVSimulationControl:001",
        "type": "EVSimulationControl",
        "simulationStatus": {
            "type": "Property",
            "value": "STOPPED"  # Default state. Next.js updates this to "STARTED" to trigger the simulation.
        },
        "mapURL": {
            "type": "Property",
            "value": ""  # Updated with the output URL once the simulation finishes.
        },
        "runMode": {
            "type": "Property",
            "value": "NONE"  # 3 modes: NONE (default), LIVE, ANALYSIS
        },
        "analysisConfig": {
            "type": "Property",
            "value": {}
        },
        "@context": [CONTEXT_URL]
    }

    try:
        response = requests.post(f"{FIWARE_URL}/entities", json=entity_payload, headers=headers)
        if response.status_code == 201:
            print("Entity 'EVSimulationControl:001' successfully created!")
        elif response.status_code == 409:  # 409 = Conflict: entity already exists
            print("Entity already exists. Skipping creation.")
        else:
            print(f"Failed to create entity: {response.text}")

        sub_start_payload = {
            "description": "Trigger MATSim from Next.js",
            "type": "Subscription",
            "entities": [{"type": "EVSimulationControl"}],
            "watchedAttributes": ["simulationStatus"],
            "q": "simulationStatus==%22STARTED%22",
            "notification": {
                "endpoint": {
                    "uri": "http://host.docker.internal:5001/run-matsim",
                    "accept": "application/json"
                },
                "attributes": ["simulationStatus", "runMode", "mapURL", "analysisConfig"]
            },
            "@context": [CONTEXT_URL]
        }
        create_subscription(sub_start_payload)

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
    entities = []

    for osm_id, details in roads.items():
        entity = {
            "id": f"urn:ngsi-ld:RoadSegment:{osm_id}",
            "type": "RoadSegment",
            "name": {
                "type": "Property",
                "value": details.get("name", "Unknown")
            },
            "allowedVehicleType": {
                "type": "Property",
                "value": details.get("allowed_vehicles", [])
            },
            "@context": [
                "https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld",
                "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
            ]
        }
        entities.append(entity)

    # Divide into batches to avoid overwhelming the FIWARE broker
    batch_size = max(1, len(entities) // 30)
    for i in range(0, len(entities), batch_size):
        batch = entities[i:i + batch_size]
        response = requests.post(
            f"{FIWARE_URL}/entityOperations/upsert?options=update",
            json=batch,
            headers=headers
        )
        if response.status_code == 207: 
            print(f"Roads already there, skipping creation.")
            break
        elif response.status_code not in [201, 204]:
            print(f"Warning: batch upload returned status {response.status_code}")
        else:
            print(f"Uploaded batch of {len(batch)} road entities to FIWARE.")

    print("Road sync complete!")


def _unwrap_fiware_value(value):
    if isinstance(value, dict):
        return value.get("value")
    return value


def sync_live_chargers_from_fiware():
    headers = {
        "Accept": "application/ld+json",
        "Link": f'<{CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
    }

    try:
        response = requests.get(
            f"{FIWARE_URL}/entities?type=EVChargingStation&options=keyValues&limit=1000",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        stations = response.json()

        chargers_path = Path("input/chargers.xml")
        chargers_path.parent.mkdir(parents=True, exist_ok=True)

        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<!DOCTYPE chargers SYSTEM "http://matsim.org/files/dtd/chargers_v1.dtd">',
            "<chargers>",
        ]

        written = 0
        skipped = 0
        for index, station in enumerate(stations if isinstance(stations, list) else []):
            matsim_link_id = _unwrap_fiware_value(station.get("matsimLinkId"))
            plug_count = _unwrap_fiware_value(station.get("capacity"))
            plug_power_kw = _unwrap_fiware_value(station.get("plugPower"))

            if not matsim_link_id:
                skipped += 1
                print(f"[LIVE] Skipping station {station.get('id')} because matsimLinkId is missing.")
                continue

            try:
                plug_count = max(1, int(plug_count))
                # MATSim chargers.xml expects plug_power in kW, not W.
                plug_power_kw = float(plug_power_kw)
            except (TypeError, ValueError):
                skipped += 1
                print(f"[LIVE] Skipping station {station.get('id')} because capacity/plugPower is invalid.")
                continue

            charger_id = f"charger_{index}"
            lines.append(
                f'\t<charger id="{charger_id}" link="{matsim_link_id}" type="default" '
                f'plug_count="{plug_count}" plug_power="{plug_power_kw}"/>'
            )
            written += 1

        lines.append("</chargers>")
        chargers_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"[LIVE] chargers.xml synced from FIWARE with {written} station(s). Skipped {skipped}.")
    except Exception as e:
        print(f"[LIVE] Error syncing chargers from FIWARE: {e}")


def run_matsim(mode, analysis_config=None):
    # Re-sync roads on every run after the first to reset any changes (e.g. closed roads) from the previous simulation
    if not _get_state("first_run"):
        initialize_road_entities()
    _set_state("first_run", False)

    print(f"\nStarting MATSim simulation in {mode} mode...")
    # Note: if you change MATSim Java code, rebuild with 'mvn clean package -DskipTests' before running.
    command = [
        "java", "-Xmx8G", "-jar",
        "matsim-example-project/matsim-example-project-0.0.1-SNAPSHOT.jar",
        "input/config.xml",
        mode
    ]

    if mode == "LIVE":
        sync_live_chargers_from_fiware()

    if mode == "ANALYSIS" and analysis_config is not None:
        try:
            headers = {
                'Accept': 'application/ld+json',
                'Link': f'<{CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
            }
            response = requests.get(f"{FIWARE_URL}/entities?type=EVChargingStation", headers=headers)

            candidate_stations = []
            if response.status_code == 200:
                stations = response.json()
                for station in stations:
                    # Extract the OSM/link ID from the NGSI-LD property structure
                    link_val = station.get('linkId')
                    if isinstance(link_val, dict):
                        candidate_stations.append(link_val.get('value'))
                    else:
                        candidate_stations.append(link_val)

            # Key must match the Java field name read by Jackson: getCandidateStations() -> "candidateStations"
            analysis_config["candidateStations"] = candidate_stations
            print(f"Fetched {len(candidate_stations)} candidate charging station(s) from FIWARE.")

        except Exception as e:
            print(f"Error fetching charging stations from FIWARE: {e}")

    if mode == "ANALYSIS" and analysis_config:
        config_file_path = "input/analysis_params.json"
        try:
            with open(config_file_path, "w", encoding="utf-8") as f:
                json.dump(analysis_config, f, indent=4)
            print(f"Analysis configuration saved to {config_file_path}")
            command.append(config_file_path)
        except Exception as e:
            print(f"Error saving analysis config: {e}")

    try:
        print("Command to run:", ' '.join(command))
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
            text=True,
            bufsize=1
        )

        matsim_log_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}T')

        #Delete matsim_output.log from previous runs to avoid confusion
        log_file_path = os.path.join(OUTPUT_DIR, "matsim_output.log")
        if os.path.exists(log_file_path):
            try:
                os.remove(log_file_path)
                print("Old matsim_output.log deleted.")
            except Exception as e:
                print(f"Error deleting old matsim_output.log: {e}")
                
        for line in process.stdout:
            if matsim_log_pattern.match(line):
                print(f"[MATSim] {line}", end="")
            else:
                clean_line = line.strip()
                if clean_line:
                    #print(f"========================================")
                    #print(f" [MATSim Java Print]: {clean_line}")
                    #print(f"========================================\n")
                    # Write to a separate log file for non-MATSim output
                    with open(os.path.join(OUTPUT_DIR, "matsim_output.log"), "a", encoding="utf-8") as log_file:
                        log_file.write(f" [MATSim Java Print]: {clean_line}" + "\n")

        process.wait()

        if process.returncode != 0:
            raise subprocess.CalledProcessError(process.returncode, command)

        print("Simulation finished successfully!")

        #Results are in results.csv
        with open(os.path.join(OUTPUT_DIR, "results.csv"), "a", encoding="utf-8") as log_file:
            print("")

        # Rename output folder produced by SimWrapper to a stable name
        analysis_dir = os.path.join(OUTPUT_DIR, 'analysis')
        old_folder = os.path.join(analysis_dir, 'network-all')
        new_folder = os.path.join(analysis_dir, 'network')

        if os.path.exists(old_folder):
            try:
                if os.path.exists(new_folder):
                    shutil.rmtree(new_folder)
                os.rename(old_folder, new_folder)
                print("Network folder renamed successfully.")
            except Exception as e:
                print(f"Error while renaming the network folder: {e}")
        else:
            print(f"Folder '{old_folder}' was not found. Skipping rename.")

        patch_payload = {
            "simulationStatus": {"type": "Property", "value": "FINISHED"},
            "mapURL": {"type": "Property", "value": os.getenv('OUTPUT_URL')},
            "@context": [CONTEXT_URL]
        }
        requests.patch(
            f"{FIWARE_URL}/entities/urn:ngsi-ld:EVSimulationControl:001/attrs",
            json=patch_payload,
            headers={'Content-Type': 'application/ld+json'}
        )
        print("Finished status updated in FIWARE.")
        _set_state("finished_now", True)

    except subprocess.CalledProcessError as e:
        patch_payload = {
            "simulationStatus": {"type": "Property", "value": "STOPPED"},
            "mapURL": {"type": "Property", "value": ""},
            "@context": [CONTEXT_URL]
        }
        requests.patch(
            f"{FIWARE_URL}/entities/urn:ngsi-ld:EVSimulationControl:001/attrs",
            json=patch_payload,
            headers={'Content-Type': 'application/ld+json'}
        )
        print(f"Simulation failed: {e}")


@app.route('/run-matsim', methods=['POST'])
def fiware_webhook():
    print("\nNotification received from FIWARE!")
    print("Raw body:", request.get_json())

    data = request.get_json().get('data', [{}])[0]
    entity_id = data.get('id')
    
    if not entity_id:
        return jsonify({"error": "No entity ID in notification"}), 400
        
    print(f"Notification triggered by {entity_id}. Fetching full details...")

    headers = {
        'Accept': 'application/ld+json',
        'Link': f'<{CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
    }
    try:
        response = requests.get(f"{FIWARE_URL}/entities/{entity_id}", headers=headers)
        if response.status_code == 200:
            full_entity = response.json()
            mode = full_entity.get('runMode', {}).get('value', 'NONE')

            analysis_config = None
            if mode == "ANALYSIS":
                analysis_config = full_entity.get('analysisConfig', {}).get('value', {})
                print(f"Analysis config successfully extracted: {analysis_config}")

            thread = threading.Thread(target=run_matsim, args=(mode, analysis_config), daemon=True)
            thread.start()
            
            return jsonify({"status": "Simulation triggered successfully"}), 200
            
        else:
            print(f"Failed to fetch full entity. Status: {response.status_code}")
            return jsonify({"error": "Failed to sync with FIWARE"}), 500
            
    except Exception as e:
        print(f"Error communicating with FIWARE: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/stream-charging', methods=['POST'])
def stream_charging():
    payload = request.get_json(silent=True) or {}
    stations = payload.get("stations")
    if not isinstance(stations, list):
        return jsonify({"error": "Invalid charging payload"}), 400

    _set_state("charging_snapshot", payload)
    socketio.emit("charging_update", payload)
    return jsonify({"status": "ok"}), 200


@app.route('/charging-status', methods=['GET'])
def charging_status():
    return jsonify(_get_state("charging_snapshot")), 200


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def start_simwrapper():
    source_path = os.path.join(root_path, "Simulation/simwrapper-feed.py")
    dest_path = os.path.join(OUTPUT_DIR, "simwrapper-feed.py")

    print(f"Source path: {source_path}")
    print(f"Starting SimWrapper server from {dest_path}...")

    try:
        subprocess.run(["fuser", "-k", "8000/tcp"], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        time.sleep(1)

        if not os.path.exists(dest_path):
            print(f"Copying simwrapper-feed.py to {OUTPUT_DIR}...")
            shutil.copy2(source_path, dest_path)

        subprocess.Popen(
            ["nohup", sys.executable, "simwrapper-feed.py"],
            cwd=OUTPUT_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        print("SimWrapper server started successfully.")

    except Exception as e:
        print(f"Error starting SimWrapper: {e}")


def watch_status():
    """
    Background thread that checks every 30 seconds whether SimWrapper needs to be (re)started.
    Also reacts immediately when a simulation has just finished.
    """
    port = int(os.getenv('OUTPUT_PORT', '8000'))
    headers = {'Accept': 'application/ld+json'}
    url = f"{FIWARE_URL}/entities/urn:ngsi-ld:EVSimulationControl:001"

    while True:
        print("Checking simulation status and SimWrapper server...")
        if not is_port_in_use(port) or _get_state("finished_now"):
            _set_state("finished_now", False)
            try:
                response = requests.get(url, headers=headers, timeout=5)
                if response.status_code == 200:
                    entity = response.json()
                    status = entity.get('simulationStatus', {}).get('value') 
                    if status == 'FINISHED':
                        print("Status is FINISHED but SimWrapper is idle. Starting SimWrapper...")
                        start_simwrapper()
            except requests.exceptions.RequestException as e:
                print(f"Error checking simulation status: {e}")

        time.sleep(30)


if __name__ == '__main__':
    setup_fiware()
    print("Listening for FIWARE notifications on port 5001...")
    raw_port = PYTHON_MIDDLEWARE_LISTENER.split(':')[-1].replace('/', '').strip()
    port_number = int(raw_port)
    threading.Thread(target=watch_status, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=port_number, allow_unsafe_werkzeug=True)
