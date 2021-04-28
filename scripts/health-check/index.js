const { checkHealth } = require("./healthcheck");

async function run() {
  // eslint-disable-next-line no-console
  const result = await checkHealth(5000, console.log);

  if (result.alive) {
    // eslint-disable-next-line no-console
    console.log("Bridge is alive, check took", result.durationSeconds, "seconds");
    process.exit(0);
  } else {
    const errorMsg = (result.error && result.error) || "Unknown error";
    // eslint-disable-next-line no-console
    console.error("Check failed:", errorMsg);
    // eslint-disable-next-line no-console
    console.error(result.error);
    process.exit(1);
  }
}

run();
