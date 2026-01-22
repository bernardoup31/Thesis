from .ProcessStep import ProcessStep
from enum import Enum

class PostLocationAssignActivityChainMatcher(ProcessStep):
    def __init__(self, Matcher, Assigner):
        self.matcher = Matcher
        self.assigner = Assigner

    def process(self, trips, MatcherArgs, AssignerArgs):
        matchedPopulation, err = self.matcher.process(*MatcherArgs)

        locations, errors = self.assigner.process(matchedPopulation, *AssignerArgs)
        
        records = matchedPopulation.to_dict("records")

        combined = [
            {
                "attributes": {k: v for k, v in person.items() if k != "match"},
                "trips": [
                    {**leg, "x": loc.x, "y": loc.y}
                    for leg, loc in zip(trips[person["match"]]["legs"], locations[i])
                ],
                "tripDesc": trips[person["match"]]["tripDesc"],
            }
            for i, person in enumerate(records)
        ]

        return combined, self.validate(err, errors)

    def validate(self, matcherError, assignerErrors):
        return (matcherError, *assignerErrors)

class MultiStepPopulationSynthesis(ProcessStep):
    class ItermidiateResult(Enum):
        SYNTHESIZED_POPULATION = 1
        SYNTHESIZED_ERROR = 2

    def __init__(self, PopulationSynthesizer, ActivityChainMatcher):
        self.PopulationSynthesizer = PopulationSynthesizer
        self.ActivityChainMatcher = ActivityChainMatcher

    def __synthesize(self, synthesizerArgs):
        population, error = self.PopulationSynthesizer.process(*synthesizerArgs)
        self.synthesized_population = population
        self.synthesis_error = error
    
    def synthesize(self, synthesizerArgs):
        self.__synthesize(synthesizerArgs)
        return self
    
    def __map_args(self, arg):
        if type(arg) is self.ItermidiateResult:
            if arg == self.ItermidiateResult.SYNTHESIZED_POPULATION:
                return self.synthesized_population
            elif arg == self.ItermidiateResult.SYNTHESIZED_ERROR:
                return self.synthesis_error
        else:
            return arg

    def replace(self, args):
        return tuple(self.replace(arg) if isinstance(arg, tuple) else self.__map_args(arg) for arg in args)

    def __match(self, matcherArgs):
        if self.synthesized_population is None:
            raise Exception("Population must be synthesized before matching.")

        matcherArgs = self.replace(matcherArgs)

        population, error = self.ActivityChainMatcher.process(*matcherArgs)
        self.matched_population = population
        self.matching_error = error
    
    def match(self, matcherArgs):
        self.__match(matcherArgs)
        return self

    def process(self, synthesizerArgs, matcherArgs):
        self.__synthesize(synthesizerArgs)
        self.__match(matcherArgs)
        return self.matched_population, self.validate()
    
    def validate(self):
        return (self.synthesis_error, self.matching_error)
    
def main():
    print("Testing mode...")
    print("You should not see this message, if so check your installation...")

    from .oporto.IMob.Processer import IMobProcesser
    from .external.MATSim import MATSimPopulationExporter
    from .universal.IPF.Integerizer import DefaultIntegerizer
    from .universal.misc import BoundingBoxBuilder, PlacesGenericFormat, JOIN_MODE
    from .universal.ActivityChain.locationAssigner import HeuristicLocationAssigner
    from .universal.ActivityChain.defaultActivityMatcher import DefaultActivityMatcher
    from .universal.IPF.ipfPopulationSynthesizer import IPFPopulationSynthesisWithSections

    from .oporto.data import files as TEST_FILES
    from .oporto.data.HeuristicMatcher import PlaceCategoryMapper
    from .oporto.data.matcherTesting import MAPPER_SMALL as match_mapper
    from .oporto.data.ipfTesting import DIMENSIONS_TEST_2D, DIMENSIONS_TEST_HIGH_DIM, IMPOSSIBLE_TEST_2D, IMPOSSIBLE_TEST_HIGH_DIM, DIM_VALUE_MAP, SECTIONS_VAR, SMALL_COLS, HIGH_DIM_COLS, JOIN_COLS_HIGH_DIM

    dimensions = DIMENSIONS_TEST_2D
    impossibilities = IMPOSSIBLE_TEST_2D
    cols = SMALL_COLS
    joinCols = SMALL_COLS

    reductionFactor = 0.01
    outputFile = "pipeline_test_population.xml"

    persons = IMobProcesser.read(TEST_FILES.HOUSEHOLDS,TEST_FILES.EXPENSES, TEST_FILES.VEHICLES, TEST_FILES.INCOMES, TEST_FILES.INDIVIDUALS, TEST_FILES.PASSES, TEST_FILES.TRIPS)
    
    boundingBox = BoundingBoxBuilder().build(*TEST_FILES.BOUNDING_BOX)

    places = PlacesGenericFormat(TEST_FILES.PLACES)

    ipf = IPFPopulationSynthesisWithSections(DefaultIntegerizer(dimensions, impossibilities), SECTIONS_VAR, asDF=True, labels=cols, valueMapper=DIM_VALUE_MAP)\
                                            .fromGeoPackage(TEST_FILES.GEOPACKAGE)

    assigner = HeuristicLocationAssigner(places, ipf.sectionShapes, PlaceCategoryMapper, silent=False)
    matcher = PostLocationAssignActivityChainMatcher(DefaultActivityMatcher(), assigner)

    synthesizer = MultiStepPopulationSynthesis(ipf, matcher)

    synthesizer.synthesize((dimensions, impossibilities))
    synthesizer.match(((persons,
                       (synthesizer.ItermidiateResult.SYNTHESIZED_POPULATION, persons, joinCols, match_mapper, JOIN_MODE.BOTH, reductionFactor, cols[0]),
                       (persons, boundingBox))))

    MATSimPopulationExporter(synthesizer.matched_population).as_XML().export(outputFile)
    print(f"Pipeline test population successfully exported to {outputFile}!")

if __name__ == "__main__":
    main()    