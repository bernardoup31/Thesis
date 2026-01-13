#!/bin/bash

#Download the latest OpenStreetMap data for Portugal, if not already downloaded
mkdir -p .tmp
if [ ! -f .tmp/portugal-latest.osm.pbf ]; then
    echo "Downloading Portugal OSM data..."
    curl -L -o portugal-latest.osm.pbf https://download.geofabrik.de/europe/portugal-latest.osm.pbf
fi

#Extract the Porto area from the Portugal OSM data, if not already extracted
if [ ! -f .tmp/porto-latest.osm.pbf ]; then
    echo "Extracting Porto area from Portugal OSM data..."
    osmium extract -b -8.76,41.0764,-8.4155,41.3796 .tmp/portugal-latest.osm.pbf -o .tmp/porto-latest.osm.pbf
fi

#Download the latest GTFS data for Metro do Porto

#Download the latest GTFS data for STCP

#Clone the pt2matsim repository if it doesn't exist

# Create Default OSM Config file
java -cp pt2matsim-24.4-shaded.jar:libs org.matsim.pt2matsim.run.CreateDefaultOsmConfig ../OpenOPorto/Osm2NetworkConfig.xml

# Edit OSM Config File

#Create Default Mapper Config
java -cp pt2matsim-24.4-shaded.jar org.matsim.pt2matsim.run.CreateDefaultPTMapperConfig ../OpenOPorto/.config/MetroPTMapperConfig.xml
java -cp pt2matsim-24.4-shaded.jar org.matsim.pt2matsim.run.CreateDefaultPTMapperConfig ../OpenOPorto/.config/stcpPTMapperConfig.xml

# Edit Mapper Config File 

# Create the unmmapped network
java -cp pt2matsim-24.4-shaded.jar:libs org.matsim.pt2matsim.run.Osm2MultimodalNetwork ../OpenOPorto/.config/Osm2NetworkConfig.xml

# Create the unmapped schedule for metro
java -cp pt2matsim-24.4-shaded.jar:libs org.matsim.pt2matsim.run.Gtfs2TransitSchedule ../OpenOPorto/.data/Metro_GTFS/ 20240918 EPSG:3857 ../OpenOPorto/.temp/schedule.metro.xml ../OpenOPorto/.temp/vehicles.metro.xml

# Create the unmapped schedule for stcp
java -cp pt2matsim-24.4-shaded.jar:libs org.matsim.pt2matsim.run.Gtfs2TransitSchedule ../OpenOPorto/.data/STCP_GTFS/ 20240916 EPSG:3857 ../OpenOPorto/.temp/schedule.stcp.xml ../OpenOPorto/.temp/vehicles.stcp.xml

# Map the metro schedule to network
java -cp pt2matsim-24.4-shaded.jar org.matsim.pt2matsim.run.PublicTransitMapper ../OpenOPorto/.config/MetroPTMapperConfig.xml 

# Map the stcp schedule to metro network
java -cp pt2matsim-24.4-shaded.jar org.matsim.pt2matsim.run.PublicTransitMapper ../OpenOPorto/.config/stcpPTMapperConfig.xml 

# Merge schedules
python3 ../OpenOPorto/.data/merge.py ../OpenOPorto/.temp/schedule.mapped.stcp.xml ../OpenOPorto/.temp/schedule.mapped.metro.xml ../OpenOPorto/input/schedule.xml    
