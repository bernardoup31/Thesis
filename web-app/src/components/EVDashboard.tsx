"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, IconLayer } from '@deck.gl/layers';
import RunSimulationButton from './RunSimulationButton';
import EVStationsMap from './EVStationsMap';

export default function EVDashboard() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("STOPPED");
    const [message, setMessage] = useState("");
    const [runMode, setRunMode] = useState("NONE"); // Default run mode
    const [isLoadingMap, setLoadingMap] = useState(false);
    const [staticGeoJson, setStaticGeoJson] = useState(null);

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
        setLoading(true);
        setMessage(`Starting simulation in ${mode} mode...`);
        try {
            const res = await fetch(`/api/electric-vehicles/run-simulation?mode=${mode}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setStatus("STARTED");
                setRunMode(mode);
                localStorage.setItem('simulationRunMode', mode); // Save run mode to localStorage
                setMessage(`Simulation started in ${mode} mode!`);
            } else {
                setMessage(`Failed to start simulation: ${data.error}`);
            }
        } catch (error) {
            setMessage("Error connecting to the server.");
        } finally {
            setLoading(false);
        }
    };


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

          {status === "STOPPED" && (
            <>  
            <EVStationsMap
                    staticGeoJson={staticGeoJson} 
                    live={true}
                    />
            </>
            
        )}
    
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
                    <EVStationsMap
                    staticGeoJson={staticGeoJson} 
                    live={true}
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