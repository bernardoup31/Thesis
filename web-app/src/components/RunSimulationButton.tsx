"use client";

interface ButtonProps {
  handleSimulationFunction: () => Promise<void>;
  status: string;
  loading: boolean;
}

export default function RunSimulationButton({ handleSimulationFunction, status, loading }: ButtonProps) {
  return (
    <button 
        onClick={handleSimulationFunction} 
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
        {status === "STOPPED" && 'Run Simulation'}
        {status === "STARTED" && 'Running Simulation...'}
        {status === "FINISHED" && 'Restart Simulation'}
      </button>
  );
}