import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roadId = searchParams.get('roadId');

    if (!roadId) {
      return NextResponse.json({ error: 'Missing roadId' }, { status: 400 });
    }

    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/urn:ngsi-ld:RoadSegment:${roadId}`;

    const fiwareResponse = await fetch(fiwareUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/ld+json',
        'Link': '<https://raw.githubusercontent.com/smart-data-models/dataModel.Transportation/master/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
      }
    });

    if (!fiwareResponse.ok) {
      throw new Error(`FIWARE Error: ${fiwareResponse.status}`);
    }

    const data = await fiwareResponse.json();
    console.log(data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error in /api/traffic/get-road:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


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