import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${encodeURIComponent(id)}`;
    const response = await fetch(fiwareUrl, {
      headers: {
        Accept: "application/ld+json",
        Link: `<${process.env.EV_CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
      },
    });

    if (!response.ok) {
      throw new Error(`FIWARE Error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate unique ID for the new charging station
    const id = `urn:ngsi-ld:EVChargingStation:${crypto.randomUUID()}`;

    const entity = {
      id,
      type: "EVChargingStation",
      capacity: { type: "Property", value: body.capacity },
      availableCapacity: { type: "Property", value: body.capacity },
      allowedVehicleType: { type: "Property", value: ["car"] },
      status: { type: "Property", value: "working" },
      linkId: { type: "Property", value: body.linkId },
      plugPower: { type: "Property", value: body.plugPower },
      maxEnergyKwh: { type: "Property", value: body.maxEnergyKwh },
      availableEnergyKwh: { type: "Property", value: body.maxEnergyKwh },
      queuedVehicles: { type: "Property", value: 0 },
      totalEnergyDeliveredKwh: { type: "Property", value: 0 },
      "@context": [process.env.EV_CONTEXT_URL],
    };

    const response = await fetch(`${process.env.FIWARE_URL}/ngsi-ld/v1/entities`, {
      method: "POST",
      headers: { "Content-Type": "application/ld+json" },
      body: JSON.stringify(entity),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FIWARE Error: ${response.status} - ${error}`);
    }

    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    const response = await fetch(`${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`FIWARE Error: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}