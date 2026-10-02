# @walletconnect/universal-provider

Universal Provider for WalletConnect Protocol

## Usage

```typescript
import { ethers } from "ethers";
import UniversalProvider from "@walletconnect/universal-provider";

//  Initialize the provider
const provider = await UniversalProvider.init({
  logger: "info",
  relayUrl: "ws://<relay-url>",
  projectId: "12345678",
  metadata: {
    name: "React App",
    description: "React App for WalletConnect",
    url: "https://walletconnect.com/",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
  client: undefined, // optional instance of @walletconnect/sign-client
});

//  create sub providers for each namespace/chain
await provider.connect({
  namespaces: {
    eip155: {
      methods: [
        "eth_sendTransaction",
        "eth_signTransaction",
        "eth_sign",
        "personal_sign",
        "eth_signTypedData",
      ],
      chains: ["eip155:80001"],
      events: ["chainChanged", "accountsChanged"],
      rpcMap: {
        80001:
          "https://rpc.walletconnect.org?chainId=eip155:80001&projectId=<your walletconnect project id>",
      },
    },
    pairingTopic: "<123...topic>", // optional topic to connect to
    skipPairing: false, // optional to skip pairing ( later it can be resumed by invoking .pair())
  },
});

//  Create Web3 Provider
const web3Provider = new ethers.providers.Web3Provider(provider);
```

## Events

```typescript
// Subscribe for pairing URI
provider.on("display_uri", (uri) => {
  console.log(uri);
});

// Subscribe to session ping
provider.on("session_ping", ({ id, topic }) => {
  console.log(id, topic);
});

// Subscribe to session event
provider.on("session_event", ({ event, chainId }) => {
  console.log(event, chainId);
});

// Subscribe to session update
provider.on("session_update", ({ topic, params }) => {
  console.log(topic, params);
});

// Subscribe to session delete
provider.on("session_delete", ({ id, topic }) => {
  console.log(id, topic);
});
```

## Wallet-originated launch

A wallet that opens your app in its in-app browser (for example from its Explore section) can inject a bridge before the page loads:

```typescript
window.walletConnectHost = {
  autoConnect: true,
  postMessage: (message: { type: "wc_session_offer"; uri: string }) => void,
};
```

When `autoConnect` is `true` and `postMessage` is a function, `connect()` sends the pairing URI to the wallet as `{ type: "wc_session_offer", uri }` and **does not emit `display_uri`**, so no QR code or modal opens. The wallet pairs with the URI, and `connect()` resolves once it approves the session.

Universal Provider never connects on its own. Check for a wallet launch and call `connect()` yourself, for example on page load:

```typescript
// synchronous and SSR-safe; also available as `provider.isWalletLaunch`
if (UniversalProvider.isWalletLaunch() && !provider.session) {
  await provider.connect({ optionalNamespaces });
}
```

- Each `connect()` call creates a new pairing URI and sends exactly one offer.
- If `init()` restores a session, nothing is sent and `connect()` isn't needed.
- If `postMessage` throws, `connect()` rejects. It doesn't fall back to `display_uri`.
- Only call `connect()` automatically on page load. After the user disconnects, connect again only when they ask to, or the wallet will receive a new offer and may approve it straight away.

## Provider Methods

```typescript
interface RequestArguments {
  method: string;
  params?: any[] | undefined;
}

// Send JSON RPC requests

/**
 * @param payload
 * @param chain - optionally specify which chain should handle this request
 * in the format `<namespace>:<chainId>` e.g. `eip155:1`
 */
const result = await provider.request(payload: RequestArguments, chain: string | undefined);
```

## Multi-chain

```typescript
const web3 = new Web3(provider);

// default chainId is the FIRST chain during setup
const chainId = await web3.eth.getChainId();

// set the default chain to 56
provider.setDefaultChain(`eip155:56`, rpcUrl?: string | undefined);

// get the updated default chainId
const updatedDefaultChainId = await web3.eth.getChainId();

```

## Creating a provider file

- Create a file under `providers/universal-provider/src/providers/<NAMESPACE>.ts`
- Implement the `IProvider` interface
- In the `IProvider.request` method, there should be a check for whether or not
  to run the request against the wallet or the blockchain.
  `this.namespace.methods` should only contain the methods supported by the
  wallet.
- The rest of the methods of the class are very similar, mainly centering around
  httpProvider and for the most part will be 90% similar to other providers
  given similar structure of chainId. For example `eip155:1` or
  `solana:mainnetBeta`.
- Export provider under `providers/universal-provider/src/providers/index.ts`
