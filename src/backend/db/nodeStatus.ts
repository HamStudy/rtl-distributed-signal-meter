
import { ObjectId, Collection } from 'mongodb';

export interface NodeStatus {
    _id: ObjectId;

    // The name of the node
    name: string;

    // A new "instance string" is assigned whenever a new websocket connection is made
    instanceString: string;

    // The last time that the node was seen
    lastSeen: Date;

    // The state the node was last in
    state: string;

    // The last IP address that the node was seen at
    lastIp: string;

    rfStatus?: {
        updatedAt: Date;
        level: number;
        frequency: string;
    }
}

export type NodeStatusCollection = Collection<NodeStatus>;
