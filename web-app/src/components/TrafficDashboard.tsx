"use client";

import { useState } from "react";

export default function SimulationDashboard() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      } else {
        setMessage("An error occurred: " + data.error);
      }
    } catch (error) {
      setMessage("Server communication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Digital Twin Control Panel</h1>
      <p>Click the button below to start the MATSim execution.</p>

      <button 
        onClick={handleRunSimulation} 
        disabled={loading}
        style={{
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginTop: '20px'
        }}
      >
        {loading ? 'Processing...' : 'Run Simulation'}
      </button>

      {/* Feedback Message */}
      {message && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f4f4f4', borderRadius: '5px' }}>
          <strong>Status:</strong> {message}
        </div>
      )}
    </div>
  );
}