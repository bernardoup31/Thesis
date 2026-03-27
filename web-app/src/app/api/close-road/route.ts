import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const { roadId } = await request.json(); // Expecting a JSON body with the road ID to be closed
    if (!roadId) {
      return NextResponse.json({ error: 'Missing roadId' }, { status: 400 });
    }
    const entityId = process.env.TRAFFIC_ENTITY_ID || "urn:ngsi-ld:TrafficSimulationControl:001"; // Default value if not set in .env
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}/attrs`;

    // The NGSI-LD payload using your local context
    const payload = {
      "closedLinkId": {
        "type": "Property",
        "value": roadId
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