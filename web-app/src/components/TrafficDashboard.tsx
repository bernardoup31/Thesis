"use client";

import { useState, useEffect } from "react";

export default function SimulationDashboard() {
  const [status, setStatus] = useState("STOPPED");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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

      <button 
        onClick={handleRunSimulation} 
        disabled={loading || status === "STARTED"}
        style={{
          backgroundColor: (loading || status === "STARTED") ? '#ccc' : '#0070f3',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          cursor: (loading || status === "STARTED") ? 'not-allowed' : 'pointer',
          marginTop: '20px',
          fontWeight: 'bold'
        }}
      >
        {status === "STARTED" ? 'Running Simulation...' : 'Run Simulation'}
      </button>

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