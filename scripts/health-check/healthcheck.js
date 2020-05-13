const WalletConnect = require("../../dist/client.min.js").default;

/**
 * Check WalletConnect state.
 *
 * We cannot use purely linear async/await code as much of WalletConnect functionaloty is built on the top of event handlers.
 * This class encapsulates that to a simpler state handler.
 *
 * See also: https://docs.walletconnect.org/tech-spec
 */
export class HealthChecker {
  /**
   * @param timeout Check timeout in milliseconds
   * @param onFinish Callback then the check is finished, one way or another
   */
  constructor(timeout, onFinish, log) {
    this.timeout = timeout;
    this.onFinish = onFinish;
    this.log = log;
  }

  /**
   * Some of the WalletConnect callback methods raised an error
   *
   * @param error
   */
  fail(error) {
    const result = {
      alive: false,
      error: error,
      durationSeconds: this.getDuration(),
    };
    this.onFinish(result);
  }

  /**
   * How long the health check took in seconds
   */
  getDuration() {
    return (Number(new Date()) - Number(this.startedAt)) / 1000;
  }

  /**
   * Create a new WalletConnect connector
   *
   * @param initiator
   * @param opts
   */
  createConnector(opts) {
    const connector = new WalletConnect(opts);
    return connector;
  }

  /**
   * The originator has created a new session
   *
   * @param err
   * @param payload
   */
  onDisplayURI(err, payload) {
    if (err) {
      this.fail(err);
    }

    this.uri = payload.params[0];

    // Let's trigger the process to have another client to join the same session
    if (this.uri) {
      this.connectToSession(this.uri);
      return;
    }

    this.fail(new Error("URI missing from display_uri"));
  }

  /**
   * Creates another WalletConnect that joins to an existing session
   * @param uri
   */
  connectToSession(uri) {
    // eslint-disable-next-line no-console
    console.log("Connecting to session", uri);

    // For joining, we give URI instead of a bridge server
    this.joiner = this.createConnector({ uri });
    this.joiner.on("session_request", (err, payload) => {
      this.onSessionRequest(err, payload);
    });
    this.joiner.on("ping", (err, payload) => {
      this.onPing(err, payload);
    });
    this.joiner.createSession();
  }

  /**
   * We have two WalletConnect clients tha have joined to the same session
   *
   * @param err
   * @param payload
   */
  onSessionRequest(err, payload) {
    if (err) {
      this.fail(err);
    }

    this.log("Session requested", payload);

    // Use dummy chain parameters, as we are not really connected to any blockchain
    const approvalParams = {
      chainId: 0,
      accounts: [],
      networkId: 0,
    };

    this.joiner.approveSession(approvalParams);
  }

  /**
   * dApp receives after the wallet approves the session.
   *
   * @param err
   * @param payload
   */
  onConnect(err, payload) {
    if (err) {
      this.fail(err);
    }
    this.log("Connected", payload);
    this.sendPing();
  }

  /**
   * dApp receives after the wallet approves the session.
   *
   * @param err
   * @param payload
   */
  onSessionUpdate(err, payload) {
    if (err) {
      this.fail(err);
    }
    this.log("Session updated", payload);
  }

  /**
   * Wallet receives a ping request.
   *
   * @param err
   * @param payload
   */
  onPing(err, payload) {
    if (err) {
      this.fail(err);
    }
    this.log("Ping received", payload);

    // All seems to be good
    this.onFinish({
      alive: true,
      durationSeconds: this.getDuration(),
    });
  }

  /**
   * Send a custom message from originator to joiner.
   */
  sendPing() {
    this.originator.sendCustomRequest({ method: "ping" });
  }

  /**
   * Initiate a health check.
   */
  async start() {
    this.startedAt = new Date();
    this.originator = this.createConnector({
      bridge: "https://bridge.walletconnect.org",
    });
    this.originator.on("display_uri", (err, payload) => {
      this.onDisplayURI(err, payload);
    });
    this.originator.on("connect", (err, payload) => {
      this.onConnect(err, payload);
    });
    this.originator.on("session_update", (err, payload) => {
      this.onSessionUpdate(err, payload);
    });
    this.log("Creating session");
    this.originator.createSession();
  }

  /**
   * Main entry point
   *
   * @param timeout Timeout in milliseconds
   */
  static async run(timeout, log) {
    const checker = new Promise(resolve => {
      const checker = new HealthChecker(timeout, resolve, log);
      checker.start();
    });

    const timeoutter = new Promise(resolve => {
      setTimeout(resolve, timeout, {
        alive: false,
        error: new Error(`Timeoutted in ${timeout} ms`),
        durationSeconds: timeout / 1000,
      });
    });

    // Use race pattern for timeout
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
    return Promise.race([checker, timeoutter]);
  }
}

export async function checkHealth(timeout, log) {
  const result = await HealthChecker.run(timeout, log);
  return result;
}
