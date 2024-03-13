import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { NodeState, Value } from "../types";
import e from "express";

export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  const nodeState: NodeState = {
    killed: false,
    x: null,
    decided: null,
    k: null,
  };

  // TODO implement this
  // this route allows retrieving the current status of the node
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    }
    else {
      res.status(200).send("live");
    }
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req, res) => {
    const message = req.body;

    nodeState.x = message.x;
    nodeState.k = message.k;

    res.status(200).send("message received");
  });

  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    if (!nodesAreReady()) {
      res.status(500).send("nodes are not ready yet");
      return;
    }

    // the algorithm should set the value of nodeState.x and nodeState.decided
    nodeState.x = initialValue;
    nodeState.decided = true;
    
    // the algorithm should also set the value of nodeState.k
    nodeState.k = 0;
    // the value of nodeState.k should be the round number at which the node decided on a value

    // the algorithm should be non-blocking and should return immediately

    // the algorithm should be started by calling the /start route
    

    // the algorithm should be stopped by calling the /stop route

    // the algorithm
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    nodeState.killed = true;
    res.status(200).send("consensus stopped");
  });

  // TODO implement this
  // get the current state of a node
  node.get("/getState", (req, res) => {
    res.json(nodeState);
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}
