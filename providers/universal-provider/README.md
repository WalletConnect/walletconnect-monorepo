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
        80001: "https://rpc.walletconnect.com?chainId=eip155:80001&projectId=<your walletconnect project id>",
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

