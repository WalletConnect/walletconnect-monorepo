import { checkHealth } from "./healthcheck";

async function run() {
  const result = await checkHealth(5000);

  if(result.alive) {
    console.log("Bridge is alive, check took", result.durationSeconds, "seconds")
    process.exit(0);
  } else {
    console.error("Check failed:", result.error.message);
    console.error(result.error);
    process.exit(1);
  }
}


run();