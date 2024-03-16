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

  let receivedMessagesR: { k: number, x: Value, phase: string }[] = [];
  let receivedMessagesP: { k: number, x: Value, phase: string }[] = [];

  async function sendMessageToAllProcesses(k: number, x: Value, phase: string) {
    for (let i = 0; i < N; i++) {
      if (i !== nodeId) {
        await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          body: JSON.stringify({ k, x, phase }),
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

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
  node.post("/message", async (req, res) => {
    let { k, x, phase } = req.body;

    if (nodeState.killed) {
      res.status(500).send("node is killed");
      return;
    }

    if (isFaulty) {
      res.status(500).send("node is faulty");
      return;
    }

    if (k === null || x === null || phase === null) {
      res.status(500).send("missing parameters");
      return;
    }

    // consensus(vp)                                                                          { vp is the initial value of process p }
    // 1:  x := vp                                                                            { x is p's current estimate of the decision value }
    // 2:  k := 0
    // 3: while True do
    // 4:   k := k + 1                                                                        { k is the current phase number }
    // 5:   send (x, k) to all processes
    // 6:   wait for messages of the form (R, k, *) from n-f processes                        { "*" can be 0 or 1 }
    // 7:   if recceived more than n/2 (R, k, v) with the same v
    // 8:   then send (P, k, v) to all processes
    // 9:   else send (P, k, ?) to all processes
    // 10:  wait for messages of the form (P, k, *) from n-f processes                        { "*" can be 0, 1 or ? }
    // 11:  if received at least f+1 (P, k, *) from n-f processes then decide(v)
    // 12:  if at least one (P, k, v) with v /= ? then x := v else x := 0 or 1 randomly       { query r.n.g.}

    if (phase === "R") {
      receivedMessagesR.push({ k, x, phase });

      if (receivedMessagesR.length >= (N - F)) {
        let numberOfZeroes = receivedMessagesR.filter(m => m.x === 0).length;
        let numberOfOnes = receivedMessagesR.filter(m => m.x === 1).length;

        if (numberOfZeroes > N / 2) {
          await sendMessageToAllProcesses(k, 0, "P");
        } else if (numberOfOnes > N / 2) {
          await sendMessageToAllProcesses(k, 1, "P");
        } else {
          await sendMessageToAllProcesses(k, "?", "P");
        }
      }

    } else if (phase === "P") {
      receivedMessagesP.push({ k, x, phase });

      if (receivedMessagesP.length >= (N - F)) {
        let numberOfZeroes = receivedMessagesP.filter(m => m.x === 0).length;
        let numberOfOnes = receivedMessagesP.filter(m => m.x === 1).length;

        if (numberOfZeroes >= F + 1) {
          nodeState.x = 0;
          nodeState.decided = true;
        } else if (numberOfOnes >= F + 1) {
          nodeState.x = 1;
          nodeState.decided = true;
        } else {
          if (numberOfZeroes === 0 && numberOfOnes === 0) {
            nodeState.x = Math.random() < 0.5 ? 0 : 1;
          } else {
            if (numberOfZeroes > numberOfOnes) {
              nodeState.x = 0;
            } else {
              nodeState.x = 1;
            }
          }

          nodeState.k = k + 1;
          
          if (nodeState.k) {
            await sendMessageToAllProcesses(nodeState.k, nodeState.x, "R");
          }
        }
      }
    }
    
    res.status(200).send("message received");
  });

  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    if (!nodesAreReady()) {
      res.status(500).send("nodes are not ready yet");
      return;
    }

    if (isFaulty) {
      res.status(500).send("node is faulty");
      return;
    }

    nodeState.x = initialValue;
    nodeState.k = 0;
    nodeState.decided = false;

    await sendMessageToAllProcesses(nodeState.k, nodeState.x, "R");

    res.status(200).send("consensus started");
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
