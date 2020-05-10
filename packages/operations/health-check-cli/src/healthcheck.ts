import Connector from "@walletconnect/core";
import * as cryptoLib from "@walletconnect/iso-crypto";

import {
  IConnector,
  IConnectorOpts,
} from "@walletconnect/types";


// Returned for the clients to analyse
interface HealthCheckResult {

  // Did health check success
  alive: boolean;

  // Any thrown error as string
  error: Error;

  // How long it took to go through the full cycle;
  durationSeconds: number;
};


interface HealthCheckCallable {
  (result: HealthCheckResult): void;
}


/**
 * Check WalletConnect state.
 *
 * We cannot use purely linear async/await code as much of WalletConnect functionaloty is built on the top of event handlers.
 * This class encapsulates that to a simpler state handler.
 */
export class HealthChecker {

  // This emulators dApp that requests the QR code
  originator?: IConnector;

  // This emulators a wallet that joins to the session by a QR code
  joiner?: IConnector;

  // Any error coming through WalletConnect event callbacks
  error?: Error;

  // Connection URI
  uri?: string;

  // When health check was started
  startedAt?: Date;

  // Event callback when all done

  /**
   * @param timeout Check timeout in milliseconds
   * @param onFinish Callback then the check is finished, one way or another
   */
  constructor(private timeout: number, private onFinish: HealthCheckCallable) {
  }

  /**
   * Some of the WalletConnect callback methods raised an error
   *
   * @param error
   */
  fail(error: Error) {
    const result = {
      alive: false,
      error: error,
      durationSeconds: this.getDuration(),
    }
    this.onFinish(result);
  }

  /**
   * How long the health check took in seconds
   */
  getDuration(): number {
    return (Number(new Date()) - Number(this.startedAt)) / 1000;
  }

  /**
   * Create a new WalletConnect connector
   *
   * @param initiator
   * @param opts
   */
  createConnector(initiator: boolean, opts: IConnectorOpts): IConnector  {
    let connector: IConnector;
    if(initiator) {
    } else {
    }
    connector = new Connector(opts);
    return connector;
  }

  /**
   * The originator has created a new session
   *
   * @param err
   * @param payload
   */
  onDisplayURI(err: Error | null, payload: any) {
    if(err) {
      this.fail(err);
    }

    this.uri = payload.params[0];

    // Let's trigger the process to have another client to join the same session
    if(this.uri) {
      this.connectToSession(this.uri);
      return;
    }

    this.fail(new Error("URI missing from display_uri"));
  }

  /**
   * Creates another WalletConnect that joins to an existing session
   * @param uri
   */
  connectToSession(uri: string) {
    console.log("Connecting to session", uri);

    // For joining, we give URI instead of a bridge server
    const opts = {
      connectorOpts: {
        uri,
      },
      cryptoLib: cryptoLib,
    };
    this.joiner = this.createConnector(true, opts);
    this.joiner.on("display_uri", (err: Error | null, payload: any) => { this.onConnection(err, payload); });
    this.joiner.connect();
  }

  /**
   * We have two WalletConnect clients tha have joined to the same session
   *
   * @param err
   * @param payload
   */
  onConnection(err: Error | null, payload: any)  {
    if(err) {
      this.fail(err);
    }

    console.log("Connected");
  }


  /**
   * Initiate a health check.
   */
  async start() {
    this.startedAt = new Date();
    const opts = {
      connectorOpts: {
        bridge: "https://bridge.walletconnect.org"
      },
      cryptoLib: cryptoLib,
    };
    this.originator = this.createConnector(true, opts);
    this.originator.on("display_uri", (err: Error | null, payload: any) => { this.onDisplayURI(err, payload); });
    console.log("Creating session");
    this.originator.createSession();
  }

  /**
   * Main entry point
   *
   * @param timeout Timeout in milliseconds
   */
  static async run(timeout: number): Promise<HealthCheckResult> {

    const checker: Promise<HealthCheckResult> = new Promise((resolve, reject) => {
      const checker = new HealthChecker(timeout, resolve);
      checker.start();
    });

    const timeoutter: Promise<HealthCheckResult> = new Promise((resolve, reject) => {
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

};

export async function checkHealth(timeout: number): Promise<HealthCheckResult> {
 const result = await HealthChecker.run(timeout);
 return result;
}