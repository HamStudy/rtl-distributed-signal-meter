
import '../dotenv';

import { ObjectId } from "mongodb";
import { getCollections } from "./db/index";

async function createJobNow(frequency: string, expId: ObjectId, configDescription: string) {
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
  endTime.setSeconds(startTime.getSeconds() + 30);

  await TestRun.insertOne({
    _id: new ObjectId(),
    configDescription: configDescription || "No description",
    frequency, // Needed to support e.g. 146.52e6 notation
    startTime,
    endTime,
    experimentId: exp._id,
    nodeList: [],
    state: "pending",
  });
}

// If the script was called directly

if (require.main === module) {
  // the last three args are the experiment ID, frequency, and description
  const [expId, frequency, configDesc] = process.argv.slice(-3);
  // String(Number(frequency)) is Needed to support e.g. 146.52e6 notation
  createJobNow(String(Number(frequency)), ObjectId.createFromHexString(expId), configDesc).then(() => {
    console.log("Done");
    process.exit(0)
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
