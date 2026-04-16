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
    console.error("Error in /api/get-road:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}