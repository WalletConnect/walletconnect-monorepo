# @walletconnect/client

Client for WalletConnect Protocol

## Description

This library provides a Standalone Client for WalletConnect 2.0 Protocol for both Dapps and Wallets. Integration will differ from the perspective of each client as the Proposer and Responder, respectively. It's compatible with NodeJS, Browser and React-Native applications (NodeJS modules required to be polyfilled for React-Native)

## Install

```bash
yarn add @walletconnect/client
# OR

npm install --save @walletconnect/client
```

## Create Session

This quick start example will describe how an integration should be followed for both Dapps and Wallets respectively

### Dapps

1. Initiate your WalletConnect client with the relay server

```js
import WalletConnectClient from "@walletconnect/client";

const client = await WalletConnectClient.init({ relayProvider: "wss://staging.walletconnect.org" });
```

2. Subscribe to pairing proposal event for sharing URI

```js
import { CLIENT_EVENTS } from "@walletconnect/client";
import { PairingTypes } from "@walletconnect/types";

client.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
  // uri should be shared with the Wallet either through QR Code scanning or mobile deep linking
  const { uri } = proposal.signal.params;
});
```

3. Connect application and specify session permissions

```js
const session = await client.connect({
  metadata: {
    name: "Example Dapp",
    description: "Example Dapp",
    url: "#",
    icons: ["https://walletconnect.org/walletconnect-logo.png"],
  },
  permissions: {
    blockchain: {
      chains: ["eip155:1"],
    },
    jsonrpc: {
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData"],
    },
  },
});
```

### Wallets

1. Initiate your WalletConnect client with the relay server

```js
import WalletConnectClient from "@walletconnect/client";

const client = await WalletConnectClient.init({ relayProvider: "wss://staging.walletconnect.org" });
```

2. Subscribe to session proposal event for user approval and session created when successful

```js
import { CLIENT_EVENTS } from "@walletconnect/client";
import { SessionTypes } from "@walletconnect/types";

client.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
  // user should be prompted to approve the proposed session permissions displaying also dapp metadata
  const { proposer, permissions } = proposal;
  const { metadata } = proposer;
  let approved: boolean;
  handleSessionUserApproval(approved, proposal); // described in the step 4
});

client.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
  // session created succesfully
});
```

3. Establish pairing with shared URI from dapp

```js
client.pair({ uri });
```

4. Handle user approval for proposed session

```js
function handleSessionUserApproval(approved: boolean, proposal: SessionTypes.Proposal) {
  if (userApproved) {
    // if user approved then include response with accounts matching the chains and wallet metadata
    const response: SessionTypes.Response = {
      metadata: {
        name: "Test Wallet",
        description: "Test Wallet",
        url: "#",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
      },
      state: {
        accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"],
      },
    }
    await client.approve({ proposal, response });
  } else {
    // if user didn't approve then reject with no response
    await client.reject({ proposal });
  }
}
```

## JSON-RPC Payloads

### Dapps

Once the session has been succesfull then you can start making JSON-RPC requests to be approved and signed by the wallet

```js
const result = await client.request({
  topic: session.topic,
  chainId: "eip155:1",
  request: {
    id: 1,
    jsonrpc: "2.0",
    method: "personal_sign",
    params: [
      "0x1d85568eEAbad713fBB5293B45ea066e552A90De",
      "0x7468697320697320612074657374206d65737361676520746f206265207369676e6564",
    ],
  },
});
```

### Wallets

Given that session has settled succesfully since user approved the session on the wallet side, then the Wallet should subscribe to session payload events on the client

```js
import { CLIENT_EVENTS } from "@walletconnect/client";
import { SessionTypes } from "@walletconnect/types";
import { JsonRpcResponse } from "@json-rpc-tools/utils";

client.on(CLIENT_EVENTS.session.payload, async (payloadEvent: SessionTypes.PayloadEvent) => {
  // WalletConnect client can track multiple sessions
  // assert the topic from which application requested
  const { topic, payload } = payloadEvent;
  const session = await client.session.get(payloadEvent.topic);
  // now you can display to the user for approval using the stored metadata
  const { metadata } = session.peer;
  // after user has either approved or not the request it should be formatted
  // as response with either the result or the error message
  let result: any;
  const response = approved
    ? {
        topic,
        response: {
          id: payload.id,
          jsonrpc: "2.0",
          result,
        },
      }
    : {
        topic,
        response: {
          id: payload.id,
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "User rejected JSON-RPC request",
          },
        },
      };
  await client.respond(response);
});
```

## API

```typescript
export interface ClientOptions {
  logger?: string | Logger;
  storage?: IKeyValueStorage;
  relayProvider?: string | IJsonRpcProvider;
  overrideContext?: string;
}

export abstract class IClient extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract logger: Logger;

  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;

  public abstract pairing: IPairing;
  public abstract session: ISession;

  constructor(opts?: ClientOptions) {
    super();
  }

  // for proposer to propose a session to a responder
  public abstract connect(params: ClientTypes.ConnectParams): Promise<SessionTypes.Settled>;
  // for responder to receive a session proposal from a proposer
  public abstract pair(params: ClientTypes.PairParams): Promise<void>;

  // for responder to approve a session proposal
  public abstract approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled>;
  // for responder to reject a session proposal
  public abstract reject(params: ClientTypes.RejectParams): Promise<void>;

  // for responder to update session state
  public abstract update(params: ClientTypes.UpdateParams): Promise<void>;
  // for either to send notifications
  public abstract notify(params: ClientTypes.NotifyParams): Promise<void>;

  // for proposer to request JSON-RPC
  public abstract request(params: ClientTypes.RequestParams): Promise<any>;
  // for responder to respond JSON-RPC
  public abstract respond(params: ClientTypes.RespondParams): Promise<void>;

  // for either to disconnect a session
  public abstract disconnect(params: ClientTypes.DisconnectParams): Promise<void>;
}

export declare namespace ClientTypes {
  export interface ConnectParams {
    metadata: SessionTypes.Metadata;
    permissions: SessionTypes.BasePermissions;
    relay?: RelayerTypes.ProtocolOptions;
    pairing?: SignalTypes.ParamsPairing;
  }

  export interface PairParams {
    uri: string;
  }

  export interface ApproveParams {
    proposal: SessionTypes.Proposal;
    response: SessionTypes.Response;
  }
  export interface RejectParams {
    proposal: SessionTypes.Proposal;
  }

  export type UpdateParams = SessionTypes.UpdateParams;

  export type NotifyParams = SessionTypes.NotifyParams;

  export interface RequestParams {
    topic: string;
    request: RequestArguments;
    chainId?: string;
  }

  export interface RespondParams {
    topic: string;
    response: JsonRpcResponse;
  }

  export interface DisconnectParams {
    topic: string;
    reason: string;
  }
}
```

## License

LGPL-3.0
