
import { Router } from 'express';
import { addAsync } from '@awaitjs/express';
import { TestRunData, getCollections } from '../db';
import { ObjectId } from 'mongodb';
import { getWsInstance } from '../expressWs';
import { WSMessageDoc } from '../../shared/wsMessage';
import { WebSocket } from 'ws';
import { watchDatabase } from '../db/watcher';
import pick from '../../utils/pick';
import { getNoiseFloor } from '../rtlPower';

const bareRouter = Router();
const router = addAsync(bareRouter);
export const routerPrefix = '/api';

function sendWsData(ws: WebSocket, data: WSMessageDoc) {
  console.warn("Sending data:", data);
  ws.send(JSON.stringify(data));
}

const k_PingInterval = 10000;
const k_PingTimeout = 30000;
let nextPingTimeout: NodeJS.Timeout | null;
let pingTimeout: NodeJS.Timeout | null;

function sendTestDataDoc(ws: WebSocket, inDoc: TestRunData) {
  const data = inDoc.rawData;
  const middle = Math.floor(data.length / 2);
  const avg = data[middle]*.5 + data[middle - 1]*.25 + data[middle + 1]*.25;
  const noiseFloor = getNoiseFloor(
    inDoc.rawData.filter(
      (_, i) => i !== middle - 1 && i !== middle && i !== middle + 1
    )
  );

  const doc = pick(inDoc, [
    'testRunId',
    'nodeId',
    'timestamp',
    'frequency',
    'power',
  ]);

  sendWsData(ws, {
    type: "trData",
    doc: {
      ...doc,
      testRunId: doc.testRunId.toString(),
      nodeId: doc.nodeId.toString(),
      power: Math.round(avg * 1000) / 1000,
      noiseFloor: Math.round(noiseFloor * 1000) / 1000,
    },
  });
}

export function getRouter() {
  getWsInstance().applyTo(router); // enable websocket support

  // Get experiment by ID
  router.getAsync('/exp/:expId', async (req, res) => {
    const expId = req.params.expId;
    const {Experiment} = await getCollections('experiment');

    const expDoc = await Experiment.findOne({_id: ObjectId.createFromHexString(expId)});

    res.send(expDoc);
  });

  router.deleteAsync('/exp/:expId/testrun/:trId', async (req, res) => {
    const {expId, trId} = req.params;

    const {TestRun, TestRunData} = await getCollections('testRun', 'testRunData');
    const trDoc = await TestRun.findOne({_id: ObjectId.createFromHexString(trId), experimentId: ObjectId.createFromHexString(expId)});
    if (!trDoc) {
      res.status(404).send();
      return;
    }
    // Delete all associated TestRunData
    const delDataRes = await TestRunData.deleteMany({testRunId: trDoc._id});
    console.log("Deleted", delDataRes.deletedCount, "testRunData docs");
    // Delete the TestRun doc
    const delRes = await TestRun.deleteOne({_id: trDoc._id});
    console.log("Deleted", delRes.deletedCount, "testRun docs");

    res.send({trDocDelete: delRes, trDataDelete: delDataRes});
  });

  bareRouter.ws('/socket/exp/:expId', async (ws, req) => {

    const expId = ObjectId.createFromHexString(req.params.expId);
    function doPing() {
      sendWsData(ws, {type: 'ping'});
      pingTimeout = setTimeout(() => {
          console.log("Ping timeout");
      }, k_PingTimeout);
    }

    ws.on('message', (data: Buffer) => {
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
              break;
          case 'data':
              break;
      }
    });

    nextPingTimeout = setTimeout(doPing, k_PingInterval);

    ws.on("close", () => {
      console.log(`Websocket closed`);
      if (nextPingTimeout) clearTimeout(nextPingTimeout);
      if (pingTimeout) clearTimeout(pingTimeout);
    });
    ws.on("ping", () => {
      console.log(`Ping received`);
    });
    ws.on("pong", () => {
      console.log(`Pong received`);
    });

    watchDatabase({
      collection: "nodeStatus",
      filter: (newDoc) => true,
      onChange(newDoc, changeDoc) {
        // TODO: Send to the client
        console.log("Node status changed:", newDoc, changeDoc);
        sendWsData(ws, {
          type: "nodeStatus",
          nodeName: newDoc.name,
          nodeId: newDoc._id.toString(),
          lastSeen: newDoc.lastSeen,
          rfStatus: newDoc.rfStatus,
        });
      },
    });
    watchDatabase({
      collection: "testRun",
      filter: (newDoc) => newDoc.experimentId.equals(expId),
      onDelete(oldDocId) {
        // Remove the testRun from the testRuns array
        const idx = testRuns.findIndex((tr) => tr._id.equals(oldDocId));
        if (idx !== -1) {
          testRuns.splice(idx, 1);
        }
        sendWsData(ws, {
          type: "itemDeleted",
          itemType: "testRun",
          itemId: oldDocId.toString(),
        });
      },
      onChange(newDoc, changeDoc) {
        // Update the testRuns array, add or update
        const curVal = testRuns.find((tr) => tr._id.equals(newDoc._id));
        if (curVal) {
          Object.assign(curVal, newDoc);
        } else {
          testRuns.push(newDoc);
        }

        sendWsData(ws, {
          type: "trUpdate",
          doc: {
            ...newDoc,
            experimentId: newDoc.experimentId.toString(),
            _id: newDoc._id.toString(),
          }
        });
      },
    });
    // watch the testRunData collection
    watchDatabase({
      collection: "testRunData",
      filter: newDoc => testRuns.some(tr => tr._id.equals(newDoc.testRunId)),
      onChange(newDoc, changeDoc) {
        sendTestDataDoc(ws, newDoc);
      }
    });
    // Get all nodes that have been seen in the last minute
    const {
      NodeStatus,
      TestRun,
      TestRunData,
      Experiment,
    } = await getCollections("nodeStatus", "testRun", "testRunData", "experiment");

    const curExp = await Experiment.findOne({_id: expId});
    if (!curExp) {
      sendWsData(ws, {
        type: "error",
        message: "Invalid experiment ID",
      });
      ws.close(1001, 'Invalid experiment ID');
      return;
    }
    sendWsData(ws, {
      type: "expUpdate",
      doc: curExp,
    });

    const testRuns = await TestRun.find({experimentId: expId}).toArray();

    for (const tr of testRuns) {
      sendWsData(ws, {
        type: "trUpdate",
        doc: {
          ...tr,
          experimentId: tr.experimentId.toString(),
          _id: tr._id.toString(),
        },
      });
    }

    const trData = await TestRunData.find({testRunId: {$in: testRuns.map(tr => tr._id)}}).toArray();
    for (const doc of trData) {
      sendTestDataDoc(ws, doc);
    }

    const neededNodeIds = trData.map(doc => doc.nodeId);

    // Load any nodes that we need to know about
    const neededNodes = await NodeStatus.find({
      $or: [
        {lastSeen: {$gte: new Date(Date.now() - 60000)}},
        {_id: {$in: neededNodeIds}},
      ],
    }).toArray();

    for (const node of neededNodes) {
      sendWsData(ws, {
        type: "nodeStatus",
        nodeName: node.name,
        nodeId: node._id.toString(),
        lastSeen: node.lastSeen,
        rfStatus: node.rfStatus,
      });
    }
  });

  return router;
}

