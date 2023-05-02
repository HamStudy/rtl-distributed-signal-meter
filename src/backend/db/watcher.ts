
import { JobAttributesData } from 'agenda';
import { ChangeStream, ChangeStreamDocument, ChangeStreamUpdateDocument, Filter, Document as MongoDocument, ResumeToken } from 'mongodb';
import { getAgenda } from './agenda';
import { Experiment, NodeStatus, TestRun, TestRunData, getCollections, getDatabase } from './index';
import { LastUpdate } from './lastUpdate';

export interface DbWatchDefinition<TSchema extends MongoDocument> {
    db: string;
    collection: string | string[];
}
const watchDefs: DbWatchDefinition<any>[] = [];
function addWatchDef<TSchema extends MongoDocument>(def: DbWatchDefinition<TSchema>) {
    watchDefs.push(def);
}

function initWatchDefs(dbName: string) {
    if (watchDefs.length) { return; }
    addWatchDef({
        db: dbName,
        collection: 'nodeStatus',
    });
    addWatchDef({
        db: dbName,
        collection: 'testRun',
    });
    addWatchDef({
        db: dbName,
        collection: 'testRunData',
    });
    addWatchDef({
        db: dbName,
        collection: 'lastUpdate',
    });
}

const pingSeconds = 5;
// const failSeconds = 15;
let isShutdown = false;
export function shutdown() {
    isShutdown = true;
    if (changes) {
        changes.close();
    }
}

let agendaInitialized = false;
async function initAgenda() {
    if (agendaInitialized) { return; }
    agendaInitialized = true;
    const [
        {LastUpdate},
        agenda,
    ] = await Promise.all([
        getCollections('lastUpdate'),
        getAgenda(),
    ]);
    agenda.define('updateWatch', {lockLifetime: pingSeconds/2 * 1000}, async (job: JobAttributesData) => {
        const upd = await LastUpdate.findOneAndUpdate({_id: 'dbWatcher'}, {$set: {lastUpdate: new Date()}}, {upsert: true});
        if (!upd.value) {
            console.log("Failed to update lastUpdate");
        }
    });
    agenda.create('updateWatch', {v: 2})
        .schedule(`${pingSeconds} seconds`)
        .repeatEvery(`${pingSeconds} seconds`, {skipImmediate: false})
        .unique({name: 'updateWatch'}, {insertOnly: false})
        .save();
}

function makePipelineEntry(entry: DbWatchDefinition<any>) {
    const coll = Array.isArray(entry.collection) ? {$in: entry.collection} : entry.collection;
    const $matchFilter: Filter<ChangeStreamDocument<any>> = {
        ns: {db: entry.db, coll},
    };
    return $matchFilter;
}

type ChangeHandler<D extends MongoDocument> = (newDoc: D, changeDoc: ChangeStreamUpdateDocument<D>['updateDescription']) => void;
type ChangeFilter<D extends MongoDocument> = (newDoc: D) => boolean;
type DeleteHandler<D extends MongoDocument> = (deletedId: D['_id']) => void;

let changes: ChangeStream<any> | null;
// let watchDogInterval: ReturnType<typeof setInterval>;

// This is the failsafe; if somehow all my other checks totally fail,
// we're going to terminate this process and let another take over
// let killerWatchDogInterval = setInterval(() => {
//     if (disableWatchdog) { return; }
//     const secondsSinceLastUpdate = (Date.now() - watchDogTick) / 1000;
//     if (secondsSinceLastUpdate > failSeconds * 10) {
//         // We're at 10x longer than we wait to try to restart the watch;
//         // we're not recovering, so die Die DIE!
//         K8sLifecycle.setUnrecoverableError(new Error("dbWatcher timeout hit"));
//     }
// }, 1000 * 60 * 5);
// killerWatchDogInterval.unref(); // don't keep the process from ending

