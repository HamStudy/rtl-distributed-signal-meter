
import '../dotenv';

import { ObjectId } from "mongodb";
import { getCollections } from "./db/index";

async function createJobNow(frequency: string, expId: ObjectId) {
  const { TestRun, Experiment } = await getCollections("testRun", "experiment");

  if (Number(frequency) < 1e6) {
    console.error("Frequency must be at least 1 MHz");
    throw new Error("Invalid parameters");
  }

  const exp = await Experiment.findOne({ _id: expId });
  if (!exp) {
    console.error("Invalid experiment ID");
    return;
  }

  let startTime = new Date();
  startTime.setSeconds(startTime.getSeconds() + 20);
  let endTime = new Date(startTime);
  endTime.setSeconds(startTime.getSeconds() + 10);

  await TestRun.insertOne({
    _id: new ObjectId(),
    configDescription: "test thingy",
    frequency,
    startTime,
    endTime,
    experimentId: exp._id,
    nodeList: [],
    state: "pending",
  });
}

// If the script was called directly

if (require.main === module) {
  // The last two command line arguments are the experiment ID and the frequency
  const expId = new ObjectId(process.argv[2]);
  const frequency = Number(process.argv[3]);
  createJobNow(String(frequency), expId).then(() => {
    console.log("Done");
    process.exit(0)
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
