import pandas as pd
from config import config
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
        self.persons = IMobProcesser.read(config["FILES"]["HOUSEHOLDS"], config["FILES"]["EXPENSES"], config["FILES"]["VEHICLES"], config["FILES"]["INCOMES"], config["FILES"]["INDIVIDUALS"], config["FILES"]["PASSES"], config["FILES"]["TRIPS"])
    
        self.boundingBox = BoundingBoxBuilder().build(*config["BOUNDING_BOX"])

        self.places = PlacesGenericFormat(config["FILES"]["PLACES"])

        self.ipfMen = IPFPopulationSynthesisWithSections(DefaultIntegerizer(config["DIMENSIONS"]("H"), config["IMPOSSIBILITIES"]("H")), config["SECTIONS_VAR"], asDF=True, labels=config["COLS"], valueMapper=config["DIM_VALUE_MAP"]("H"))\
                                                .fromGeoPackage(config["FILES"]["GEOPACKAGE"])

        self.ipfWomen = IPFPopulationSynthesisWithSections(DefaultIntegerizer(config["DIMENSIONS"]("M"), config["IMPOSSIBILITIES"]("M")), config["SECTIONS_VAR"], asDF=True, labels=config["COLS"], valueMapper=config["DIM_VALUE_MAP"]("M"))\
                                                .fromGeoPackage(config["FILES"]["GEOPACKAGE"])

        assigner = HeuristicLocationAssigner(self.places, self.ipfMen.sectionShapes, PlaceCategoryMapper, silent=config["SILENT"], print_with_display=config["PRINT_WITH_DISPLAY"])
        self.ActivityChainMatcher = PostLocationAssignActivityChainMatcher(DefaultActivityMatcher(), assigner)

        print(f"Generating OpenOporto Synthetic Population...")

        self.process()

        MATSimPopulationExporter(self.matched_population).as_XML().export(config["FILES"]["OUTPUT"])
        print(f"Pipeline test population successfully exported to {config['FILES']['OUTPUT']}!")

    def process(self):
        self.PopulationSynthesizer = self.ipfMen
        self.synthesize((config["DIMENSIONS"]("H"), config["IMPOSSIBILITIES"]("H")))
        menDf = self.synthesized_population
        menErr = self.synthesis_error
        menDf["gender"] = "H"

        self.PopulationSynthesizer = self.ipfWomen
        self.synthesize((config["DIMENSIONS"]("M"), config["IMPOSSIBILITIES"]("M")))
        womenDf = self.synthesized_population
        womenErr = self.synthesis_error
        womenDf["gender"] = "M"

        self.synthesized_population = pd.concat([menDf, womenDf], ignore_index=False)
        self.synthesis_error = {"H": menErr, "M": womenErr}

        self.match(((self.persons,
                    (self.synthesized_population, self.persons, config["JOIN_COLS"], config["MATCH_MAPPER"], JOIN_MODE.BOTH, config["REDUCTION_FACTOR"], config["PRIORITY_COLS"]),
                    (self.persons, self.boundingBox))))

        return self.matched_population, self.validate()

if __name__ == "__main__":
    OpenOportoPopulationGenerator(config).generate_population()