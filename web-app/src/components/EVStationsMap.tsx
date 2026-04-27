import DeckGL, { GeoJsonLayer, IconLayer } from "deck.gl";
import { useState, useEffect, use, useMemo } from "react";

type EVStation = {
  id: string;
  capacity?: number;
  availableCapacity?: number;
  queuedVehicles?: number;
  availableEnergyKwh?: number;
  maxEnergyKwh?: number;
  totalEnergyDeliveredKwh?: number;
  plugPower?: number;
  status?: string;
  location?: { type: string; coordinates: [number, number] };
  linkId?: string;
  name?: string;
};

const DEFAULT_FORM = { capacity: 4, plugPower: 50, maxEnergyKwh: 200};

export default function EVStationsMap({ staticGeoJson, live }: { staticGeoJson: any, live: boolean }) {
    const [evStations, setEvStations] = useState<any[]>([]);
    const [selectedRoad, setSelectedRoad] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);

    function getRoadMidpoint(coordinates: [number, number][]): [number, number] {
        return coordinates[Math.floor(coordinates.length / 2)];
    }

    const fetchEVStations = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/electric-vehicles/charging-stations");
            const data = await res.json();
            setEvStations(data);
        } catch (error) {
            console.error("Error fetching EV stations:", error);
        } finally {
            setLoading(false);
        }
    };

    const stationsByLinkId = useMemo(() => {
        const map: Record<string, EVStation> = {};
        evStations.forEach((s) => { if (s.linkId) map[s.linkId] = s; });
        return map;
    }, [evStations]);
  
    useEffect(() => {
        if (!live) { // Only fetch one time for static mode
            fetchEVStations();
        }
        else {
            fetchEVStations();
            const intervalId = setInterval(fetchEVStations, 30000); // Fetch every 30 seconds
            return () => clearInterval(intervalId); // Clean up on unmount
      }
    }, [live]);

    const roadLayer = useMemo(() => new GeoJsonLayer({
        id: "road-layer",
        data: staticGeoJson,
        lineWidthScale: 10,
        getLineColor: (feature: any): [number, number, number, number] => {
        const osmId = String(feature.properties?.osm_id ?? "");
        return stationsByLinkId[osmId]
            ? [0, 255, 0, 255]  
            : [80, 85, 100, 180]; // grey - no stations
        },
        getLineWidth: (feature: any): number => {
        const osmId = String(feature.properties?.osm_id ?? "");
        return stationsByLinkId[osmId] ? 2 : 1;
        },
        pickable: true,
        autoHighlight: true,
        highlightColor: [200, 230, 255, 200] as [number, number, number, number],
        onClick: (info: any) => {
        if (!info.object?.properties) { setSelectedRoad(null); return; }
        const props = info.object.properties;
        const osmId = String(props.osm_id ?? "");
        const coords: [number, number][] = info.object.geometry.coordinates;
        setSelectedRoad({
            osm_id: osmId,
            name: props.name ?? osmId ?? "Unnamed Road",
            coordinates: getRoadMidpoint(coords),
            existingStation: stationsByLinkId[osmId] ?? null,
        });
        setForm(DEFAULT_FORM);
        },
        updateTriggers: {
        getLineColor: [stationsByLinkId],
        getLineWidth: [stationsByLinkId],
        },
    }), [staticGeoJson, stationsByLinkId]);

    const handleAddStation = async () => {
        if (!selectedRoad) return;
        setSaving(true);
        try {
        const res = await fetch("/api/electric-vehicles/charging-station", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            linkId: selectedRoad.osm_id,
            capacity: form.capacity,
            plugPower: form.plugPower,
            maxEnergyKwh: form.maxEnergyKwh,
            coordinates: selectedRoad.coordinates,
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchEVStations();
        setSelectedRoad(null);
        } catch (error) {
        console.error("Error adding station:", error);
        } finally {
        setSaving(false);
        }
    };

    const handleRemoveStation = async () => {
        if (!selectedRoad?.existingStation) return;
        setSaving(true);
        try {
        const res = await fetch("/api/electric-vehicles/charging-station", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: selectedRoad.existingStation.id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchEVStations();
        setSelectedRoad(null);
        } catch (error) {
        console.error("Error removing station:", error);
        } finally {
        setSaving(false);
        }
    };

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
        <DeckGL
            initialViewState={{ longitude: -8.6291, latitude: 41.157, zoom: 13, pitch: 45 }}
            controller={true}
            layers={[roadLayer]}
        />

        <div style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "white",
            padding: "10px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}>
            <p style={{ margin: 0 }}>Stations: <strong>{evStations.length}</strong></p>
            <p style={{ margin: "5px 0 0 0", color: "#888", fontSize: 13 }}>
            {loading ? "Loading..." : "Click a road to add or remove a station"}
            </p>
        </div>

        {selectedRoad && (
            <div style={{
            position: "absolute",
            top: 20,
            right: 80,
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            width: "340px",
            zIndex: 10,
            }}>
            <h3 style={{ margin: "0 0 10px 0", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
                Street Details
            </h3>
            <p><strong>Name:</strong> {selectedRoad.name}</p>
            <p><strong>ID:</strong> {selectedRoad.osm_id}</p>

            {selectedRoad.existingStation ? (
                <>
                <div style={{
                    margin: "10px 0",
                    padding: "10px",
                    borderRadius: "4px",
                    backgroundColor: "#e8f5e9",
                }}>
                    <p style={{ margin: 0 }}><strong>Status:</strong> Charging Station Available</p>
                    <p style={{ margin: "5px 0 0 0" }}><strong>Capacity:</strong> {selectedRoad.existingStation.capacity} ports</p>
                    <p style={{ margin: "5px 0 0 0" }}><strong>Power:</strong> {selectedRoad.existingStation.plugPower} kW</p>
                    <p style={{ margin: "5px 0 0 0" }}><strong>Max Energy:</strong> {selectedRoad.existingStation.maxEnergyKwh} kWh</p>
                </div>
                <button
                    onClick={handleRemoveStation}
                    disabled={saving}
                    style={{
                    marginTop: "10px", width: "100%", padding: "8px",
                    background: saving ? "#ccc" : "#ff4444",
                    color: "white", border: "none", borderRadius: "4px", cursor: saving ? "not-allowed" : "pointer",
                    }}
                >
                    {saving ? "Removing..." : "Remove Station"}
                </button>
                </>
            ) : (
                <>
                <div style={{ margin: "10px 0", padding: "10px", borderRadius: "4px", backgroundColor: "#f5f5f5" }}>
                    <p style={{ margin: 0 }}><strong>Status:</strong> No Station</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                    {([
                    { label: "Capacity (ports)", key: "capacity" },
                    { label: "Power per port (kW)", key: "plugPower" },
                    { label: "Max energy (kWh)", key: "maxEnergyKwh" },
                    ] as { label: string; key: keyof typeof form }[]).map(({ label, key }) => (
                    <div key={key}>
                        <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 2 }}>{label}</label>
                        <input
                        type="number"
                        min={1}
                        value={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{
                            width: "100%", padding: "6px 8px", borderRadius: "4px",
                            border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box",
                        }}
                        />
                    </div>
                    ))}
                </div>
                <button
                    onClick={handleAddStation}
                    disabled={saving}
                    style={{
                    marginTop: "10px", width: "100%", padding: "8px",
                    background: saving ? "#ccc" : "#00C851",
                    color: "white", border: "none", borderRadius: "4px", cursor: saving ? "not-allowed" : "pointer",
                    }}
                >
                    {saving ? "Adding..." : "Add Charging Station"}
                </button>
                </>
            )}

            <button
                onClick={() => setSelectedRoad(null)}
                style={{ marginTop: "10px", width: "100%", padding: "5px", cursor: "pointer", background: "#ccc", border: "none", borderRadius: "4px" }}
            >
                Dismiss
            </button>
            </div>
        )}
        </div>
    );
}