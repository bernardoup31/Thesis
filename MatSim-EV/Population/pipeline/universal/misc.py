import pandas as pd
from enum import Enum
from pyreproj import Reprojector
from shapely.geometry import Point
from shapely.geometry import Polygon

class JOIN_MODE(Enum):
    BOTH=0
    LEFT=1
    RIGHT=2

    def __eq__(self, other):
        if not isinstance(other, JOIN_MODE):
            return self.value == other
        return super().__eq__(other)

class TripProfileBuilder():
    #Should check the travel Survey generic format
    def build(self, samplePopulation, keyLabels=None):
        profiles = {}
        for id, individual in samplePopulation.items():
            if type(keyLabels) == list:
                key = "|".join([individual["attributes"][key] for key in keyLabels])
            else:
                key = "|".join(list(individual["attributes"].values()))
            
            if key in profiles:
                profiles[key].append(id)
            else:
                profiles[key] = [id]
                
        return profiles

class BoundingBoxBuilder():
    def __init__(self, origin_srs="WGS84", target_srs="EPSG:3763"):
        self.coordinateTransformer = Reprojector().get_transformation_function(from_srs=origin_srs, to_srs=target_srs)
        self.origin_srs = origin_srs
        self.target_srs = target_srs

    def build(self, long1, lat1, long2, lat2):
        if self.origin_srs != self.target_srs:
            x1, y1 = self.coordinateTransformer(lat1,long1)
            x2, y2 = self.coordinateTransformer(lat2,long2)
        else:
            x1, y1 = long1, lat1
            x2, y2 = long2, lat2
        return Polygon([[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]])
    
class PlacesGenericFormat():
    def __init__(self, placesFile, origin_srs="WGS84", target_srs="EPSG:3763"):
        self.coordinateTransformer = Reprojector().get_transformation_function(from_srs=origin_srs, to_srs=target_srs)
        self.origin_srs = origin_srs
        self.target_srs = target_srs
        self.__places = pd.read_csv(placesFile)
        self.__places["x"] = self.__places.apply(lambda x: self.coordinateTransformer(x["latitude"],x["longitude"])[0],axis=1)
        self.__places["y"] = self.__places.apply(lambda x: self.coordinateTransformer(x["latitude"],x["longitude"])[1],axis=1)
        self.__places = self.__places.reset_index().rename(columns={'index':'id'})

        self.__coords = {}
        for _, row in self.__places.iterrows():
            self.__coords[row['id']] = Point(row['x'], row['y'])


    def getPlaces(self):        
        return self.__places

    def getCoords(self):
        return self.__coords