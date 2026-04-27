import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities?type=EVChargingStation&options=keyValues&limit=1000`;
    const fiwareResponse = await fetch(fiwareUrl, {
      method: "GET",
      headers: {
        Accept: "application/ld+json",
        Link: `<${process.env.EV_CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
      },
    });

    if (!fiwareResponse.ok) {
      throw new Error(`FIWARE Error: ${fiwareResponse.status}`);
    }

    const data = await fiwareResponse.json();
    console.log(data);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error in /api/electric-vehicles/charging-stations:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}