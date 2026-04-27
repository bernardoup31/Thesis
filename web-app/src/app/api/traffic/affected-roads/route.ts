import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities?type=RoadSegment&q=statusDescription!=%221.0%22&options=keyValues&limit=1000`;
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
    console.error("Error in /api/traffic/get-affected-roads:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}