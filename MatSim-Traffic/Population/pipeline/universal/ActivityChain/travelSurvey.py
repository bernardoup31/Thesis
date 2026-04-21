class TravelSurveyGenericFormat:
    def __validate_individual(self, person):
        return isinstance(person, dict)
    
    def validate(self, population):
        return isinstance(population, dict) \
               and all(self.__validate_individual(person) for id, person in population.items())
               