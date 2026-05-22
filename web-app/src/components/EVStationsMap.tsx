import { MapView as DeckMapView, type MapViewState } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type EVStation = {
  id: string;
  capacity?: number;
  availableCapacity?: number;
  queuedVehicles?: number;
  totalEnergyDeliveredKwh?: number;
  plugPower?: number;
  status?: string;
  linkId?: string;
  name?: string;
};

type LiveChargingStation = {
  chargerId: string;
  linkId: string;
  chargerType: string;
  plugPowerKw: number;
  plugCount: number;
  occupiedPorts: number;
  availablePorts: number;
  queueLength: number;
  full: boolean;
  status: string;
  chargingVehicles: string[];
  queuedVehicles: string[];
};

type ChargingPayload = {
  time: number;
  stations: LiveChargingStation[];
};

type SelectedRoad = {
  osmId: string;
  matsimLinkId: string;
  name: string;
  coordinates: [number, number];
};

type SimStatus = "STOPPED" | "STARTED" | "FINISHED";

const DEFAULT_FORM = { capacity: 4, plugPower: 50 };
const EV_SOCKET_URL = "http://localhost:5001";

export default function EVStationsMap({
  staticGeoJson,
  live,
  status,
  onStationsChange,
}: {
  staticGeoJson: any;
  live: boolean;
  status: SimStatus;
  onStationsChange: (count: number) => void;
}) {
  const [evStations, setEvStations] = useState<EVStation[]>([]);
  const [liveStations, setLiveStations] = useState<LiveChargingStation[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<SelectedRoad | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [hasReceivedLiveUpdate, setHasReceivedLiveUpdate] = useState(false);

  const isLiveRunning = live && status === "STARTED";
  const shouldDisplayLiveSnapshot = isLiveRunning && hasReceivedLiveUpdate;

  const CITY_BOUNDS = {
    west: -8.75,
    east: -8.50,
    south: 41.08,
    north: 41.23,
  };

  const deckView = useMemo(() => new DeckMapView(), []);

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: -8.6291,
    latitude: 41.157,
    zoom: 13,
    pitch: 45,
    bearing: 0,
    minZoom: 11,
    maxZoom: 18,
  });

  const formatSimTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  function getRoadMidpoint(coordinates: [number, number][]): [number, number] {
    return coordinates[Math.floor(coordinates.length / 2)];
  }

  const fetchEVStations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/electric-vehicles/charging-stations");
      const data = await res.json();
      const stations = Array.isArray(data) ? (data as EVStation[]) : [];
      setEvStations(stations);
      onStationsChange(stations.length);
    } catch (error) {
      console.error("Error fetching EV stations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEVStations();
  }, []);

  useEffect(() => {
    if (!isLiveRunning) {
      setLiveStations([]);
      setCurrentTime("");
      setHasReceivedLiveUpdate(false);
      return;
    }

    const socket: Socket = io(EV_SOCKET_URL);

    socket.on("connect", () => {
      console.log("Connected to EV live data server");
    });

    socket.on("charging_update", (data: ChargingPayload) => {
      if (typeof data.time === "number") {
        setCurrentTime(formatSimTime(data.time));
      }

      const stations = Array.isArray(data.stations) ? data.stations : [];
      setHasReceivedLiveUpdate(true);
      setLiveStations(stations);
      onStationsChange(stations.length);
    });

    return () => {
      socket.disconnect();
    };
  }, [isLiveRunning, onStationsChange]);

  const stationsByOsmId = useMemo(() => {
    const map: Record<string, EVStation> = {};
    evStations.forEach((station) => {
      if (station.linkId) {
        map[String(station.linkId)] = station;
      }
    });
    return map;
  }, [evStations]);

  const liveStationsByMatsimLinkId = useMemo(() => {
    const map: Record<string, LiveChargingStation> = {};
    liveStations.forEach((station) => {
      map[String(station.linkId)] = station;
    });
    return map;
  }, [liveStations]);

  const selectedExistingStation = selectedRoad ? stationsByOsmId[selectedRoad.osmId] ?? null : null;
  const selectedLiveStation = selectedRoad ? liveStationsByMatsimLinkId[selectedRoad.matsimLinkId] ?? null : null;

  const liveSummary = useMemo(() => {
    return liveStations.reduce(
      (summary, station) => {
        summary.totalPorts += station.plugCount;
        summary.occupiedPorts += station.occupiedPorts;
        summary.waitingVehicles += station.queueLength;
        if (station.queueLength > 0) {
          summary.queueingStations += 1;
        }
        return summary;
      },
      { totalPorts: 0, occupiedPorts: 0, waitingVehicles: 0, queueingStations: 0 }
    );
  }, [liveStations]);

  const roadLayer = useMemo(
    () =>
      new GeoJsonLayer({
        id: "road-layer",
        data: staticGeoJson,
        lineWidthScale: 10,
        getLineColor: (feature: any): [number, number, number, number] => {
          if (isLiveRunning) {
            if (!hasReceivedLiveUpdate) {
              const osmId = String(feature.properties?.osm_id ?? "");
              return stationsByOsmId[osmId] ? [0, 255, 0, 255] : [80, 85, 100, 180];
            }

            const matsimLinkId = String(feature.properties?.link_id ?? "");
            const station = liveStationsByMatsimLinkId[matsimLinkId];

            if (!station) return [80, 85, 100, 180];
            if (station.queueLength > 0) return [255, 0, 0, 255];
            if (station.full) return [255, 165, 0, 255];
            if (station.occupiedPorts > 0) return [255, 255, 0, 255];
            return [0, 255, 0, 255];
          }

          const osmId = String(feature.properties?.osm_id ?? "");
          return stationsByOsmId[osmId] ? [0, 255, 0, 255] : [80, 85, 100, 180];
        },
        getLineWidth: (feature: any): number => {
          if (isLiveRunning) {
            if (!hasReceivedLiveUpdate) {
              const osmId = String(feature.properties?.osm_id ?? "");
              return stationsByOsmId[osmId] ? 2 : 1;
            }

            const matsimLinkId = String(feature.properties?.link_id ?? "");
            return liveStationsByMatsimLinkId[matsimLinkId] ? 2 : 1;
          }

          const osmId = String(feature.properties?.osm_id ?? "");
          return stationsByOsmId[osmId] ? 2 : 1;
        },
        pickable: true,
        autoHighlight: true,
        highlightColor: [200, 230, 255, 200] as [number, number, number, number],
        onClick: (info: any) => {
          if (!info.object?.properties) {
            setSelectedRoad(null);
            return;
          }

          const props = info.object.properties;
          const coords: [number, number][] = info.object.geometry.coordinates;

          setSelectedRoad({
            osmId: String(props.osm_id ?? ""),
            matsimLinkId: String(props.link_id ?? ""),
            name: props.name ?? props.osm_id ?? "Unnamed Road",
            coordinates: getRoadMidpoint(coords),
          });
          setForm(DEFAULT_FORM);
        },
        updateTriggers: {
          getLineColor: [isLiveRunning, hasReceivedLiveUpdate, stationsByOsmId, liveStationsByMatsimLinkId],
          getLineWidth: [isLiveRunning, hasReceivedLiveUpdate, stationsByOsmId, liveStationsByMatsimLinkId],
        },
      }),
    [staticGeoJson, isLiveRunning, hasReceivedLiveUpdate, stationsByOsmId, liveStationsByMatsimLinkId]
  );

  const handleAddStation = async () => {
    if (!selectedRoad) return;

    setSaving(true);
    try {
      const res = await fetch("/api/electric-vehicles/charging-station", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: selectedRoad.osmId,
          matsimLinkId: selectedRoad.matsimLinkId,
          capacity: form.capacity,
          plugPower: form.plugPower,
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
    if (!selectedExistingStation) return;

    setSaving(true);
    try {
      const res = await fetch("/api/electric-vehicles/charging-station", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedExistingStation.id }),
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
        views={deckView}
        viewState={viewState}
        controller
        onViewStateChange={({ viewState }) => {
          setViewState((prev) => ({
            longitude: Math.min(CITY_BOUNDS.east, Math.max(CITY_BOUNDS.west, viewState.longitude ?? prev.longitude)),
            latitude: Math.min(CITY_BOUNDS.north, Math.max(CITY_BOUNDS.south, viewState.latitude ?? prev.latitude)),
            zoom: viewState.zoom ?? prev.zoom,
            pitch: viewState.pitch ?? prev.pitch ?? 0,
            bearing: viewState.bearing ?? prev.bearing ?? 0,
            minZoom: prev.minZoom,
            maxZoom: prev.maxZoom,
          }));
        }}
        layers={[roadLayer]}
      >
        <Map reuseMaps mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
      </DeckGL>

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "white",
          padding: "10px 20px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0" }}>{isLiveRunning ? "Live Charging" : "Charging Stations"}</h3>
        {isLiveRunning ? (
          <>
            <p style={{ margin: 0 }}>
              Active Stations: <strong>{shouldDisplayLiveSnapshot ? liveStations.length : evStations.length}</strong>
            </p>
            <p style={{ margin: "5px 0 0 0" }}>
              Occupied Ports: <strong>{shouldDisplayLiveSnapshot ? liveSummary.occupiedPorts : "--"}</strong> / {shouldDisplayLiveSnapshot ? liveSummary.totalPorts : "--"}
            </p>
            <p style={{ margin: "5px 0 0 0" }}>
              Waiting Vehicles: <strong>{shouldDisplayLiveSnapshot ? liveSummary.waitingVehicles : "--"}</strong>
            </p>
            <p style={{ margin: "5px 0 0 0" }}>Time: {currentTime || "Waiting for live updates..."}</p>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Stations: <strong>{evStations.length}</strong>
            </p>
            <p style={{ margin: "5px 0 0 0", color: "#888", fontSize: 13 }}>
              {loading ? "Loading..." : "Click a road to add or remove a station"}
            </p>
          </>
        )}
      </div>

      {selectedRoad && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 80,
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            width: "340px",
            zIndex: 10,
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Street Details</h3>
          <p>
            <strong>Name:</strong> {selectedRoad.name}
          </p>
          <p>
            <strong>OSM ID:</strong> {selectedRoad.osmId}
          </p>

          {shouldDisplayLiveSnapshot ? (
            <>
              {selectedLiveStation ? (
                <>
                  <div
                    style={{
                      margin: "10px 0",
                      padding: "10px",
                      borderRadius: "4px",
                      backgroundColor:
                        selectedLiveStation.queueLength > 0
                          ? "#ffebee"
                          : selectedLiveStation.full
                            ? "#fff3e0"
                            : selectedLiveStation.occupiedPorts > 0
                              ? "#fffde7"
                              : "#e8f5e9",
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      <strong>Status:</strong> {selectedLiveStation.status}
                    </p>
                    <p style={{ margin: "5px 0 0 0" }}>
                      <strong>Ports:</strong> {selectedLiveStation.occupiedPorts} occupied / {selectedLiveStation.plugCount}
                    </p>
                    <p style={{ margin: "5px 0 0 0" }}>
                      <strong>Queue:</strong> {selectedLiveStation.queueLength} vehicle(s)
                    </p>
                    <p style={{ margin: "5px 0 0 0" }}>
                      <strong>Power:</strong> {selectedLiveStation.plugPowerKw} kW
                    </p>
                  </div>

                  <div style={{ marginTop: "12px", fontSize: 13, color: "#444" }}>
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Charging vehicles:</strong>{" "}
                      {selectedLiveStation.chargingVehicles.length > 0
                        ? selectedLiveStation.chargingVehicles.join(", ")
                        : "None"}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Queued vehicles:</strong>{" "}
                      {selectedLiveStation.queuedVehicles.length > 0
                        ? selectedLiveStation.queuedVehicles.join(", ")
                        : "None"}
                    </p>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    margin: "10px 0",
                    padding: "10px",
                    borderRadius: "4px",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong>Status:</strong> No live charging station on this link
                  </p>
                </div>
              )}
            </>
          ) : isLiveRunning ? (
            <>
              <div
                style={{
                  margin: "10px 0",
                  padding: "10px",
                  borderRadius: "4px",
                  backgroundColor: selectedExistingStation ? "#e8f5e9" : "#f5f5f5",
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong> Waiting for first live snapshot
                </p>
                {selectedExistingStation && (
                  <>
                    <p style={{ margin: "5px 0 0 0" }}>
                      <strong>Configured capacity:</strong> {selectedExistingStation.capacity} ports
                    </p>
                    <p style={{ margin: "5px 0 0 0" }}>
                      <strong>Configured power:</strong> {selectedExistingStation.plugPower} kW
                    </p>
                  </>
                )}
              </div>
            </>
          ) : selectedExistingStation ? (
            <>
              <div
                style={{
                  margin: "10px 0",
                  padding: "10px",
                  borderRadius: "4px",
                  backgroundColor: "#e8f5e9",
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong> Charging Station Available
                </p>
                <p style={{ margin: "5px 0 0 0" }}>
                  <strong>Capacity:</strong> {selectedExistingStation.capacity} ports
                </p>
                <p style={{ margin: "5px 0 0 0" }}>
                  <strong>Power:</strong> {selectedExistingStation.plugPower} kW
                </p>
              </div>
              <button
                onClick={handleRemoveStation}
                disabled={saving}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  padding: "8px",
                  background: saving ? "#ccc" : "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Removing..." : "Remove Station"}
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  margin: "10px 0",
                  padding: "10px",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong> No Station
                </p>
              </div>

              {live && status === "STOPPED" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                  {([
                    { label: "Capacity (ports)", key: "capacity" },
                    { label: "Power per port (kW)", key: "plugPower" },
                  ] as { label: string; key: keyof typeof form }[]).map(({ label, key }) => (
                    <div key={key}>
                      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 2 }}>{label}</label>
                      <input
                        type="number"
                        min={1}
                        value={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          border: "1px solid #ddd",
                          fontSize: 13,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleAddStation}
                disabled={saving}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  padding: "8px",
                  background: saving ? "#ccc" : "#00C851",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Adding..." : live ? "Add Charging Station" : "Add Candidate Station"}
              </button>
            </>
          )}

          <button
            onClick={() => setSelectedRoad(null)}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "5px",
              cursor: "pointer",
              background: "#ccc",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
