# @walletconnect/web3wallet

## Description

The Web3Wallet SDK streamlines the integration process, making it easier for wallet developers to include the authentication and transaction signing features necessary for their users to connect and interact with all sorts of apps — now and in the future.

## Getting Started

### Install

```
npm install @walletconnect/web3wallet
```

### Wallet Usage

1. Initialization

```javascript
import { Core } from "@walletconnect/core";
import { Web3Wallet } from "@walletconnect/web3wallet";

const core = new Core({
  projectId: process.env.PROJECT_ID,
});

const web3wallet = await Web3Wallet.init({
  core, // <- pass the shared `core` instance
  metadata: {
    name: "Demo app",
    description: "Demo Client as Wallet/Peer",
    url: "www.walletconnect.com",
    icons: [],
  },
});
```

2. Sign Session Approval

```javascript
web3wallet.on("session_proposal", async (proposal) => {
  const session = await web3wallet.approveSession({
    id: proposal.id,
    namespaces,
  });
});
await web3wallet.core.pairing.pair({ uri });
```

3. Sign Session Rejection

```javascript
web3wallet.on("session_proposal", async (proposal) => {
  const session = await web3wallet.rejectSession({
    id: proposal.id,
    reason: getSdkError("USER_REJECTED_METHODS"),
  });
});
```

4. Sign Session Disconnect

```javascript
await web3wallet.disconnectSession({
  topic,
  reason: getSdkError("USER_DISCONNECTED"),
});
```

5. Responding to Sign Session Requests

```javascript
web3wallet.on("session_request", async (event) => {
  const { id, method, params } = event.request;
  await web3wallet.respondSessionRequest({ id, result: response });
});
```

6. Updating a Sign Session

```javascript
await web3wallet.updateSession({ topic, namespaces: newNs });
```

7. Updating a Sign Session

```javascript
await web3wallet.extendSession({ topic });
```

8. Emit Sign Session Events

```javascript
await web3wallet.emitSessionEvent({
  topic,
  event: {
    name: "accountsChanged",
    data: ["0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb"],
  },
  chainId: "eip155:1",
});
```

9. Handle Sign Events

```javascript
web3wallet.on("session_proposal", handler);
web3wallet.on("session_request", handler);
web3wallet.on("session_delete", handler);
```

10. SIWE with a dapp

```javascript
const iss = `did:pkh:eip155:1:${address}`;
web3wallet.on("auth_request", async (event) => {
  // format the payload
  const message = web3wallet.formatMessage(event.params.cacaoPayload, iss);
  // prompt the user to sign the message
  const signature = await wallet.signMessage(message);
  // respond
  await web3wallet.respondAuthRequest(
    {
      id: args.id,
      signature: {
        s: signature,
        t: "eip191",
      },
    },
    iss,
  );
});

await web3wallet.core.pairing.pair({ uri: request.uri, activatePairing: true });
```

11. Handle Auth Events

```javascript
web3wallet.on("auth_request", handler);
```

## Already using Sign or Auth? Check our [migration guide](https://github.com/WalletConnect/web-examples/tree/main/wallets/react-web3wallet#migrate-from-sign-client-to-web3wallet)
