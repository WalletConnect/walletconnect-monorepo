import { Connector } from "@walletconnect/core";
import { IConnector, ICreateSessionOptions, IConnectorOpts, IWalletConnectOptions } from "@walletconnect/types";

import * as cryptoLib from "@walletconnect/browser-crypto";

// Returned for the clients to analyse
interface HealthCheckResult {

  // Did health check success
  alive: boolean;

  // Any thrown error as string
  reason: string;

  // How long it took to go through the full cycle;
  completeTime: number;
};


/**
 * Create default connecor argumetns.
 */
function getConnectorOpts(): IConnectorOpts {
  // Server we test
  const opts = {
    connectorOpts: {
      bridge: "https://bridge.walletconnect.org";
    },
    cryptoLib: cryptoLib,
  };
  return opts;
}

function createConnector(initiator: bool, opts: IConnectorOpts): IConnector  {
  let connector: IConnector;
  if(initiator) {
  } else {
  }
  connector = new Connector(opts);
  return connector;
}


/*
// Subscribe to connection events
walletConnector.on("connect", (error: any, payload: any) => {
  if (error) {
    throw error;
  }
  // Get provided accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("session_update", (error: any, payload: any) => {
  if (error) {
    throw error;
  }

  // Get updated accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("disconnect", (error: any, payload: any) => {
  if (error) {
    throw error;
  }

  // Delete walletConnector
});
*/


async function checkHealth(timeout: number) {
  const opts = getConnectorOpts();

  const originator = createConnector(true, opts);
  const joiner = createConnector(true, opts);

  let uri: string;

  // Open a new wallet connect session - the originator will create a session
  // id that is used as a QR code contents
  originator.on("display_uri", (err, _uri) => { uri = _uri });

  const originatorSession = await originator.createSession();


  const joinerSession = joiner.connect()

}