import { PORT } from "./constants";
import { startHardhatNode, stopHardhatNode } from "./hardhat";

export async function setup() {
  console.log("🚀 Starting Hardhat node for test suite...");
  await startHardhatNode(PORT);
}

export async function teardown() {
  console.log("🛑 Stopping Hardhat node after test suite...");
  await stopHardhatNode();
}
