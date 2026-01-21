# OpenOPorto: Porto's Multimodal Network Simulation
## Modular Dynamic-Synthetic-Population Pipeline + MATSim Scenario-Setup Tool  

### Setup

#### Setup Python version and venv (Recomended, using pyenv)
```bash
pyenv install 3.12.3 
pyenv local 3.12.3
python -m venv .venv
source .venv/bin/activate
```

#### Check that java and osmium are installed, and their versions
```bash
java --version
osmium --version
``` 

#### Install requirements

```bash
pip install -r requirements.txt
```

### Using the GUI
*Work in progress*

*All the steps bellow should be accessible through the GUI, the GUI should not have any logic, help the user give the input and configure the requiriments that are command line arguments and configuration files*  

### Generating a Synthetic Population

Currently the pipeline has the classes to generate a population using IPF, and a location-assign heuristic based on hill climbing. 

The pipeline can be directly accessed to create a custom scenario population, by inheriting from the existing classes and applying the necessary modifications.

The pipeline modules are divided into `universal`, `oporto` and `external`. Which contain respectively: general classes for any synthetic population, classes and parse and interpret the information specific of Porto's scenario, and classes that are used to export or connect the pipeline to other formats and programs. The modules are independed of each other, but equivalent parsers to the ones in `oporto` may be needed on different enough scenarios, when building the final generator.  

**The `generate_population.py` file can be considered an example of how to use the pipeline to create a specific scenario populatio, as it is used to create Porto's** 

To generate the OpenOPorto Synthetic population copy the required files the `Population/.data/` folder, and use the given `config.py` file.

Then run:
```bash
python generate_poppulation.py
```

The file `config.py` fields can be understood with the following categories:

**Behavior**
- `SILENT` disables the program printing
- `PRINT_WITH_DISPLAY` uses the `display` function of interactive python notebooks, instead of `print`

**Files**

The synthesizer uses The Portuguese National Institute of Statistics data to generate the population. This comes from main origins, the partial population distribution in the statisticall sections, that is publicly available; and a travel survey, that is available under request, for research uses.

Additionally the location assigner uses OpenStreetMap information to assign points of interest to flagged activity chains from the survey.

- `GEOPACKAGE` is the path to the population distributed in the statistical sections
- `HOUSEHOLDS`, `EXPENSES`, `VEHICLES`, `INCOMES`, `INDIVIDUALS`, `PASSES`, `TRIPS` are the paths to the travel survey files
- `PLACES` contains the PoIs from OSM, a csv with `category, latitude, longitude
- `OUTPUT` is the final file where the population will be stored

**Population Generation**
- `REDUCTION_FACTOR` multiplication factor to reduce the population final size, mostly for testing. A value of `1` will keep the population full size 
- `BOUNDING_BOX` Used by the location assigner heuristic to limit the points it assigns to activities.
- `SECTIONS_VAR` Porto's data is given by statistical section, this is the name of the column on the geopackage
- `COLS` the name of the geopackage attributes, for the table, since the original names are not always much readable
- `DIM_VALUE_MAP` this maps the values from the geopackage columns into meaningfull readable values

**Activity Matcher**
- `PRIORITY_COLS` when matching the individuals from the synthetic population to the travel survey this attribute is prioritized, only if a perfect match is not found
- `JOIN_COLS` the columns present in both the population and the travel survey, to match the individuals
- `MATCH_MAPPER` the join columns may not have compatible values, since thay are discrete, so a mapping is needed, this can be one to many, one to one, and many to many, represented by lists

**IPF parameters**
- `DIMENSIONS` from the whole geopackage what are the columns to be considered as priors on the IPF calculation
- `IMPOSSIBILITIES` which cells on the IPF are to be marked as zero by default, that means that combination of characteristics should not have valid individuals

### Setting-up the physical network 
The network generator is more of a wrapper for a process of collecting, transforming and merging data into the MATSim format.
It consists of the following steps:

1. Collect smallest map available from OSM that contains the studied area
2. Crop from this map the actual studied area
3. Collect the GTFS feeds for the scenario public transport
4. Generate the network with this data

For this two external tools are used: [pt2matsim](https://github.com/matsim-org/pt2matsim) to convert convert OSM and GTFS data into the MATSim format; and [osmium](https://osmcode.org/osmium-tool/) to crop the OSM map.

The classes available on the `networkGenerator` module can also be extended to handle different scenarios specificities. And the `generate_network.py` file can be used as an example on how to do that.

To generate the network for Porto, the given `config.py` file can be used as is, no other data is needed, it should download all by itself. The file can be modified for similar scenarios.

Then run:
```bash
python generate_network.py
```

To edit the `config.py` file there are the following attributes:

**Behavior**
- `CLEAN_TMP` should erease the `.tmp` folder, with the temporary files of the process, at the end
- `SKIP_DOWNLOADS` should skip downloading files that already exist
- `SKIP_CROPPING` should skip cropping the map if the cropped file already exists  
- `AUTO_INSTALL_REQUIREMENTS` should try to install the external tools (osmium and java) in case they don't exist

**Outputs**
- `OUTPUT_NETWORK`, `OUTPUT_SCHEDULE`, `OUTPUT_VEHICLES` paths to the final output files that will result from the process

**OSM**
- `CRS` the coordinate system to keep consistent between all the sources
- `OSM.FILE` the path to the map that will be downloaded
- `OSM.URL` the url to the OSM map ([geofabrik](https://www.geofabrik.de/) is recommended)
- `OSM.BOUNDING_BOX` (*Optional*) the coordinates (in WGS84) of the bounding box of the scenario cropped map
- `OSM.CROP_FILE` (*Optional*) the path that will store the cropped file

**Public Transport**
- `PUBLIC_TRANSPORT` a dict with as many public transport sources as will be used in the scenario
- `PUBLIC_TRANSPORT.key` the key of each dict element, must be unique, to identify the sources
- `PUBLIC_TRANSPORT[key].URL` the url to the GTFS feed (as a zip) for that source 
- `PUBLIC_TRANSPORT[key].DATE` the date of that source feed

### Running a MATSim Simulation
*Work in progress*

### Analysing the Simulation results
*Work in progress*

---
### Tested versions
- Python 3.12.3
- Java openjdk 17.0.17 (build 17.0.17+10-Ubuntu-124.04)
- pt2matsim 24.4
- osmium 1.16.0 (libosmium 2.20.0)
