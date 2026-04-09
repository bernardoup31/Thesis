import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { roadId } = await request.json(); // Expecting a JSON body with the road ID to be closed
    if (!roadId) {
      return NextResponse.json({ error: 'Missing roadId' }, { status: 400 });
    }
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entityOperations/upsert`; // Endpoint to update entity if it exists, otherwise create it

    const payload = [{
      "id": `urn:ngsi-ld:RoadSegment:${roadId}`,
      "type": "RoadSegment",
      "roadId": {
        "type": "Property",
        "value": roadId
      },
      "status": {
        "type": "Property",
        "value": "closed"
      },
      "@context": [
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",  
        "https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld" 
      ]
    }]
      

    const fiwareResponse = await fetch(fiwareUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json'
      },
      body: JSON.stringify(payload)
    });

    if (!fiwareResponse.ok) {
      throw new Error(`FIWARE Error: ${fiwareResponse.status}`);
    }

    const status = fiwareResponse.status;
    return NextResponse.json({ 
      success: true, 
      message: status === 201 ? "Entity created" : "Entity updated" 
    });

  } catch (error: any) {
    console.error("Error in /api/close-road:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}