#!/bin/bash

echo "🚀 Preparing to start the Digital Twin..."

# Save the root directory path where the script is executed
BASE_DIR=$(pwd)

# ==========================================
# CLEANUP FUNCTION (Triggered on Ctrl+C)
# ==========================================
cleanup() {
    echo -e "\n\n🛑 Shutting down the Digital Twin safely..."
    
    echo "1. Closing Frontend and MATSim Runner..."
    kill $NEXT_PID $RUNNER_PID 2>/dev/null
    
    echo "2. Stopping FIWARE containers..."
    cd "$BASE_DIR/FIWARE" && docker compose down
    
    echo "✅ Everything is offline. Great job!"
    exit 0
}

# Listen for the termination signal (Ctrl+C)
trap cleanup SIGINT EXIT

# ==========================================
# STARTUP SEQUENCE
# ==========================================

# 1. Start FIWARE (Docker)
echo -e "\n🐳 [1/3] Starting FIWARE infrastructure..."
cd "$BASE_DIR/FIWARE"
docker compose up -d

# 2. Start MATSim Runner (Python) in Background
echo -e "\n🐍 [2/3] Starting MATSim Runner on port 5000..."
cd "$BASE_DIR/MatSim"
source .venv/bin/activate
python runner.py &
RUNNER_PID=$! # Save the Python process ID to kill it later

# 3. Start Next.js Dashboard (Node.js) in Background
echo -e "\n🌐 [3/3] Starting Next.js Dashboard on port 3000..."
cd "$BASE_DIR/web-app"
npm run dev &
NEXT_PID=$! # Save the Next.js process ID to kill it later

# ==========================================
# STANDBY MODE
# ==========================================
echo -e "\n✨ DIGITAL TWIN ONLINE ✨"
echo "👉 Dashboard available at: http://localhost:3000"
echo "👉 FIWARE available at: http://localhost:1026/version"
echo "⚠️ Press [CTRL + C] at any time to shut everything down."

# Keep the script running to show logs
wait