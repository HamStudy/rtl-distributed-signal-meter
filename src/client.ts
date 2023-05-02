import { WebSocket } from "ws";
import { TestRunUpdate, WSMessageDoc } from "./shared/wsMessage";
import {
  RtlPowerEvent,
  RtlPowerWrapper,
  getNoiseFloor,
  roundToDecimals,
} from "./backend/rtlPower";

// Typescript code:
// Write a typescript function that will launch the program `rtl_power` with the specified options.
// The application will output CSV lines to stdout which need to be parsed and fired as events whenever
// they appear. If the application terminates on its own it should fire a closed event. It should be possible
// to close the application by sending a SIGINT (ctrl-c) signal to the process, which will cause it to exit.

type TestRun = TestRunUpdate['doc'];
const KnownTestRuns: TestRun[] = [];

interface WebsocketOptions {
  url: string;
  nodeId: string;
}

let shutdown = false;

// If ctrl-c is pressed trigger that we want to shut down
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down");
  shutdown = true;
  if (rtlPower) {
    rtlPower.stop();
  }
  currentSocket?.close();
  setTimeout(() => process.exit(0), 1000);
});

function sendWsData(ws: WebSocket, data: WSMessageDoc) {
  ws.send(JSON.stringify(data));
}

let rtlPower: RtlPowerWrapper;

let currentSocket: WebSocket | undefined;

function handleWsMessage(data: Buffer) {
  const msg = JSON.parse(data.toString()) as WSMessageDoc;
  console.log("Msg received:", msg);
  if (!currentSocket) { return; }

  switch (msg.type) {
    case "error":
      console.log(`Error from server: ${msg.message}`);
      break;
    case "ping":
      sendWsData(currentSocket, { type: "pong" });
      break;
    case "trUpdate":
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
}

function onRtlPower(data: RtlPowerEvent) {
  if (!currentSocket) { return; }
  const middle = Math.floor(data.samples.length / 2);
  const avg = data.samples[middle];
  // Average everything except the middle three samples as the "noise floor"
  const noiseFloor = getNoiseFloor(
    data.samples.filter(
      (_, i) => i !== middle - 1 && i !== middle && i !== middle + 1
    )
  );

  console.log(
    `Sending: ${data.centerFreq}: ${roundToDecimals(
      Math.max(avg - noiseFloor, 0),
      3
    )}`
  );
  const dataMsg: WSMessageDoc = {
    type: "data",
    data: {
      frequency: String(data.centerFreq),
      timestamp: data.timestamp,
      power: roundToDecimals(Math.max(avg - noiseFloor, 0), 3),
      rawData: data.samples,
    },
  };
  sendWsData(currentSocket!, dataMsg);
}

async function websocketClient(opts: WebsocketOptions) {
  // Connect to a websocket at opts.url:

  const ws = new WebSocket(`${opts.url}/connectNode/${opts.nodeId}`);

  ws.on("open", () => {
    console.log("Connection open");
    webSocketRunning(ws, opts.nodeId);
  });
  ws.on("close", () => {
    currentSocket = void 0;
    console.log(`Websocket closed for node ${opts.nodeId}`);

    // if shutdown isn't set then reconnect
    if (!shutdown) {
      console.log("Reconnecting in 5 seconds");
      setTimeout(() => {
        websocketClient(opts);
      }, 5000);
    }
  });
}

function webSocketRunning(ws: WebSocket, nodeId: string) {
  currentSocket = ws;
  if (!rtlPower) {
    rtlPower = new RtlPowerWrapper({
      gain: 60,
      binSize: `5K`,
    });
    rtlPower.on("data", onRtlPower);
  }

  ws.on("close", () => {
    console.log(`Websocket closed for node ${nodeId}`);
    clearInterval(statusCheckInterval);
  });
  ws.on("ping", () => {
    console.log(`Ping received for node ${nodeId}`);
    ws.pong();
  });
  ws.on("pong", () => {
    console.log(`Pong received for node ${nodeId}`);
  });

  ws.on("message", handleWsMessage);

  let statusCheckInterval = setInterval(checkCurrentStatus, 1000);
  function checkCurrentStatus() {
    // This will run every second; it will check the KnwonTestRuns array to find the soonest test run (either currently running
    // or queued) and if it is supposed to be running within 10 seconds we will start the rtl_power process for that frequency.
    // If there are no current test runs then we will stop the rtl_sdr process.

    const now = new Date();
    const soonest = KnownTestRuns.reduce((prev, cur) => {
      if (cur.endTime > now && (!prev || cur.startTime < prev.startTime)) {
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
