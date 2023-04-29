
import {WebSocket} from 'ws';
import { WSMessageDoc } from './wsMessage';
import { RtlPowerEvent, RtlPowerWrapper, getNoiseFloor, roundToDecimals } from './rtlPower';

import { TestRun } from './db/testRun';

// Typescript code:
// Write a typescript function that will launch the program `rtl_power` with the specified options.
// The application will output CSV lines to stdout which need to be parsed and fired as events whenever
// they appear. If the application terminates on its own it should fire a closed event. It should be possible
// to close the application by sending a SIGINT (ctrl-c) signal to the process, which will cause it to exit.

const KnownTestRuns: TestRun[] = [];

interface WebsocketOptions {
    url: string;
    nodeId: string;
}


function sendWsData(ws: WebSocket, data: WSMessageDoc) {
    ws.send(JSON.stringify(data));
}

async function websocketClient(opts: WebsocketOptions) {
    // Connect to a websocket at opts.url:

    const ws = new WebSocket(`${opts.url}/connectNode/${opts.nodeId}`);
    
    ws.on('open', () => {
        webSocketRunning(ws, opts.nodeId);
    });
}

function webSocketRunning(ws: WebSocket, nodeId: string) {
    const rtlPower = new RtlPowerWrapper({});

    ws.on('close', () => {
        console.log(`Websocket closed for node ${nodeId}`);
        clearInterval(statusCheckInterval);
    });
    ws.on('ping', () => {
        console.log(`Ping received for node ${nodeId}`);
        ws.pong();
    });
    ws.on('pong', () => {
        console.log(`Pong received for node ${nodeId}`);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as WSMessageDoc;
        console.log("Msg received:", msg);

        switch(msg.type) {
            case 'error':
                console.log(`Error from server: ${msg.message}`);
                break;
            case 'ping':
                sendWsData(ws, {type: 'pong'});
                break;
            case 'trUpdate':
                console.log(`Test run update: ${msg.doc}`);
                const trDoc = msg.doc;
                trDoc.startTime = new Date(trDoc.startTime);
                trDoc.endTime = new Date(trDoc.endTime);
                const found = KnownTestRuns.find((tr) => tr._id === msg.doc._id);
                if (found) {
                    Object.assign(found, msg.doc);
                } else {
                    KnownTestRuns.push(msg.doc);
                }
                break;
        }
    });

    rtlPower.on('data', (data: RtlPowerEvent) => {
        const middle = Math.floor(data.samples.length / 2);
        const avg = data.samples[middle];
        // Average everything except the middle three samples as the "noise floor"
        const noiseFloor = getNoiseFloor(data.samples.filter((_, i) => i !== middle - 1 && i !== middle && i !== middle + 1));

        console.log(`Sending: ${data.centerFreq}: ${roundToDecimals(Math.max(avg - noiseFloor, 0), 3)}`);
        const dataMsg: WSMessageDoc = {
            type: 'data',
            data: {
                frequency: String(data.centerFreq),
                timestamp: data.timestamp,
                power: roundToDecimals(Math.max(avg - noiseFloor, 0), 3),
                rawData: data.samples,
            }
        };
        sendWsData(ws, dataMsg);
    });

    let statusCheckInterval = setInterval(checkCurrentStatus, 1000);
    function checkCurrentStatus() {
        // This will run every second; it will check the KnwonTestRuns array to find the soonest test run (either currently running
        // or queued) and if it is supposed to be running within 10 seconds we will start the rtl_power process for that frequency.
        // If there are no current test runs then we will stop the rtl_sdr process.

        const now = new Date();
        const soonest = KnownTestRuns.reduce((prev, cur) => {
            if (cur.endTime > now && (!prev || (cur.startTime < prev.startTime))) {
                return cur;
            }
            return prev;
        }, null as TestRun | null);

        if (soonest) {
            // is the test scheduled to start within 10 seconds?
            if (soonest.startTime.getTime() - now.getTime() < 10000) {
                if (!rtlPower.isRunning) {
                    rtlPower.setFrequency(parseInt(soonest.frequency));
                    rtlPower.start();
                }
            }
        } else {
            if (rtlPower.isRunning) { 
                rtlPower.stop();
            }
        }
    }
}

// If this file is run directly, start the websocket client:

if (require.main === module) {
    const opts = {
        url: process.argv[2],
        nodeId: process.argv[3],
    };
    websocketClient(opts);
}