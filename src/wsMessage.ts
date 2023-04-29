import { TestRun, TestRunData } from "./db";

export interface ErrorMessage {
    type: 'error';
    message: string;
}
export interface TestRunUpdate {
    type: 'trUpdate';
    doc: TestRun;
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

export type WSMessageDoc = ErrorMessage | TestRunUpdate | PingMessage | PongMessage | DataPacket;