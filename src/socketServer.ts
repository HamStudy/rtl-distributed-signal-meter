import { Router } from "express";
import { WebSocket } from 'ws';

import { TestRunData, getCollections, getDatabase } from "./db/index";
import { WSMessageDoc } from './wsMessage';
import { watchDatabase } from './db/watcher';
import { v4 as uuid } from 'uuid';
import { ObjectId } from "mongodb";

export const router = Router();



function sendWsData(ws: WebSocket, data: WSMessageDoc) {
    console.warn("Sending data:", data);
    ws.send(JSON.stringify(data));
}

async function saveData(nodeId: ObjectId, data: Omit<TestRunData, '_id' | 'testRunId' | 'nodeId'>) {
    const { testRunData: TestRunData, testRun: TestRun } = await getCollections('testRunData', 'testRun');
    // First find the test run this is for
    const ts = data.timestamp;
    const testRun = await TestRun.findOne({
        startTime: {$lte: ts},
        endTime: {$gte: ts},
        frequency: data.frequency
    });
    if (!testRun) {
        console.warn("Could not find test run for data point");
        return;
    }
    await TestRunData.insertOne({
        _id: new ObjectId(),
        nodeId,
        testRunId: testRun._id,
        ...data,
    });
}

const k_PingInterval = 10000;
const k_PingTimeout = 30000;

router.get('/connectNode/:nodeId', async (req, res) => {
    // Test the route
    res.send(`OK ${req.params.nodeId}`);
});

router.ws('/connectNode/:nodeId', async (ws, req) => {
    const { nodeStatus, testRun, testRunData } = await getCollections('nodeStatus', 'testRun', 'testRunData');
    const db = await getDatabase();
    // let closing = false;

    const connection = uuid();

    let nextPingTimeout: NodeJS.Timeout | null;
    let pingTimeout: NodeJS.Timeout | null;

    function doPing() {
        
        sendWsData(ws, {type: 'ping'});
        pingTimeout = setTimeout(() => {
            console.log("Ping timeout");
        }, k_PingTimeout);
    }

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessageDoc;
        console.log("Msg received:", msg);
        switch (msg.type) {
            case 'ping':
                sendWsData(ws, {type: 'pong'});
                break;
            case 'pong':
                clearTimeout(pingTimeout!);
                pingTimeout = null;
                nextPingTimeout = setTimeout(doPing, k_PingInterval);
                nodeStatus.findOneAndUpdate({
                    name: req.params.nodeId,
                    instanceString: connection,
                }, {$set: { lastSeen: new Date() }});
                break; 
            case 'data':
                // Data received from node
                const dataDoc = msg.data;
                dataDoc.timestamp = new Date(dataDoc.timestamp);
                saveData(nodeStatusDoc.value!._id, msg.data);
                break;
        }
    });

    // let currentTestRun = await testRun.findOne({
    //     state: 'running',
    // });
    nextPingTimeout = setTimeout(doPing, k_PingInterval);

    // Connect to a websocket at opts.url:
    const nodeId = req.params.nodeId;
    console.log(`Connected to websocket for node ${nodeId}`);
    ws.on('close', () => {
        console.log(`Websocket closed for node ${nodeId}`);
        if (nextPingTimeout) clearTimeout(nextPingTimeout);
        if (pingTimeout) clearTimeout(pingTimeout);
    });
    ws.on('ping', () => {
        console.log(`Ping received for node ${nodeId}`);
    });
    ws.on('pong', () => {
        console.log(`Pong received for node ${nodeId}`);
    });

    watchDatabase({
        collection: 'testRun',
        filter: (newDoc) => true,
        onChange(newDoc, changeDoc) {
            // Test run document changed
            sendWsData(ws, {
                type: 'trUpdate',
                doc: newDoc,
            });
        },
    });
    watchDatabase({
        collection: 'nodeStatus',
        filter: (newDoc) => newDoc.name === nodeId,
        onChange(newDoc, changeDoc) {
            if (newDoc.instanceString !== connection) {
                // This connection has been pre-empted
                ws.close();
            }
        },
    });

    // Take command of this node
    const nodeStatusDoc = await nodeStatus.findOneAndUpdate({
        name: nodeId,
    }, {$set: {
        name: nodeId,
        instanceString: connection,
        lastSeen: new Date(),
        state: 'connected',
        lastIp: req.ip,
    }}, {upsert: true, returnDocument: 'after'});
});