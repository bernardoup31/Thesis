import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const entityId = process.env.EV_ENTITY_ID || "urn:ngsi-ld:EVSimulationControl:001"; // Default value if not set in .env
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}/attrs`;

    const body = await request.json();
    const runMode = body.runMode || "UNKNOWN";
    const analysisConfig = body.analysisConfig || null;
    
    const payload: Record<string, any> = {
      "simulationStatus": {
        "type": "Property",
        "value": "STARTED"
      },
      "runMode": {
        "type": "Property",
        "value": runMode
      },
      "@context": [
        `${process.env.EV_CONTEXT_URL}`
      ]
    };

    if (runMode === "ANALYSIS" && analysisConfig) {
      payload.analysisConfig = {
        "type": "Property",
        "value": analysisConfig
      };
    }

    const fiwareResponse = await fetch(fiwareUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/ld+json'
      },
      body: JSON.stringify(payload)
    });

    if (!fiwareResponse.ok) {
      throw new Error(`FIWARE Error: ${fiwareResponse.status}`);
    }

    return NextResponse.json({ success: true, message: "Command successfully sent to FIWARE!" });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}