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
*TO DO:*

*All the steps bellow should be accessible through the GUI, the GUI should not have any logic, help the user give the input and configure the requiriments that are command line arguments and configuration files*  

### Generating a Synthetic Population

Currently the pipeline has the classes to generate a population using IPF, and a location-assign heuristic based on hill climbing. 

The pipeline can be directly accessed to create a custom scenario population, by inheriting from the existing classes and applying the necessary modifications.

The pipeline namespaces are divided into `universal`, `oporto` and `external`. Which contain respectively: general classes for any synthetic population, classes and parse and interpret the information specific of Porto's scenario, and classes that are used to export or connect the pipeline to other formats and programs. The namespaces are independed of each other, but equivalent parsers to the ones in `oporto` may be needed on different enough scenarios, when building the final generator.  

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
*TO DO*

### Running a MATSim Simulation
*TO DO*

### Analysing the Simulation results
*TO DO* 

---
### Tested versions
- Python 3.12.3
- Java openjdk 17.0.17 (build 17.0.17+10-Ubuntu-124.04)
- pt2matsim 24.4
- osmium 1.16.0 (libosmium 2.20.0)