let isStarted = false;
async function startWatch() {
    if (isShutdown || isStarted) { return; }
    isStarted = true;
    const db = await getDatabase();
    await initAgenda();
    console.warn("Starting dbWatcher");
    initWatchDefs(db.databaseName);
    if (changes) {
        console.warn("dbWatcher instance already running; closing it and starting over");
        changes.close();
        changes = null;
    }
    changes = db.watch([
        {$match: {
            operationType: {$in: ['update', 'insert', 'replace', 'delete']},
            $or: watchDefs.map(d => makePipelineEntry(d)),
        }}
    ], {
        fullDocument: 'updateLookup',
        ...(startToken ? {startAfter: startToken} : {}),
    });
    changes.on('change', onChangeHandler);
    changes.on('error', err => {
        console.warn("Error in dbWatcher; closing so it will restart", err);
        changes?.close();
    });
    changes.on('close', () => {
        changes?.off('change', onChangeHandler);
        changes = null;
        if(handlers.size && !isShutdown) {
            setTimeout(() => startWatch(), 100);
            console.warn("dbWatcher close detected but handlers exist. Restarting");
        }
    });
    changes.on('resumeTokenChanged', token => {
        startToken = token;
    });
    // if (watchDogInterval) {
    //     clearInterval(watchDogInterval);
    //     watchDogInterval = void 0;
    // }
    // watchDogInterval = setInterval(() => {
    //     if (disableWatchdog || isShutdown) { return; }
    //     let secondsSinceLastUpdate = (Date.now() - watchDogTick) / 1000;
    //     if (secondsSinceLastUpdate > failSeconds) {
    //         console.warn("database watcher watchdog timeout!");
    //         // We haven't seen an update since failSeconds, something is wrong!
    //         if (changes) {
    //             changes?.close();
    //         } else {
    //             startWatch();
    //         }
    //     } else if (secondsSinceLastUpdate > (failSeconds * .6)) {
    //         console.warn(`database watcher watchdog 60% to timeout!, ${secondsSinceLastUpdate}`);
    //     }
    // }, pingSeconds * 1000);
    // watchDogInterval.unref(); // don't prevent the process from exiting
}

// type CRUKeys = 'insert' | 'update' | 'replace';
// type DelKey = 'delete';

const handlers = new Map<symbol, WatchHandler>();

export interface WatchHandler<collectionName extends string = string, DocObject extends MongoDocument = any> {
    collection: collectionName;
    onChange?: ChangeHandler<DocObject>;
    onDelete?: DeleteHandler<DocObject>;
    filter?: ChangeFilter<DocObject>;
}

export type ValidWatchHandler = never
    | WatchHandler<'nodeStatus', NodeStatus>
    | WatchHandler<'experiment', Experiment>
    | WatchHandler<'testRun', TestRun>
    | WatchHandler<'testRunData', TestRunData>
    | WatchHandler<'lastUpdate', LastUpdate>
;

export function watchDatabase(handler: ValidWatchHandler) : () => void {
    if (!changes) {
        startWatch();
    }
    const key = Symbol(`key for ${handler.collection} handler`);
    if (!handler.filter) { handler.filter = () => true; }
    handlers.set(key, handler);

    return () => {
        handlers.delete(key);
    };
}

let startToken: ResumeToken;
// let watchDogTick: ReturnType<typeof Date.now>;
async function onChangeHandler(doc: ChangeStreamDocument<any>) {
    startToken = doc._id;
    // Update current time
    // watchDogTick = Date.now();
    // console.log("Watchdog update");

    switch(doc.operationType) {
        case 'insert':
        case 'update':
        case 'replace':
        case 'delete':
            for (let handler of handlers.values()) {
                try {
                    if (handler.collection != doc.ns.coll) {
                        continue; // Wrong collection
                    }
                    if (doc.operationType == 'delete') {
                        handler.onDelete?.((<any>doc.documentKey)._id);
                    } else {
                        const updateDocs = doc.operationType == 'update' ? doc.updateDescription : null;
                        if (!doc.fullDocument && (<any>doc.documentKey)?._id) {
                            const db = await getDatabase();
                            const coll = db.collection(doc.ns.coll);
                            doc.fullDocument = await coll.findOne({_id: (<any>doc.documentKey)._id});
                        }
                        if (doc.fullDocument && (!handler.filter || handler.filter?.(doc.fullDocument))) {
                            handler.onChange?.(doc.fullDocument, updateDocs!);
                        }
                    }
                } catch (err) {
                    console.warn("Error with handler:", handler, err, doc);
                }
            }
            break;
        default:
            console.warn("Unknown operation type:", JSON.stringify(doc));
            // This shouldn't ever happen but whatever
            break;
    }
}
