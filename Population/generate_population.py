import argparse
import importlib
import pandas as pd
from pathlib import Path
from pipeline.oporto.IMob.Processer import IMobProcesser
from pipeline.external.MATSim import MATSimPopulationExporter
from pipeline.universal.IPF.Integerizer import DefaultIntegerizer
from pipeline.oporto.data.HeuristicMatcher import PlaceCategoryMapper
from pipeline.universal.misc import BoundingBoxBuilder, PlacesGenericFormat, JOIN_MODE
from pipeline.universal.ActivityChain.locationAssigner import HeuristicLocationAssigner
from pipeline.universal.ActivityChain.defaultActivityMatcher import DefaultActivityMatcher
from pipeline.universal.IPF.ipfPopulationSynthesizer import IPFPopulationSynthesisWithSections
from pipeline.pipeline import MultiStepPopulationSynthesis, PostLocationAssignActivityChainMatcher

class OpenOportoPopulationGenerator(MultiStepPopulationSynthesis):
    def __init__(self, config):
        self.config = config

    def generate_population(self):
        self.persons = IMobProcesser.read(self.config["FILES"]["HOUSEHOLDS"], self.config["FILES"]["EXPENSES"], self.config["FILES"]["VEHICLES"], self.config["FILES"]["INCOMES"], self.config["FILES"]["INDIVIDUALS"], self.config["FILES"]["PASSES"], self.config["FILES"]["TRIPS"])
    
        self.boundingBox = BoundingBoxBuilder().build(*self.config["BOUNDING_BOX"])

        self.places = PlacesGenericFormat(self.config["FILES"]["PLACES"])

        self.ipfMen = IPFPopulationSynthesisWithSections(DefaultIntegerizer(self.config["DIMENSIONS"]("H"), self.config["IMPOSSIBILITIES"]("H")), self.config["SECTIONS_VAR"], asDF=True, labels=self.config["COLS"], valueMapper=self.config["DIM_VALUE_MAP"]("H"))\
                                                .fromGeoPackage(self.config["FILES"]["GEOPACKAGE"])

        self.ipfWomen = IPFPopulationSynthesisWithSections(DefaultIntegerizer(self.config["DIMENSIONS"]("M"), self.config["IMPOSSIBILITIES"]("M")), self.config["SECTIONS_VAR"], asDF=True, labels=self.config["COLS"], valueMapper=self.config["DIM_VALUE_MAP"]("M"))\
                                                .fromGeoPackage(self.config["FILES"]["GEOPACKAGE"])

        assigner = HeuristicLocationAssigner(self.places, self.ipfMen.sectionShapes, PlaceCategoryMapper, silent=self.config["SILENT"], print_with_display=self.config["PRINT_WITH_DISPLAY"])
        self.ActivityChainMatcher = PostLocationAssignActivityChainMatcher(DefaultActivityMatcher(), assigner)

        print(f"Generating OpenOporto Synthetic Population...")

        self.process()

        MATSimPopulationExporter(self.matched_population).as_XML().export(self.config["FILES"]["OUTPUT"])
        print(f"Pipeline test population successfully exported to {self.config['FILES']['OUTPUT']}!")

    def process(self):
        self.PopulationSynthesizer = self.ipfMen
        self.synthesize((self.config["DIMENSIONS"]("H"), self.config["IMPOSSIBILITIES"]("H")))
        menDf = self.synthesized_population
        menErr = self.synthesis_error
        menDf["gender"] = "H"

        self.PopulationSynthesizer = self.ipfWomen
        self.synthesize((self.config["DIMENSIONS"]("M"), self.config["IMPOSSIBILITIES"]("M")))
        womenDf = self.synthesized_population
        womenErr = self.synthesis_error
        womenDf["gender"] = "M"

        self.synthesized_population = pd.concat([menDf, womenDf], ignore_index=False)
        self.synthesis_error = {"H": menErr, "M": womenErr}

        self.match(((self.persons,
                    (self.synthesized_population, self.persons, self.config["JOIN_COLS"], self.config["MATCH_MAPPER"], JOIN_MODE.BOTH, self.config["REDUCTION_FACTOR"], self.config["PRIORITY_COLS"]),
                    (self.persons, self.boundingBox))))

        return self.matched_population, self.validate()

def load_config(path):
    path = Path(path).resolve()

    spec = importlib.util.spec_from_file_location("config_module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module.config

def main():
    parser = argparse.ArgumentParser(description="Generate a Synthetic Population for OpenOPorto, based on the config file")
    parser.add_argument("config", help="Path to config file", nargs="?", default="config.py")
    args = parser.parse_args()

    config = load_config(args.config)
        
    OpenOportoPopulationGenerator(config).generate_population()

if __name__ == "__main__":
    main()
