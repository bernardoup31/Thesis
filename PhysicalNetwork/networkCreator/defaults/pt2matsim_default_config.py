__default_params__ = [{"type":"routableSubnetwork","params":[("allowedTransportModes","car"),("subnetworkMode","car")]},
					  {"type":"routableSubnetwork","params":[("allowedTransportModes","bus,car"),("subnetworkMode","bus")]},
                      {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","33.333333333333336"),("freespeedFactor","1.0"),("laneCapacity","2000.0"),("lanes","2.0"),("oneway","true"),("osmKey","highway"),("osmValue","motorway")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","22.22222222222222"),("freespeedFactor","1.0"),("laneCapacity","1500.0"),("lanes","1.0"),("oneway","true"),("osmKey","highway"),("osmValue","motorway_link")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","22.22222222222222"),("freespeedFactor","1.0"),("laneCapacity","2000.0"),("lanes","2.0"),("oneway","false"),("osmKey","highway"),("osmValue","trunk")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","13.88888888888889"),("freespeedFactor","1.0"),("laneCapacity","1500.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","trunk_link")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","22.22222222222222"),("freespeedFactor","1.0"),("laneCapacity","1500.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","primary")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","16.666666666666668"),("freespeedFactor","1.0"),("laneCapacity","1500.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","primary_link")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","8.333333333333334"),("freespeedFactor","1.0"),("laneCapacity","1000.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","secondary")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","8.333333333333334"),("freespeedFactor","1.0"),("laneCapacity","1000.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","secondary_link")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","6.944444444444445"),("freespeedFactor","1.0"),("laneCapacity","600.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","tertiary")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","6.944444444444445"),("freespeedFactor","1.0"),("laneCapacity","600.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","tertiary_link")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","6.944444444444445"),("freespeedFactor","1.0"),("laneCapacity","600.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","unclassified")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","4.166666666666667"),("freespeedFactor","1.0"),("laneCapacity","600.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","residential")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","car"),("freespeed","2.7777777777777777"),("freespeedFactor","1.0"),("laneCapacity","300.0"),("lanes","1.0"),("oneway","false"),("osmKey","highway"),("osmValue","living_street")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","rail"),("freespeed","44.44444444444444"),("freespeedFactor","1.0"),("laneCapacity","9999.0"),("lanes","1.0"),("oneway","false"),("osmKey","railway"),("osmValue","rail")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","rail"),("freespeed","11.11111111111111"),("freespeedFactor","1.0"),("laneCapacity","9999.0"),("lanes","1.0"),("oneway","true"),("osmKey","railway"),("osmValue","tram")]},
					  {"type":"wayDefaultParams","params":[("allowedTransportModes","rail"),("freespeed","22.22222222222222"),("freespeedFactor","1.0"),("laneCapacity","9999.0"),("lanes","1.0"),("oneway","false"),("osmKey","railway"),("osmValue","light_rail")]}
					]

def __build_params_section__(params):
	params_strs = []
	for param in params:
		param_str = []
		param_str.append(f"""\t\t<parameterset type="{param["type"]}" >\n""")
		for p in param["params"]:
			param_str.append(f"""\t\t\t<param name="{p[0]}" value="{p[1]}" />\n""")
		param_str.append(f"""\t\t</parameterset>\n""")
		params_strs.append(''.join(param_str))
	return ''.join(params_strs)

DEFAULT_CONFIG = lambda config:\
f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE config SYSTEM "http://www.matsim.org/files/dtd/config_v2.dtd">
<config>
	<module name="OsmConverter" >
		<!-- Sets whether the detailed geometry of the roads should be retained in the conversion or not.
		Keeping the detailed paths results in a much higher number of nodes and links in the resulting MATSim network.
		Not keeping the detailed paths removes all nodes where only one road passes through, thus only real intersections
		or branchings are kept as nodes. This reduces the number of nodes and links in the network, but can in some rare
		cases generate extremely long links (e.g. for motorways with only a few ramps every few kilometers).
		Defaults to <code>false</code>. -->
		<param name="keepPaths" value="{config.get('keepPaths','false')}" />
		<!-- If true: The osm tags for ways and containing relations are saved as link attributes in the network.
		Increases filesize. Default: true. -->
		<param name="keepTagsAsAttributes" value="{config.get('keepTagsAsAttributes','true')}" />
		<!-- Keep all ways (highway=* and railway=*) with public transit even if they don't have wayDefaultParams defined -->
		<param name="keepWaysWithPublicTransit" value="{config.get('keepWaysWithPublicTransit','true')}" />
		<param name="maxLinkLength" value="{config.get('maxLinkLength','500.0')}" />
		<!-- The path to the osm file. -->
		<param name="osmFile" value="{config.get('osmFile','.tmp/map.osm.pbf')}" />
		<!-- Output coordinate system. EPSG:* codes are supported and recommended.
		Use 'WGS84' for no transformation (though this may lead to errors with PT mapping). -->
		<param name="outputCoordinateSystem" value="{config.get('outputCoordinateSystem','EPSG:3857')}" />
		<!-- CSV file containing the full geometry (including start end end node) for each link.
		This file can be used for visualization purposes in Simunto Via or GIS software. -->
		<param name="outputDetailedLinkGeometryFile" value="{config.get('outputDetailedGeometry','.tmp/detailed_geometry.csv')}" />
		<param name="outputNetworkFile" value="{config.get('outputNetworkFile','network.xml')}" />
		<!-- If true: OSM turn restrictions are parsed and written as disallowedNextLinks attribute to the first link. -->
		<param name="parseTurnRestrictions" value="{config.get('parseTurnRestrictions','false')}" />
		<!-- In case the speed limit allowed does not represent the speed a vehicle can actually realize, 
		e.g. by constrains of traffic lights not explicitly modeled, a kind of "average simulated speed" can be used.
		Defaults to false. Set true to scale the speed limit down by the value specified by the wayDefaultParams) -->
		<param name="scaleMaxSpeed" value="{config.get('scaleMaxSpeed','false')}" />
{__build_params_section__(config.get('param_sets',__default_params__))}
	</module>

</config>
"""