"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';

type Link = {
  id: string;
  density: number;
};

type TrafficPayload = {
  links: Link[];
};

export default function LiveTrafficDashboard({ staticGeoJson }: { staticGeoJson: any }) {
    const [trafficData, setTrafficData] = useState<Record<string, number>>({});

    useEffect(() => {
        const socket: Socket = io('http://localhost:5000');

        socket.on('connect', () => {
            console.log('Connected to traffic data server');
        });

        socket.on('traffic_update', (data: TrafficPayload) => {
            const trafficDict: Record<string, number> = {};
            data.links.forEach(link => {
                trafficDict[link.id] = link.density;
            });
            setTrafficData(trafficDict);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const trafficLayer = useMemo(() => {
        return new GeoJsonLayer({
            id: 'traffic-layer',
            data: staticGeoJson,
            lineWidthScale: 10,
            
            getLineColor: (feature: any): [number, number, number] => {
                const linkId = feature.properties.link_id;
                const density = trafficData[linkId] || 0; 

                if (density > 2.0) return [255, 0, 0];       // Red
                if (density > 0.5) return [255, 165, 0];     // Orange
                return [0, 255, 0];                          // Green
            },
            
            updateTriggers: {
                getLineColor: trafficData 
            }
        });
    }, [trafficData, staticGeoJson]);

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
                layers={[trafficLayer]} 
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
            </div>
        </div>
    );
}