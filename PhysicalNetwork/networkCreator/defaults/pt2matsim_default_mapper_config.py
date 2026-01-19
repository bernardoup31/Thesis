__default_params__ = [{"type":"transportModeAssignment","params":[("networkModes","car,bus"),("scheduleMode","bus")]},
                      {"type":"transportModeAssignment","params":[("networkModes","rail,light_rail"),("scheduleMode","rail")]}
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

DEFAULT_MAPPER_CONFIG = lambda config:\
f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE config SYSTEM "http://www.matsim.org/files/dtd/config_v2.dtd">
<config>
	<module name="PublicTransitMapping" >
		<!-- After nLinkThreshold link candidates have been found, additional link 
		candidates within [candidateDistanceMultiplier] * [distance to the Nth link] are added to the set.
		Must be >= 1. -->
		<param name="candidateDistanceMultiplier" value="{config.get('candidateDistanceMultiplier', '1.6')}" />
		<!-- Path to the input network file. Not needed if PTMapper is called within another class. -->
		<param name="inputNetworkFile" value="{config.get('inputNetworkFile', 'input_network.xml')}" />
		<!-- Path to the input schedule file. Not needed if PTMapper is called within another class. -->
		<param name="inputScheduleFile" value="{config.get('inputScheduleFile', 'input_schedule.xml')}" />
		<!-- The maximal distance [meter] a link candidate is allowed to have from the stop facility.
		No link candidates beyond this distance are added. -->
		<param name="maxLinkCandidateDistance" value="{config.get('maxLinkCandidateDistance', '90.0')}" />
		<!-- If all paths between two stops have a [travelCost] > [maxTravelCostFactor] * [minTravelCost], 
		an artificial link is created. If travelCostType is travelTime, minTravelCost is the travel time
		between stops from the schedule. If travelCostType is 
		linkLength minTravel cost is the beeline distance. -->
		<param name="maxTravelCostFactor" value="{config.get('maxTravelCostFactor', '5.0')}" />
		<!-- All links that do not have a transit route on them are removed, except the ones 
		listed in this set (typically only car). Separated by comma. -->
		<param name="modesToKeepOnCleanUp" value="{config.get('modesToKeepOnCleanUp', 'car')}" />
		<!-- Number of link candidates considered for all stops, depends on accuracy of stops and desired 
		performance. Somewhere between 4 and 10 seems reasonable for bus stops, depending on the
		accuracy of the stop facility coordinates and performance desires. Default: 6 -->
		<param name="nLinkThreshold" value="{config.get('nLinkThreshold', '6')}" />
		<!-- Defines the number of numOfThreads that should be used for pseudoRouting. Default: 2. -->
		<param name="numOfThreads" value="{config.get('numOfThreads', '2')}" />
		<!-- Path to the output network file. Not needed if PTMapper is used within another class. -->
		<param name="outputNetworkFile" value="{config.get('outputNetworkFile', 'network.xml')}" />
		<!-- Path to the output schedule file. Not needed if PTMapper is used within another class. -->
		<param name="outputScheduleFile" value="{config.get('outputScheduleFile', 'schedule.xml')}" />
		<!-- Path to the output car only network file. The input multimodal map is filtered. 
		Not needed if PTMapper is used within another class. -->
		<param name="outputStreetNetworkFile" value="{config.get('outputStreetNetworkFile', 'output_street_network.xml')}" />
		<!-- If true, stop facilities that are not used by any transit route are removed from the schedule. Default: true -->
		<param name="removeNotUsedStopFacilities" value="{config.get('removeNotUsedStopFacilities', 'true')}" />
		<!-- The travel cost of a link candidate can be increased according to its distance to the
		stop facility x2. This tends to give more accurate results. If travelCostType is travelTime, freespeed on 
		the link is applied to the beeline distance. -->
		<param name="routingWithCandidateDistance" value="{config.get('routingWithCandidateDistance', 'true')}" />
		<!-- After the schedule has been mapped, the free speed of links can be set according to the necessary travel 
		times given by the transit schedule. The freespeed of a link is set to the minimal value needed by all 
		transit routes passing using it. This is recommended for "artificial", additional 
		modes (especially "rail", if used) can be added, separated by commas. -->
		<param name="scheduleFreespeedModes" value="{config.get('scheduleFreespeedModes', 'artificial')}" />
		<!-- Defines which link attribute should be used for routing. Possible values "linkLength" (default) 
		and "travelTime". -->
		<param name="travelCostType" value="{config.get('travelCostType', 'linkLength')}" />
{__build_params_section__(config.get('param_sets',__default_params__))}
	</module>

</config>
"""