
import { ObjectId, Collection } from 'mongodb';

export interface NodeCommand {
    _id: ObjectId;

    // The _id of the node
    nodeId: ObjectId;

    // When was the command sent
    commandSent: Date;
    // When was the command acknowledged
    commandAck: Date;

    // The state the node was last in
    state: string;
}

export type NodeStatusCollection = Collection<NodeCommand>;
