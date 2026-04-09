import xml.etree.ElementTree as ET
import json
from pyproj import Transformer

def convert_matsim_to_geojson(xml_path, output_path):
    print("Parsing MATSim network and optimizing size...")
    
    transformer = Transformer.from_crs("EPSG:3763", "EPSG:4326", always_xy=True)
    tree = ET.parse(xml_path)
    root = tree.getroot()

    nodes = {}
    for node in root.findall('./nodes/node'):
        node_id = node.get('id')
        x_meters = float(node.get('x'))
        y_meters = float(node.get('y'))
        
        longitude, latitude = transformer.transform(x_meters, y_meters)
        nodes[node_id] = [round(longitude, 5), round(latitude, 5)]

    features = []
    for link in root.findall('./links/link'):
        link_id = link.get('id')
        from_node = link.get('from')
        to_node = link.get('to')

        if from_node in nodes and to_node in nodes:
            coords = [nodes[from_node], nodes[to_node]]
            
            feature = {
                "type": "Feature",
                "properties": {
                    "link_id": link_id
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                }
            }
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    with open(output_path, 'w') as f:
        json.dump(geojson, f, separators=(',', ':'))
    
    print(f"Success! Saved GeoJSON to {output_path}")

convert_matsim_to_geojson('input/network.xml', 'porto_network_min.geojson')