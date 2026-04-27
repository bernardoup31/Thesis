"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, IconLayer } from '@deck.gl/layers';

type Link = {
  id: string;
  speed: number;
};

type AffectedRoad = {
  id: string;
  factor: number; // 0.0 means closed road, 1.0 means fully open, in between means partially closed (lanes closed)  
}

type TrafficPayload = {
  time: number;
  links: Link[];
};

export default function LiveTrafficDashboard({ staticGeoJson}: { staticGeoJson: any}) {
    const [trafficData, setTrafficData] = useState<Record<string, number>>({});
    const [selectedRoad, setSelectedRoad] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState<string>("");
    const [affectedRoads, setAffectedRoads] = useState<AffectedRoad[]>([]);
    const [inLiveMode, setInLiveMode] = useState(true); // TODO - Implement a slider to see at a determined time in the past the state of the roads

    const formatSimTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const socket: Socket = io('http://localhost:5000');

        socket.on('connect', () => {
            console.log('Connected to traffic data server');
            });
        socket.on('traffic_update', (data: TrafficPayload) => {
            const trafficDict: Record<string, number> = {};
            if (data.time !== undefined) {
                setCurrentTime(formatSimTime(data.time));
            }
            data.links.forEach(link => {
                trafficDict[link.id] = link.speed;
            });
            setTrafficData(trafficDict);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        const loadAffectedRoads = async () => {
            try {
                const response = await fetch('/api/traffic/get-affected-roads');  //TODO - This seems to be running twice, investigate later
                
                if (response.ok) {
                    const data = await response.json();
                    const parsedRoads: AffectedRoad[] = [];
                    
                    data.forEach((road: any) => {
                        if (road.id && road.statusDescription !== undefined) {
                            const cleanId = String(road.id).split(':').pop() || ""; 
                            parsedRoads.push({
                                id: cleanId,
                                factor: parseFloat(road.statusDescription)
                            });
                        }
                    });
                    
                    setAffectedRoads(parsedRoads);
                }
            } catch (error) {
                console.error(error);
            }
        };

        loadAffectedRoads();
    }, []);


    const handleUpdateLanes = async (targetLanes: number) => {
        if (!selectedRoad) return;

        const maxLanes = selectedRoad.maxLanes;
        let newStatus = "open";
        if (targetLanes === 0) {
            newStatus = "closed";
        } else if (targetLanes < maxLanes) {
            newStatus = "limited";
        }
        
        const decimalValue = maxLanes > 0 ? (targetLanes / maxLanes) : 0;
        const newStatusDescription = decimalValue.toFixed(2); 

        const response = await fetch('/api/traffic/road', {
            method: 'PATCH',
            body: JSON.stringify({ 
                roadId: selectedRoad.osm_id, 
                status: newStatus,
                statusDescription: newStatusDescription
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            setSelectedRoad((prev: any) => ({
                ...prev,
                lanes: targetLanes
            }));

            setAffectedRoads((prev) => {
            const roadIdStr = String(selectedRoad.osm_id);

            if (decimalValue === 1.0) {
                return prev.filter(road => road.id !== roadIdStr); // Deletes the road from the affected list
                
            } else {
                return [
                    ...prev.filter(road => road.id !== roadIdStr),
                    { id: roadIdStr, factor: decimalValue } // Adds or updates the road in the affected list
                ];
            }
        });
        }
    };

    const trafficLayer = useMemo(() => {
        return new GeoJsonLayer({
            id: 'traffic-layer',
            data: staticGeoJson,
            lineWidthScale: 10,
            
            getLineColor: (feature: any): [number, number, number] => {
                const linkId = feature.properties?.link_id;
                if (!linkId) return [200, 0, 200];

                const speed = trafficData[linkId] ?? 1.0; // Default to 1.0 (full speed) if no data
                
                if (speed < 0.25) return [100, 0, 0];
                if (speed < 0.50) return [255, 0, 0];
                if (speed < 0.75) return [255, 165, 0];
                if (speed < 0.90) return [255, 255, 0];
                return [0, 255, 0];
            },

            pickable: true,
            onClick: (info) => {
                if (info.object && info.object.properties) {
                    const osmId = info.object.properties.osm_id; 
                    
                    const fetchDetails = async () => {
                        try {
                            const response = await fetch(`/api/traffic/road?roadId=${osmId}`);
                            if (response.ok) {
                                const fiwareData = await response.json();
                                
                                const maxLanes = fiwareData.totalLaneNumber?.value ?? fiwareData.totalLaneNumber ?? 1;
                                const statusDesc = fiwareData.statusDescription?.value ?? fiwareData.statusDescription ?? "1.0";
                                const name = fiwareData.name?.value ?? fiwareData.name ?? "Unknown";
                                
                                const currentLanes = Math.round(parseFloat(statusDesc) * maxLanes);

                                setSelectedRoad({
                                    osm_id: osmId,
                                    name: name,
                                    lanes: currentLanes,
                                    maxLanes: maxLanes
                                });
                            }
                        } catch (error) {
                            console.error("Error fetching FIWARE data:", error);
                        }
                    };
                    fetchDetails();
                } else {
                    setSelectedRoad(null);
                }
            },
            autoHighlight: true,
            highlightColor: [0, 0, 0, 200],
            
            updateTriggers: {
                getLineColor: [trafficData] 
            }
        });
    }, [trafficData, staticGeoJson]);

    const affectedRoadsLayer = useMemo(() => {
        const roadsWithCoordinates = affectedRoads.map(road => {
            const feature = staticGeoJson.features.find((f: any) => 
                String(f.properties?.osm_id) === String(road.id)
            );
            if (!feature) return null;

            const coords = feature.geometry.coordinates;
            const midPointIndex = Math.floor(coords.length / 2);

            return {
                id: road.id,
                factor: road.factor,
                position: coords[midPointIndex],
                iconUrl: road.factor === 0.0 ? '/closedSign.png' : '/warningSign.png'
            };
        }).filter(Boolean); 

        return new IconLayer({
            id: 'affected-roads-layer',
            data: roadsWithCoordinates,
            pickable: false,
            getIcon: (d: any) => ({
                url: d.iconUrl,
                width: 128,
                height: 128, 
                anchorY: 64
            }),
            
            getPosition: (d: any) => [d.position[0], d.position[1], 10],

            sizeUnits: 'meters',
            getSize: 40,
            sizeMinPixels: 15,
            sizeMaxPixels: 60,
        });

    }, [affectedRoads, staticGeoJson]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <DeckGL
                initialViewState={{
                    longitude: -8.6291,
                    latitude: 41.157,
                    zoom: 13,
                    pitch: 45
                }}
                controller={true}
                layers={[trafficLayer, affectedRoadsLayer]} 
            />
            
            <div style={{ 
                position: 'absolute', 
                top: 20, 
                left: 20, 
                background: 'white', 
                padding: '10px 20px',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Live Traffic</h3>
                <p style={{ margin: 0 }}>Active Links: <strong>{Object.keys(trafficData).length}</strong></p>
                <p style={{ margin: '5px 0 0 0' }}>Time: {currentTime}</p>
            </div>

            {selectedRoad && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    right: 80,
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    width: '340px',
                    zIndex: 10
                }}>
                    <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        Street Details
                    </h3>
                    <p><strong>Name:</strong> {selectedRoad.name}</p>
                    <p><strong>ID:</strong> {selectedRoad.osm_id}</p>
                    
                    <div style={{ 
                        margin: '10px 0', 
                        padding: '10px', 
                        borderRadius: '4px',
                        backgroundColor: selectedRoad.lanes === 0 ? '#ffebee' : 
                                       selectedRoad.lanes < selectedRoad.maxLanes ? '#fff3e0' : '#e8f5e9'
                    }}>
                        <p style={{ margin: 0 }}>
                            <strong>Status: </strong> 
                            {selectedRoad.lanes === 0 ? 'Fully Closed' : 
                             selectedRoad.lanes < selectedRoad.maxLanes ? 'Partially Closed' : 
                             'Open'}
                        </p>
                        <p style={{ margin: '5px 0 0 0' }}>
                            <strong>Capacity: </strong> {selectedRoad.lanes} of {selectedRoad.maxLanes} lanes open
                        </p>
                    </div>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                        gap: '8px', 
                        marginTop: '15px' 
                    }}>
                        {selectedRoad.lanes > 0 && Array.from({ length: selectedRoad.lanes }, (_, i) => i + 1).map(num => (
                            <button 
                                key={num}
                                onClick={() => handleUpdateLanes(selectedRoad.lanes - num)}
                                style={{ 
                                    padding: '8px', 
                                    background: num === selectedRoad.lanes ? '#ff4444' : '#ff9800', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: 'pointer'
                                }}
                            >
                                {num === selectedRoad.lanes ? 'Close Road' : `Close ${num} ${num === 1 ? 'lane' : 'lanes'}`}
                            </button>
                        ))}
                        
                        {selectedRoad.lanes < selectedRoad.maxLanes && (
                            <button 
                                onClick={() => handleUpdateLanes(selectedRoad.maxLanes)}
                                style={{ padding: '8px', background: '#00C851', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', gridColumn: '1 / -1' }}
                            >
                                Reopen Road
                            </button>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setSelectedRoad(null)}
                        style={{ marginTop: '15px', width: '100%', padding: '5px', cursor: 'pointer', background: '#ccc', border: 'none', borderRadius: '4px' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}