
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ErrorMessage, NodeStatusMessage, TestRunDataMessage, TestRunUpdate, WSMessageDoc } from '../../shared/wsMessage';

export type NodeStatus = Omit<NodeStatusMessage, 'type'>;
export type TestRun = TestRunUpdate['doc'];
export type TestRunData = TestRunDataMessage['doc'];

export default defineStore('experimentStore', () => {
  const expId = ref('');

  let socket: WebSocket | undefined;
  let socketExpId: string | undefined;

  const wsUrl = computed(() => {
    // If this page is http, use ws, otherwise use wss
    const protocol = window.location.protocol === 'http:' ? 'ws' : 'wss';
    return `${protocol}://${window.location.host}/api/socket/exp/${expId.value}`;
  });

  const allNodes = ref<NodeStatus[]>([]);

  const currentTestRuns = ref<TestRun[]>([]);
  const testRunData = ref<TestRunData[]>([]);

  const activeNodes = computed(() => allNodes.value.filter(n => n.lastSeen.getTime() > Date.now() - 30000));

  function sendWsData(ws: WebSocket, data: WSMessageDoc) {
    console.warn("Sending data:", data);
    ws.send(JSON.stringify(data));
  }

  const handlers = {
    'error': function(msg: ErrorMessage) {
      alert("Received error: " + msg.message);
    },
    'trUpdate': function(msg: TestRunUpdate) {
      msg.doc.startTime = new Date(msg.doc.startTime);
      msg.doc.endTime = new Date(msg.doc.endTime);
      const curEntry = currentTestRuns.value.findIndex(tr => tr._id === msg.doc._id);
      if (curEntry >= 0) {
        currentTestRuns.value.splice(curEntry, 1, Object.freeze(msg.doc));
      } else {
        currentTestRuns.value.push(Object.freeze(msg.doc));
      }
    },
    'ping': function() {
      sendWsData(socket!, {type: 'pong'});
    },
    'pong': function() {
      console.log("Received pong", new Date());
    },
    'nodeStatus': function(msg: NodeStatusMessage) {
      const statusDoc = {...msg};
      delete (<any>statusDoc).type;
      statusDoc.lastSeen = new Date(statusDoc.lastSeen);
      if (statusDoc.rfStatus?.updatedAt) {
        statusDoc.rfStatus.updatedAt = new Date(statusDoc.rfStatus.updatedAt);
      }
      const existingNode = allNodes.value.findIndex(n => n.nodeId === msg.nodeId);

      if (existingNode >= 0) {
        allNodes.value.splice(existingNode, 1, Object.freeze(statusDoc));
      } else {
        allNodes.value.push(Object.freeze(statusDoc));
      }
    },
    'trData': function(msg: TestRunDataMessage) {
      const curEntry = testRunData.value.findIndex(tr => tr.timestamp === msg.doc.timestamp && tr.nodeId === msg.doc.nodeId);
      if (curEntry >= 0) return; // ignore duplicates
      msg.doc.timestamp = new Date(msg.doc.timestamp);
      testRunData.value.push(Object.freeze(msg.doc));
    },
  }

  async function onWsMessage(e: MessageEvent<any>) {
    const data = e.data;
    try {
      const msg = JSON.parse(data.toString()) as WSMessageDoc;
      if (msg.type in handlers) {
        handlers[msg.type](msg);
      } else {
        console.warn("Unknown message type:", msg);
      }
    } catch (err) {
      console.warn("Could not parse message:", data, err);
      return;
    }
  }

  const dataForTestRun = (tr: TestRun) => testRunData.value.filter(trd => trd.testRunId === tr._id);
  const trDataByNode = (tr: TestRun) => {
    const filtered = dataForTestRun(tr);
    const byNode = new Map<string, TestRunData[]>();
    for (const trd of filtered) {
      const nodeData = byNode.get(trd.nodeId);
      if (nodeData) {
        nodeData.push(trd);
      } else {
        byNode.set(trd.nodeId, [trd]);
      }
    }
    return byNode;
  };
  const nodesForTestRun = (tr: TestRun) => {
    const byNode = trDataByNode(tr);
    const nodeIds = Array.from(byNode.keys());
    return allNodes.value.filter(n => nodeIds.includes(n.nodeId));
  };
  const getNodeTrData = (tr: TestRun, node: NodeStatus) => {
    const byNode = trDataByNode(tr);
    return byNode.get(node.nodeId) || [];
  };

  watch(() => useRoute().params.expId as string, (newVal) => {
    expId.value = newVal;
    if (newVal !== socketExpId) {
      socket?.close();
      socket?.removeEventListener('message', onWsMessage);
      socket = undefined;
      socketExpId = undefined;
    }
    if (newVal) {
      socketExpId = newVal as string;
      socket = new WebSocket(wsUrl.value);

      socket.addEventListener('message', onWsMessage);
    }
  }, {immediate: true});

  return {
    expId,

    activeNodes,
    allNodes,
    currentTestRuns,
    testRunData,

    dataForTestRun,
    trDataByNode,
    nodesForTestRun,
    getNodeTrData,
  }
});
