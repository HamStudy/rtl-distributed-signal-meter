
import { ObjectId, Collection } from 'mongodb';

export interface Experiment {
    _id: ObjectId;
    name: string;
    description: string;

    startTime: Date;
    endTime: Date;
}

export type ExperimentCollection = Collection<Experiment>;
