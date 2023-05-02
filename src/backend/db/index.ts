import { Collection, MongoClient } from "mongodb";
import { Experiment, ExperimentCollection } from './experiment';
import { NodeStatus, NodeStatusCollection } from "./nodeStatus";
import { TestRun, TestRunCollection } from "./testRun";
import { TestRunData, TestRunDataCollection } from "./testRunData";
import { LastUpdate } from './lastUpdate';

export type {
    Experiment,
    ExperimentCollection,
    NodeStatus,
    NodeStatusCollection,
    TestRun,
    TestRunCollection,
    TestRunData,
    TestRunDataCollection,
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/signal-meter';

// Export a function that will connect to the DB or return the existing connection
// if there is one.

let dbClient: MongoClient | null = null;
let dbClientP: Promise<MongoClient> | null = null;

export async function connectDbClient() {
    if (dbClient || dbClientP) {
        return dbClient || dbClientP;
    }
    console.warn("Connecting to DB:", MONGODB_URI);
    dbClientP = MongoClient.connect(MONGODB_URI);
    dbClient = await MongoClient.connect(MONGODB_URI);
    dbClientP = null;
    return dbClient;
}

export async function closeDb() {
    if (dbClientP) {
        const conn = await dbClientP;
        await conn.close();
        dbClientP = null;
    } else if (dbClient) {
        await dbClient.close();
        dbClient = null;
    }
}

interface CollectionTypes {
    nodeStatus: NodeStatus;
    experiment: Experiment;
    testRun: TestRun;
    testRunData: TestRunData;
    lastUpdate: LastUpdate;
}

export async function getDatabase() {
    const conn = await connectDbClient();
    if (!conn) { throw new Error('Could not connect to DB'); }

    return conn.db();
}

function capitalize<T extends string>(str: T) : Capitalize<T> {
  return str.charAt(0).toUpperCase() + str.slice(1) as Capitalize<T>;
}
export async function getCollections<T extends keyof CollectionTypes>(...collName: Array<T>) {
    const conn = await connectDbClient();
    if (!conn) { throw new Error('Could not connect to DB'); }

    const db = conn.db();
    const collections = {} as any;
    const collNames = await db.listCollections().toArray();
    for (const name of collName) {
        collections[capitalize(name)] = db.collection(name as string);
        if (!collNames.some(c => c.name == name)) {
            await db.createCollection(name as string);
        }
    }
    return collections as { [K in T as Capitalize<K>]: Collection<CollectionTypes[K]> };
}
