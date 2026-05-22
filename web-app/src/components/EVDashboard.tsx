"use client";

import React, { useState, useEffect } from 'react';
import RunSimulationButton from './RunSimulationButton';
import EVStationsMap from './EVStationsMap';

type SimMode = "LIVE" | "ANALYSIS";
type SimStatus = "STOPPED" | "STARTED" | "FINISHED";

type AnalysisConfig = {
  evPercentage: number;
  stationsToSelect: number;
  minPorts: number;
  maxPorts: number;
  plugPowerOptions: number[];
  baseCost: number;
  costPerPort: number;
  costPerKw: number;
};

const DEFAULT_CONFIG: AnalysisConfig = {
  evPercentage: 20,
  stationsToSelect: 0, // number of stations that should be selected by the algorithm
  minPorts: 2,
  maxPorts: 20,
  plugPowerOptions: [20, 50, 150],
  baseCost: 50000,
  costPerPort: 8000,
  costPerKw: 200,
};

const MODE_STORAGE_KEY = "evSimulationRunMode";

function normalizeStatus(value: unknown): SimStatus {
  return value === "STARTED" || value === "FINISHED" ? value : "STOPPED";
}

function Toggle({ mode, onChange, disabled }: { mode: SimMode; onChange: (m: SimMode) => void; disabled: boolean }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: '#f0f0f0',
      borderRadius: 10,
      padding: 4,
      gap: 0,
      border: '1px solid #ddd',
    }}>
      {(['LIVE', 'ANALYSIS'] as SimMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          disabled={disabled}
          style={{
            padding: '8px 22px',
            borderRadius: 7,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
            transition: 'all 0.18s ease',
            background: mode === m ? 'white' : 'transparent',
            color: mode === m ? '#111' : '#888',
            boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            opacity: disabled ? 0.55 : 1,
          }}
        >
          {m === 'LIVE' ? 'Live' : 'Analysis'}
        </button>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #ddd',
  fontSize: 14,
  background: 'white',
  boxSizing: 'border-box',
};

function AnalysisConfigPanel({ config, onChange, stationCount }: {
  config: AnalysisConfig;
  onChange: (c: AnalysisConfig) => void;
  stationCount: number;
}) {
  const set = (key: keyof AnalysisConfig, value: any) =>
    onChange({ ...config, [key]: value });

  const togglePlugPower = (kw: number) => {
    const current = config.plugPowerOptions;
    const next = current.includes(kw) ? current.filter(v => v !== kw) : [...current, kw];
    if (next.length > 0) set('plugPowerOptions', next.sort((a, b) => a - b));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Simulation */}
      <section>
        <h4 style={{ margin: '0 0 14px 0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
          Simulation
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="EV Population (%)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range" min={1} max={100} value={config.evPercentage}
                onChange={e => set('evPercentage', Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>{config.evPercentage}%</span>
            </div>
          </Field>
          <Field label={`Stations to select (max ${stationCount})`}>
            <input
              type="number" min={1} max={stationCount} value={config.stationsToSelect}
              onChange={e => set('stationsToSelect', Math.min(stationCount, Math.max(1, Number(e.target.value))))}
              style={inputStyle}
            />
            {config.stationsToSelect > stationCount && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#e74c3c' }}>
                Cannot exceed number of locations placed ({stationCount})
              </p>
            )}
          </Field>
        </div>
      </section>

      {/* Ports */}
      <section>
        <h4 style={{ margin: '0 0 14px 0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
          Ports per Station
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Minimum ports">
            <input
              type="number" min={1} max={config.maxPorts} value={config.minPorts}
              onChange={e => set('minPorts', Math.min(config.maxPorts, Math.max(1, Number(e.target.value))))}
              style={inputStyle}
            />
          </Field>
          <Field label="Maximum ports">
            <input
              type="number" min={config.minPorts} max={50} value={config.maxPorts}
              onChange={e => set('maxPorts', Math.max(config.minPorts, Number(e.target.value)))}
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      {/* Plug Power */}
      <section>
        <h4 style={{ margin: '0 0 14px 0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
          Plug Power Options
        </h4>
        <Label>Select available power levels (kW)</Label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[10, 20, 50, 100, 150, 250, 350, 500].map(kw => {
            const active = config.plugPowerOptions.includes(kw);
            return (
              <button
                key={kw}
                onClick={() => togglePlugPower(kw)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: `1.5px solid ${active ? '#111' : '#ddd'}`,
                  background: active ? '#111' : 'white',
                  color: active ? 'white' : '#666',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {kw} kW
              </button>
            );
          })}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#aaa' }}>
          Higher power = faster charging but higher cost
        </p>
      </section>

      {/* Costs */}
      <section>
        <h4 style={{ margin: '0 0 14px 0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
          Cost Parameters (€)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Base cost / station">
            <input
              type="number" min={0} value={config.baseCost}
              onChange={e => set('baseCost', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Cost / port">
            <input
              type="number" min={0} value={config.costPerPort}
              onChange={e => set('costPerPort', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Cost / kW">
            <input
              type="number" min={0} value={config.costPerKw}
              onChange={e => set('costPerKw', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ marginTop: 10, padding: '10px 14px', background: '#f7f7f7', borderRadius: 6, fontSize: 12, color: '#666' }}>
          Example: 1 station × 8 ports × 50 kW →{' '}
          <strong style={{ color: '#111' }}>
            €{(config.baseCost + 8 * config.costPerPort + 50 * config.costPerKw).toLocaleString()}
          </strong>
        </div>
      </section>
    </div>
  );
}

export default function EVDashboard() {
  const [mode, setMode] = useState<SimMode>('LIVE');
  const [status, setStatus] = useState<SimStatus>('STOPPED');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [staticGeoJson, setStaticGeoJson] = useState<any>(null);
  const [isLoadingMap, setLoadingMap] = useState(false);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  const [stationCount, setStationCount] = useState(0);

  useEffect(() => {
    const fetchInitialStatus = async () => {
      setMessage("Checking simulation status from FIWARE...");
      try {
        const res = await fetch("/api/electric-vehicles/simulation-status");
        const data = await res.json();
        const normalizedStatus = normalizeStatus(data.status);

        setStatus(normalizedStatus);

        const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
        if (savedMode === "LIVE" || savedMode === "ANALYSIS") {
          setMode(savedMode);
        } else if (data.runMode === "LIVE" || data.runMode === "ANALYSIS") {
          setMode(data.runMode);
        }

        if (normalizedStatus === "FINISHED") {
          setMessage("Simulation finished. SimWrapper is ready to open.");
        } else if (normalizedStatus === "STARTED") {
          setMessage("Simulation already running.");
        } else {
          setMessage("System stopped. Configure the stations and start the simulation.");
        }
      } catch {
        setMessage("Error connecting to the server.");
      }
    };

    fetchInitialStatus();
  }, []);

  useEffect(() => {
    setLoadingMap(true);
    fetch('/porto_network.geojson')
      .then(res => res.json())
      .then(data => { setStaticGeoJson(data); setLoadingMap(false); })
      .catch(() => setLoadingMap(false));
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status === "STARTED") {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/api/electric-vehicles/simulation-status");
          const data = await res.json();
          const normalizedStatus = normalizeStatus(data.status);

          if (normalizedStatus === "FINISHED") {
            setStatus("FINISHED");
            setMessage("Simulation finished. SimWrapper is ready to open.");
            clearInterval(interval);
          } else {
            setMessage(`Processing in background... FIWARE status: ${normalizedStatus}`);
          }
        } catch (error) {
          console.error("Error auto-checking EV simulation status:", error);
        }
      }, 5000);
    }

    return () => clearInterval(interval);
  }, [status]);

  const handleRunSimulation = async () => {
    if (mode === 'ANALYSIS' && stationCount === 0) {
      setMessage('Place at least one candidate station on the map before running analysis.');
      return;
    }
    if (mode === 'ANALYSIS' && config.stationsToSelect > stationCount) {
      setMessage(`Cannot select ${config.stationsToSelect} stations — only ${stationCount} locations placed.`);
      return;
    }

    setLoading(true);
    setMessage(`Starting simulation in ${mode} mode...`);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    try {
      const res = await fetch(`/api/electric-vehicles/run-simulation?mode=${mode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          runMode: mode,
          analysisConfig: mode === 'ANALYSIS' ? config : null 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('STARTED');
        setMessage(`Simulation started in ${mode} mode!`);
      } else {
        setMessage(`Failed to start: ${data.error}`);
      }
    } catch {
      setMessage('Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  const showMap = mode === 'LIVE' && status !== 'FINISHED';
  const showConfig = mode === 'ANALYSIS' && status === 'STOPPED';

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%' }}>

      {/* Control bar */}
      <div style={{ padding: '24px 40px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Toggle
          mode={mode}
          disabled={loading || status === "STARTED"}
          onChange={(m) => { setMode(m); setStatus('STOPPED'); setMessage(''); }}
        />

        <RunSimulationButton
          handleSimulationFunction={handleRunSimulation}
          status={status}
          loading={loading}
          additionalInfo={mode === 'LIVE' ? 'Live mode' : 'Analysis mode'}
        />

        {message && (
          <div style={{ padding: '8px 14px', background: '#f4f4f4', borderLeft: '3px solid #0070f3', borderRadius: 4, fontSize: 13, color: '#333' }}>
            {message}
          </div>
        )}
      </div>

      {/* Map — Live mode */}
      {showMap && (
        <div style={{ width: '100%', height: 'calc(100vh - 73px)', position: 'relative' }}>
          {isLoadingMap ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>
              Loading map...
            </div>
          ) : (
            <EVStationsMap staticGeoJson={staticGeoJson} live ={true} status={status} onStationsChange={setStationCount}/>
          )}
        </div>
      )}

      {/* Analysis config panel */}
      {showConfig && (
        <div style={{ margin: '40px auto', padding: '0 40px 60px' }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Analysis Configuration</h2>
            <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
              Place candidate station locations on the map, then configure the optimisation parameters below.
              The NSGA-II algorithm will find the best combination of stations, ports, and power levels.
            </p>
          </div>

          {/* Map preview for placing stations */}
          <div style={{ borderRadius: 10, overflow: 'hidden', height: 340, marginBottom: 28, border: '1px solid #eee' }}>
            {isLoadingMap ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>
                Loading map...
              </div>
            ) : (
              <EVStationsMap staticGeoJson={staticGeoJson} live={false} status={status} onStationsChange={setStationCount}/>
            )}
          </div>

          <p style={{ margin: '0 0 28px', fontSize: 13, color: '#888' }}>
            {stationCount === 0
              ? 'No candidate locations placed yet. Click roads on the map above to add stations.'
              : `${stationCount} candidate location${stationCount > 1 ? 's' : ''} placed.`}
          </p>

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 10, padding: 24 }}>
            <AnalysisConfigPanel config={config} onChange={setConfig} stationCount={stationCount} />
          </div>
        </div>
      )}

      {/* Finished */}
      {status === 'FINISHED' && (
        <div style={{
          maxWidth: 600, margin: '60px auto', textAlign: 'center',
          padding: 40, border: '2px dashed #4CAF50', borderRadius: 12,
          background: '#f9fbf9',
        }}>
          <h3 style={{ marginTop: 0 }}>Simulation finished!</h3>
          <a
            href="https://simwrapper.github.io/site/local/"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '14px 28px',
              background: '#4CAF50', color: 'white', textDecoration: 'none',
              borderRadius: 8, fontWeight: 700, fontSize: 16,
            }}
          >
            Open SimWrapper Visualization
          </a>
        </div>
      )}
    </div>
  );
}
