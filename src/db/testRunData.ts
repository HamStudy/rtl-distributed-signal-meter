
import { ObjectId, Collection } from "mongodb";

export interface TestRunData {
    _id: ObjectId;

    // The test run that this data is a part of.
    testRunId: ObjectId;

    // The node that this data is from.
    nodeId: ObjectId;

    // The frequency that this data was collected at.
    frequency: string;

    // The timestamp of the data point
    timestamp: Date;

    // The normalized power level of the data point
    power: number;

    // The raw data from the RTL-SDR
    rawData: number[];
}

export type TestRunDataCollection = Collection<TestRunData>;
