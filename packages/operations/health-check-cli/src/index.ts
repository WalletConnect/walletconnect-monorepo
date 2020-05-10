import { checkHealth } from "./healthcheck";

async function run() {
  const result = checkHealth(5000);

  if(result.alive) {
    console.log("Bridge is alive, check took", result.completeTime)
    process.exit(0);
  } else {
    console.log("Check failed", result.reason)
    process.exit(1);
  }
}


run();