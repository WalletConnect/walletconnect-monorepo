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

## Host-originated launch

A host that opens your app, such as a wallet's in-app browser launching it from its Explore section, can inject a bridge as `window.walletConnectHost` before the page loads. Its shape is exported as `WalletConnectHost`:

```typescript
interface WalletConnectHost {
  autoConnect?: boolean;
  postMessage?: (message: { type: "wc_session_offer"; uri: string }) => void;
}
```

When `autoConnect` is `true` and `postMessage` is a function, `connect()` sends the pairing URI to the host as `{ type: "wc_session_offer", uri }` and **does not emit `display_uri`**, so no QR code or modal opens. The host hands the URI to its wallet, and `connect()` resolves once the wallet approves the session.

Universal Provider never connects on its own. Check for a host launch and call `connect()` yourself, for example on page load:

```typescript
// synchronous and SSR-safe; also available as `provider.isHostLaunch`
if (UniversalProvider.isHostLaunch() && !provider.session) {
  await provider.connect({ optionalNamespaces });
}
```

- Each `connect()` call creates a new pairing URI and sends exactly one offer.
- If `init()` restores a session, nothing is sent and `connect()` isn't needed.
- If `postMessage` throws, `connect()` rejects. It doesn't fall back to `display_uri`.
- Only call `connect()` automatically on page load. After the user disconnects, connect again only when they ask to, or the host will receive a new offer and may approve it straight away.

## Wallet fee config

On a host launch, a wallet can share a fee config for your app. When the wallet approves the session with a `wallet_guide_id` session property, Universal Provider loads the config from the WalletConnect API after connecting, after restoring a session in `init()`, and on `session_update`. Without a host launch, or without a `wallet_guide_id`, no request is made.

`getWalletFee()` returns the part that applies to the active chain. Call it just before building a transaction:

```typescript
const fee = await provider.getWalletFee();
// { chainId: "eip155:11155111", feeBps: 50, recipient: "0x...", referralCode: "..." } | undefined

provider.on("wallet_fee_changed", (fee: WalletFee | undefined) => {
  // the active chain changed, the config loaded, or the session ended
});
```

- `recipient` is the wallet's address on the active chain, and `feeBps` is already capped by the API. Applying the fee to a transaction is up to your app.
- It resolves `undefined` when there's no config, or when the active chain has neither a recipient nor a referral code. It waits for a request in flight and never throws: failures and timeouts (3 seconds) resolve `undefined` and log a warning.
- The config is fetched once per session. Switching chains recomputes the fee without another request.
- `wallet_fee_changed` is emitted whenever the value `getWalletFee()` returns changes, including `undefined` on disconnect.
- To target another API, for example staging, pass `walletFeeApiUrl` to `init()`, without a trailing slash. It defaults to `https://api.walletconnect.com`.

## Metering

Universal Provider sends three funnel events to WalletConnect's analytics API (Pulse), tagged `st=universal-provider`:

| Event               | When                                                                                          | Properties                                               |
| ------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `CONNECT_INITIATED` | On a host launch, when `connect()` sends the pairing URI to the host                          | `connectionOrigin: "wallet"`                             |
| `CONNECT_SUCCESS`   | When `connect()` or `authenticate()` creates a new session. Restoring a session sends nothing | `connectionOrigin`, and `walletGuideId` if `"wallet"`    |
| `SIGN_SUCCESS`      | When the wallet approves a signing request on a wallet-originated session                     | `connectionOrigin`, `walletGuideId`, `chainId`, `method` |

- Every event also carries `projectId`, `clientId` (the core client ID) and a timestamp.
- A session is wallet-originated (`connectionOrigin: "wallet"`, `walletGuideId` = its `wallet_guide_id`) on a host launch where the wallet approves the session with a `wallet_guide_id`, the same rule as the wallet fee. Otherwise it's `"dapp"`.
- `SIGN_SUCCESS` counts `eth_sendTransaction`, `eth_signTransaction`, `eth_sign`, `personal_sign`, `eth_signTypedData*`, `wallet_sendCalls` and the equivalent Solana, Cosmos, Polkadot, Bitcoin, Tron and Sui methods. It covers requests sent with `provider.request()` and with `provider.client.request()`. Rejected requests and other methods send nothing.
- No request params, amounts or values are sent.
- To opt out, pass `telemetryEnabled: false` to `init()`. If you pass your own `client` or `core`, its `telemetryEnabled` setting applies.

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
