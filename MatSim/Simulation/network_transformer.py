import xml.etree.ElementTree as ET
import json
from pyproj import Transformer

def convert_matsim_to_geojson(xml_path, output_path_geojson, links_dict_path):
    print("Parsing MATSim network...")
    
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
    links_dict = {}
    for link in root.findall('./links/link'):
        link_id = link.get('id')
        from_node = link.get('from')
        to_node = link.get('to')

        road_name = "Unknown Street"
        lanes = int(float(link.get('permlanes', 1)))
        osm_id = link_id

        for attr in link.findall('./attributes/attribute'):
            attr_name = attr.get('name')
            
            if attr_name == 'osm:way:name':
                road_name = attr.text
            elif attr_name == 'osm:way:lanes':
                try:
                    lanes = int(attr.text)
                except ValueError:
                    pass # Mantain the previous value if parsing fails
            elif attr_name == 'osm:way:id':
                osm_id = attr.text

        if from_node in nodes and to_node in nodes:
            coords = [nodes[from_node], nodes[to_node]]
            
            feature = {
                "type": "Feature",
                "properties": {
                    "link_id": link_id,
                    "osm_id": osm_id,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                }
            }
            features.append(feature)
        
        if osm_id not in links_dict:
            links_dict[osm_id] = {
                "name": road_name,
                "currentLanes": lanes,
                "maxLanes": lanes
            }

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    with open(output_path_geojson, 'w') as f:
        json.dump(geojson, f, separators=(',', ':'))
    print(f"Success! Saved GeoJSON to {output_path_geojson}")

    with open(links_dict_path, 'w') as f:
        json.dump(links_dict, f, ensure_ascii=False)
    print(f"Saved links dictionary to {links_dict_path}")

convert_matsim_to_geojson('input/network.xml', 'porto_network.geojson', 'link_dict.json')