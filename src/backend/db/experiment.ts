
import { ObjectId, Collection } from 'mongodb';

export interface Experiment {
    _id: ObjectId;
    name: string;
    description: string;

    created: Date;
    updatedAt: Date;
}

export type ExperimentCollection = Collection<Experiment>;
