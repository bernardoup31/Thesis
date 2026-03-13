#!/bin/bash
echo "🐍 [Terminal 2] Starting MATSim Runner..."
source .venv/bin/activate
pip install -r requirements.txt
cd Simulation
python runner.py