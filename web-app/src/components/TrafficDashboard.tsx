"use client";

import { useState, useEffect } from "react";
import RunSimulationButton from "./RunSimulationButton";

export default function SimulationDashboard() {
  const [status, setStatus] = useState("STOPPED");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [roadId, setRoadId] = useState("");

  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialStatus = async () => {
      setMessage("Checking simulation status from FIWARE...");
      try {
        const res = await fetch("/api/traffic-status");
        const data = await res.json();
        
        setStatus(data.status);
        
        if (data.status === "FINISHED") {
          setMapUrl(data.mapURL);
          setMessage("Digital Twin 3D Viewer ready to load the simulation results!");
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

  const handleRunSimulation = async () => {
    setLoading(true);
    setMessage("Sending command to FIWARE...");

    try {
      const response = await fetch('/api/run-simulation', {
        method: 'PATCH',
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

  const handleCloseRoad = async () => {
    if (!roadId) return;

    const response = await fetch('/api/close-road', {
      method: 'PATCH',
      body: JSON.stringify({ roadId: roadId }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();

    if (data.success) {
      // Não uses setStatus("STARTED") aqui, senão reinicias o polling desnecessariamente
      setMessage(`Road ${roadId} closed! MATSim is rerouting agents...`);
    } else {
      setMessage("An error occurred: " + data.error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status === "STARTED") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/traffic-status");
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
    <div style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <p>Click the button below to start the MATSim execution.</p>

      <RunSimulationButton 
        handleSimulationFunction={handleRunSimulation} 
        status={status} 
        loading={loading} 
      />

      <div style={{ 
      marginTop: '30px', 
      padding: '20px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      backgroundColor: status === "STARTED" ? "#fff" : "#f0f0f0",
      opacity: status === "STARTED" ? 1 : 0.6
      }}>
        <h4 style={{ marginTop: 0 }}>Live Traffic Control</h4>
        <p style={{ fontSize: '14px', color: '#666' }}>
          {status === "STARTED" 
            ? "Enter a Road ID to reroute traffic in real-time." 
            : "Simulation must be running to use this feature."}
        </p>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="e.g. link_123"
            value={roadId}
            onChange={(e) => setRoadId(e.target.value)}
            disabled={status !== "STARTED"}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
          <button 
            onClick={() => handleCloseRoad()} 
            disabled={status !== "STARTED"}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: status === "STARTED" ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            Close Road
          </button>
        </div>
      </div>

      {/* Feedback Message */}
      {message && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f4f4f4', borderLeft: '5px solid #0070f3', borderRadius: '5px' }}>
          <strong>Status:</strong> {message}
        </div>
      )}

      {status === "FINISHED" && (
        <div style={{ 
            marginTop: "40px", 
            textAlign: "center", 
            padding: "40px", 
            border: "2px dashed #4CAF50", 
            borderRadius: "12px", 
            backgroundColor: "#f9fbf9" 
        }}>
          <h3>
            Simulation finished!
          </h3>
          
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