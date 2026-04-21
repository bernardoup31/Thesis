import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const { roadId, status, statusDescription } = await request.json(); 

    if (!roadId || !status || statusDescription === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/urn:ngsi-ld:RoadSegment:${roadId}/attrs`;

    const payload = {
      "status": {
        "type": "Property",
        "value": status
      },
      "statusDescription": {
        "type": "Property",
        "value": String(statusDescription)
      },
      "@context": [
        "https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld" 
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
      throw new Error(`FIWARE Error: ${fiwareResponse.status} - ${await fiwareResponse.text()}`);
    }

    const responseStatus = fiwareResponse.status;
    
    return NextResponse.json({ 
      success: true, 
      message: responseStatus === 204 ? "Entity updated successfully" : "Entity processed" 
    });

  } catch (error: any) {
    console.error("Error in /api/traffic/update-road:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}