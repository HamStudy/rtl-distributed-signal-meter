
import '../dotenv';

import { ObjectId } from 'mongodb';
import { getCollections } from './db/index';

async function createExpNow(name: string, desc: string) {
    const { Experiment } = await getCollections('experiment');

    let startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() + 20);
    let endTime = new Date(startTime);
    endTime.setSeconds(startTime.getSeconds() + 10);

    const doc = await Experiment.insertOne({
        _id: new ObjectId(),
        name, description: desc,
        created: new Date(),
        updatedAt: new Date(),
    });

    return doc.insertedId;
}

// If the script was called directly

if (require.main === module) {

    if (process.argv.length < 4) {
        console.error(`Usage: node makeExperiment "<name>" "<description>"`);
        process.exit(1);
    }

    const [name, desc] = process.argv.slice(-2);
    createExpNow(name, desc).then(docId => {
        console.log("Done: ", docId);
        process.exit(0);
    });

}
