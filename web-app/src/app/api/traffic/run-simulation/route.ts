import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const entityId = process.env.TRAFFIC_ENTITY_ID || "urn:ngsi-ld:TrafficSimulationControl:001"; // Default value if not set in .env
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}/attrs`;

    const runMode = await request.json().then(data => data.runMode || "UNKNOWN"); // Default to LIVE if not provided
    console.log(`Received runMode: ${runMode}`);
    
    const payload = {
      "simulationStatus": {
        "type": "Property",
        "value": "STARTED"
      },
      "runMode": {
        "type": "Property",
        "value": runMode
      },
      "@context": [
        `${process.env.TRAFFIC_CONTEXT_URL}`
      ]
    };

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