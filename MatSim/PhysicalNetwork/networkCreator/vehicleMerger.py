import xml.etree.ElementTree as ET
import argparse

NS = "http://www.matsim.org/files/dtd"
NSMAP = {"m": NS}

ET.register_namespace("", NS)


def parse_xml(file_path):
    tree = ET.parse(file_path)
    return tree.getroot(), tree


def merge_vehicles(file1, file2, output_file):
    root1, tree1 = parse_xml(file1)
    root2, _ = parse_xml(file2)

    # Collect elements
    vehicle_types = []
    vehicles = []

    for root in (root1, root2):
        vehicle_types.extend(root.findall("m:vehicleType", NSMAP))
        vehicles.extend(root.findall("m:vehicle", NSMAP))

    # Remove all existing children
    for child in list(root1):
        root1.remove(child)

    # Reinsert in desired order
    for vt in vehicle_types:
        root1.append(vt)

    for v in vehicles:
        root1.append(v)

    ET.indent(tree1, space="\t", level=0)

    tree1.write(
        output_file,
        encoding="UTF-8",
        xml_declaration=True
    )


def main():
    parser = argparse.ArgumentParser(description="Merge MATSim vehicle files")
    parser.add_argument("file1")
    parser.add_argument("file2")
    parser.add_argument("output_file")
    args = parser.parse_args()

    merge_vehicles(args.file1, args.file2, args.output_file)


if __name__ == "__main__":
    main()
