"use client";

import { useState, useEffect } from "react";
import RunSimulationButton from "./RunSimulationButton";
import LiveTrafficDashboard from "./LiveTrafficDashboard";

export default function SimulationDashboard() {
  const [status, setStatus] = useState("STOPPED");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [runMode, setRunMode] = useState("NONE"); // Default run mode
  const [isLoadingMap, setLoadingMap] = useState(false);
  const [staticGeoJson, setStaticGeoJson] = useState(null);

  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialStatus = async () => {
      setMessage("Checking simulation status from FIWARE...");
      try {
        const res = await fetch("/api/traffic/traffic-status");
        const data = await res.json();
        
        setStatus(data.status);
        const savedRunMode = localStorage.getItem('simulationRunMode');
        setRunMode(savedRunMode || data.runMode || "NONE");
        
        if (data.status === "FINISHED") {
          setMapUrl(data.mapURL);
          setMessage("Digital Twin Viewer ready to load the simulation results!");
        } else if (data.status === "STARTED") {
          setMessage("Simulation already running.");
        } else {
          setMessage("System stopped. Click the button to start the simulation.");
        }
      } catch (error) {
        setMessage("Error connecting to the server.");
      }
    };

    fetchInitialStatus();
  }, []);

  useEffect(() => {
    setLoadingMap(true);
    fetch("/porto_network.geojson")
      .then(res => res.json())
      .then(data => {
        setStaticGeoJson(data);
        setLoadingMap(false);
        console.log("Static GeoJSON loaded successfully.");
      })
      .catch(err => {
        console.error("Error loading GeoJSON:", err);
        setLoadingMap(false);
      });
  }, []);

  const handleRunSimulation = async (mode: string) => {

    const currentRunMode = mode;
    setRunMode(currentRunMode);
    setLoading(true);
    setMessage("Sending command to FIWARE...");
    localStorage.setItem('simulationRunMode', currentRunMode);

    try {
      const response = await fetch('/api/traffic/run-simulation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ runMode: currentRunMode })
      });

      const data = await response.json();

      if (data.success) {
        setMessage("Success! FIWARE triggered the MATSim simulation.");
        setStatus("STARTED");
      } else {
        setMessage("An error occurred: " + data.error);
      }
    } catch (error) {
      setMessage("Server communication error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status === "STARTED") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/traffic/traffic-status");
          const data = await res.json();
          
          if (data.status === "FINISHED") {
            setStatus("FINISHED");
            setMapUrl(data.mapURL);
            setMessage("Simulation finished! Loading the Digital Twin 3D Viewer...");
            clearInterval(interval);
          } else {
            setMessage(`Processing in background... FIWARE status: ${data.status}`);
          }
        } catch (error) {
          console.error("Error auto-checking status:", error);
        }
      }, 5000);
    }

    return () => clearInterval(interval);
  }, [status]);

  console.log("Current status:", status);
  console.log("Current map URL:", mapUrl);

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%' }}>
      
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
        <p>Click the button below to start the MATSim execution.</p>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-evenly', 
        }}>
          <RunSimulationButton 
            handleSimulationFunction={() => handleRunSimulation("LIVE")} 
            status={status} 
            loading={loading} 
            additionalInfo={"LIVE mode"}
          />

          <RunSimulationButton 
            handleSimulationFunction={() => handleRunSimulation("ANALYSIS")} 
            status={status} 
            loading={loading} 
            additionalInfo={"ANALYSIS mode"}
          />
        </div>

        {/* Feedback Message */}
        {message && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f4f4f4', borderLeft: '5px solid #0070f3', borderRadius: '5px' }}>
            <strong>Status:</strong> {message}
          </div>
        )}
      </div> 

      {status === "STARTED" && runMode === "LIVE" && (
        <div style={{ 
            width: 'calc(100% - 40px)',
            height: '80vh',
            background: '#f0f0f0',
            position: 'relative',
            margin: '20px auto',
            overflow: 'hidden',
            borderRadius: '12px'
        }}>
            {isLoadingMap && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <h2>Loading Digital Twin...</h2>
                </div>
            )}

            {!isLoadingMap && (
                <LiveTrafficDashboard 
                staticGeoJson={staticGeoJson} 
                />
            )}
        </div>
      )}

      {status === "FINISHED" && (
        <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto',
            marginTop: "40px", 
            textAlign: "center", 
            padding: "40px", 
            border: "2px dashed #4CAF50", 
            borderRadius: "12px", 
            backgroundColor: "#f9fbf9",
            marginBottom: "40px"
        }}>
          <h3>Simulation finished!</h3>
          <a 
            href="https://simwrapper.github.io/site/local/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "16px 32px",
              backgroundColor: "#4CAF50",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "18px",
              boxShadow: "0 4px 15px rgba(76, 175, 80, 0.3)",
              cursor: "pointer"
            }}
          >
            Open SimWrapper Visualization
          </a>
        </div>
      )}
    </div>
  );
}