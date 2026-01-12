class MATSimPopulationExporter():
    def __init__(self, population, ):
        self.population = population
    
    def __clean_string(self, s):
        return ''.join(e for e in s if e.isalnum())

    def __to_XML(self):
        parts = []

        parts.append('<?xml version="1.0" encoding="utf-8"?>\n')
        parts.append('<!DOCTYPE population SYSTEM "http://www.matsim.org/files/dtd/population_v6.dtd">\n')
        parts.append("<population>\n")

        activity_open = lambda leg: f"""\t\t\t<activity type="{leg['activity']}" x="{leg['x']}" y="{leg['y']}" end_time="{leg['arrival']}">\n"""
        activity_close = "\t\t\t</activity>\n"
        leg_open = "\t\t\t<leg mode=\"PT\">\n"
        leg_close = "\t\t\t</leg>\n"

        for i, person in enumerate(self.population):
            trips_xml = "".join(
                "".join([activity_open(leg), activity_close, leg_open, leg_close])
                for leg in person["trips"]
            )

            person_id = "_".join(
                self.__clean_string(str(v))
                for v in person["attributes"].values()
            )

            parts.append(f'\t<person id="{i}_{person_id}">\n')
            parts.append('\t\t<plan selected="yes">\n')
            parts.append(trips_xml)
            parts.append('\t\t</plan>\n')
            parts.append('\t</person>\n')

        parts.append("</population>")

        return "".join(parts)


    def as_XML(self):
        self.xml = self.__to_XML()
        return self
    
    def to_XML(self):
        self.xml = self.__to_XML()
        return self.xml

    def export(self, filepath):
        with open(filepath, "w") as f:
            f.write(self.xml)