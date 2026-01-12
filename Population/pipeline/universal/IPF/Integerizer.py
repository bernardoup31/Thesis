import numpy as np
from ...ProcessStep import ProcessStep

class DefaultIntegerizer(ProcessStep):
    
    def __init__(self, columns=[], impossibilities=[]):
        self.columns = columns
        self.impossibilities = impossibilities

    def __setImpossiblesAsZeros(self, data):
        dims = [np.array(d) for d in self.columns]
        forbs = np.array(self.impossibilities)

        all_forb = np.column_stack([
            np.nonzero(dim[:, None] == forbs[:, i])[0]
            for i, dim in enumerate(dims)
        ])

        forb_idx = tuple(np.array(all_forb).T)

        forb_sum = data[forb_idx].sum()

        num_rest = data.size - len(all_forb)

        redistrib = forb_sum / num_rest

        data += redistrib
        data[forb_idx] = 0
        return data

    def process(self, data):

        #First redestribute evenly the impossibilities that may have gotten some residual value
        if len(self.impossibilities) > 0:
            data = self.__setImpossiblesAsZeros(data)

        #Then integerize them
        floors = np.floor(data)
        reminders = data - floors

        select = int(round(data.sum()) - floors.sum())

        top_idx = np.column_stack(np.unravel_index(np.argsort((-reminders).ravel()), reminders.shape))[:select]

        np.add.at(floors, tuple(top_idx.T), 1)

        return floors, 0
    
    def validate(self, data):
        return data