import type { TestRun, TestRunData, NodeStatus, Experiment } from "../backend/db";

export interface ErrorMessage {
  type: 'error';
  message: string;
}
export interface TestRunUpdate {
  type: 'trUpdate';
  doc: Omit<TestRun, '_id' | 'experimentId'> & {_id: string; experimentId: string};
}
export interface PingMessage {
  type: 'ping';
}
export interface PongMessage {
  type: 'pong';
}
export interface DataPacket {
  type: 'data';
  data: Omit<TestRunData, '_id' | 'testRunId' | 'nodeId'>;
}
export interface ExperimentUpdate {
  type: 'expUpdate';
  doc: Omit<Experiment, '_id'>;
}
export interface NodeStatusMessage {
  type: 'nodeStatus';
  nodeId: string;
  nodeName: string;
  lastSeen: Date;
  rfStatus?: NodeStatus['rfStatus'];
}
export interface TestRunDataMessage {
  type: 'trData';
  doc: Omit<TestRunData, '_id' | 'rawData' | 'nodeId' | 'testRunId'> & {
    nodeId: string;
    testRunId: string;
    noiseFloor: number;
  };
}
export interface ItemDeletedMessage {
  type: 'itemDeleted';
  itemType: 'testRun' | 'experiment';
  itemId: string;
}

export type WSMessageDoc = never
  | ErrorMessage
  | TestRunUpdate
  | PingMessage
  | PongMessage
  | DataPacket
  | NodeStatusMessage
  | TestRunDataMessage
  | ExperimentUpdate
  | ItemDeletedMessage
;
