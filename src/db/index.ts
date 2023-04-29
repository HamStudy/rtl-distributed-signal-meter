import { Collection, MongoClient } from "mongodb";
import { Experiment, ExperimentCollection } from './experiment';
import { NodeStatus, NodeStatusCollection } from "./nodeStatus";
import { TestRun, TestRunCollection } from "./testRun";
import { TestRunData, TestRunDataCollection } from "./testRunData";
import { LastUpdate } from './lastUpdate';

export {
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

export async function getCollections(...collName: Array<keyof CollectionTypes>) {
    const conn = await connectDbClient();
    if (!conn) { throw new Error('Could not connect to DB'); }

    const db = conn.db();
    const collections = {} as any;
    const collNames = await db.listCollections().toArray();
    for (const name of collName) {
        collections[name] = db.collection(name);
        if (!collNames.some(c => c.name == name)) {
            await db.createCollection(name);
        }
    }
    return collections as { [K in keyof CollectionTypes]: Collection<CollectionTypes[K]> };
}
