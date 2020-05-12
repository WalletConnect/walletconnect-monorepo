import { checkHealth } from "./healthcheck";

async function run() {
  const result = await checkHealth(5000, console.log);

  if(result.alive) {
    console.log("Bridge is alive, check took", result.durationSeconds, "seconds");
    process.exit(0);
  } else {
    const errorMsg = result.error && result.error || "Unknown error";
    console.error("Check failed:", errorMsg);
    console.error(result.error);
    process.exit(1);
  }
}

run();