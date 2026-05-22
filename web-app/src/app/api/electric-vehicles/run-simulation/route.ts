import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from 'next/server';

async function loadOsmToMatsimLinkMap() {
  const geoJsonPath = path.join(process.cwd(), "public", "porto_network.geojson");
  const raw = await fs.readFile(geoJsonPath, "utf-8");
  const geoJson = JSON.parse(raw);

  const linkMap = new Map<string, string>();
  const features = Array.isArray(geoJson?.features) ? geoJson.features : [];

  for (const feature of features) {
    const osmId = feature?.properties?.osm_id;
    const matsimLinkId = feature?.properties?.link_id;

    if (osmId != null && matsimLinkId != null) {
      linkMap.set(String(osmId), String(matsimLinkId));
    }
  }

  return linkMap;
}

async function ensureStationsHaveMatsimLinkIds() {
  const stationsUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities?type=EVChargingStation&options=keyValues&limit=1000`;
  const response = await fetch(stationsUrl, {
    headers: {
      Accept: "application/ld+json",
      Link: `<${process.env.EV_CONTEXT_URL}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
    },
  });

  if (!response.ok) {
    throw new Error(`FIWARE Error while loading EV stations: ${response.status}`);
  }

  const stations = await response.json();
  if (!Array.isArray(stations) || stations.length === 0) {
    return;
  }

  const linkMap = await loadOsmToMatsimLinkMap();

  await Promise.all(
    stations.map(async (station) => {
      if (station?.matsimLinkId || !station?.id || !station?.linkId) {
        return;
      }

      const matsimLinkId = linkMap.get(String(station.linkId));
      if (!matsimLinkId) {
        return;
      }

      const patchResponse = await fetch(
        `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${encodeURIComponent(station.id)}/attrs`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/ld+json",
          },
          body: JSON.stringify({
            matsimLinkId: {
              type: "Property",
              value: matsimLinkId,
            },
            "@context": [process.env.EV_CONTEXT_URL],
          }),
        }
      );

      if (!patchResponse.ok) {
        throw new Error(`FIWARE Error while patching station ${station.id}: ${patchResponse.status}`);
      }
    })
  );
}

export async function PATCH(request: Request) {
  try {
    const entityId = process.env.EV_ENTITY_ID || "urn:ngsi-ld:EVSimulationControl:001"; // Default value if not set in .env
    const fiwareUrl = `${process.env.FIWARE_URL}/ngsi-ld/v1/entities/${entityId}/attrs`;

    const body = await request.json();
    const runMode = body.runMode || "UNKNOWN";
    const analysisConfig = body.analysisConfig || null;

    if (runMode === "LIVE") {
      await ensureStationsHaveMatsimLinkIds();
    }
    
    const payload: Record<string, any> = {
      "simulationStatus": {
        "type": "Property",
        "value": "STARTED"
      },
      "runMode": {
        "type": "Property",
        "value": runMode
      },
      "@context": [
        `${process.env.EV_CONTEXT_URL}`
      ]
    };

    if (runMode === "ANALYSIS" && analysisConfig) {
      payload.analysisConfig = {
        "type": "Property",
        "value": analysisConfig
      };
    }

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
