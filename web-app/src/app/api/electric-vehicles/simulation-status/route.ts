import { NextResponse } from "next/server";

export async function GET() {
    try {
        const entityId = process.env.EV_ENTITY_ID || "urn:ngsi-ld:EVSimulationControl:001"; // Default value if not set in .env
        const url = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`FIWARE Error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({
            status: data.simulationStatus?.value || "unknown",
            mapURL: data.mapURL?.value || "http://localhost:8000/output/"
        });
    }
    catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}