
import { ObjectId, Collection } from 'mongodb';

export interface TestRun {
    _id: ObjectId;

    // The experiment that this test run is a part of.
    experimentId: ObjectId;

    // The frequency that this test run was performed at.
    frequency: string;

    // The configuration for the test run
    configDescription: string;

    // The state of the test run -- all nodes should react to this
    state: 'pending' | 'queued' | 'running' | 'complete';

    // The planned start time of the test run
    startTime: Date;

    // The end time for the test run
    endTime: Date;

    // The nodes that are a part of this test run
    nodeList: ObjectId[];
}

export type TestRunCollection = Collection<TestRun>;
