import { NextResponse } from 'next/server';

export async function PATCH() {
  try {
    const entityId = "urn:ngsi-ld:TrafficSimulationControl:001";
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}/attrs`;

    // The NGSI-LD payload using your local context
    const payload = {
      "status": {
        "type": "Property",
        "value": "START"
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