from abc import ABC, abstractmethod

class ProcessStep(ABC):
    @abstractmethod
    def process(self,data):
        pass

    @abstractmethod
    def validate(self,data):
        pass