
require('dotenv').config();

import { ObjectId } from 'mongodb';
import { getCollections } from './db/index';

async function createJobNow(frequency: string) {
    const { testRun: TestRun } = await getCollections('testRun');

    let startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() + 20);
    let endTime = new Date(startTime);
    endTime.setSeconds(startTime.getSeconds() + 10);

    await TestRun.insertOne({
        _id: new ObjectId(),
        configDescription: 'test thingy',
        frequency,
        startTime,
        endTime,
        experimentId: null as any,
        nodeList: [],
        state: 'pending',
    });
}

// If the script was called directly

if (require.main === module) {
    
    const frequency = String(146.52e6);
    createJobNow(frequency).then(() => console.log("Done"));
    
}
