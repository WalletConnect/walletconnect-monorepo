const { checkHealth } = require("./healthcheck");

const defaultLogger = (message, objectStatus) => {
  if (!process.env.STRESS_TEST) {
    //eslint-disable-next-line no-console
    console.log(message, objectStatus);
  }
};

async function run() {
  const uri = process.argv.slice(2)[0] === undefined ? "https://bridge.walletconnect.org" : process.argv.slice(2)[0];
  const result = await checkHealth(20000, defaultLogger, uri);

  if (result.alive) {
    // eslint-disable-next-line no-console
    return `Bridge is alive, check took, ${result.durationSeconds} seconds`;
  } else {
    const errorMsg = (result.error && result.error) || "Unknown error";
    // eslint-disable-next-line no-console
    console.error("Check failed:", errorMsg);
    // eslint-disable-next-line no-console
    //reject(result.error);
    return result.error;
  }
}
