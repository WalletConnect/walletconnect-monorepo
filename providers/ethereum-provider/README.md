# @walletconnect/ethereum-provider

Ethereum Provider for WalletConnect Protocol.

## Installation

```
npm i @walletconnect/ethereum-provider @web3modal/standalone
```

## Initialization

```typescript
import { EthereumProvider } from "@walletconnect/ethereum-provider";

const provider = await EthereumProvider.init({
  projectId, // REQUIRED your projectId
  chains, // REQUIRED chain ids
  methods, // OPTIONAL ethereum methods
  events, // OPTIONAL ethereum events
  rpcMap, // OPTIONAL rpc urls for each chain
  metadata, // OPTIONAL metadata of your app
  showQrModal, // OPTIONAL - `true` by default,
  qrModalOptions, // OPTIONAL - `undefined` by default, see https://docs.walletconnect.com/2.0/web3modal/theming
});
```

## Display Web3Modal with QR code / Handle connection URI

```typescript
// Web3Modal is enabled by default and will display a QR code modal
await provider.connect({
  chains, // OPTIONAL chain ids
  rpcMap, // OPTIONAL rpc urls
  pairingTopic, // OPTIONAL pairing topic
});
// or
await provider.enable();
```

```typescript
// If you wish to disable the built-in modal via `showQrModal`,
// you can subscribe to the `display_uri` event and handle the URI yourself.
provider.on("display_uri", (uri: string) => {
  // ... custom logic
});

await provider.connect();
// or
await provider.enable();
```

## Sending Requests

```typescript
const result = await provider.request({ method: "eth_requestAccounts" });

// OR

provider.sendAsync({ method: "eth_requestAccounts" }, CallBackFunction);
```

## Events

```typescript
// chain changed
provider.on("chainChanged", handler);
// accounts changed
provider.on("accountsChanged", handler);
// session established
provider.on("connect", handler);
// session event - chainChanged/accountsChanged/custom events
provider.on("session_event", handler);
// connection uri
provider.on("display_uri", handler);
// session disconnect
provider.on("disconnect", handler);
```
