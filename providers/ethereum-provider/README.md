# @walletconnect/ethereum-provider

Ethereum Provider for WalletConnect Protocol.

## Installation

```
npm i @walletconnect/ethereum-provider @walletconnect/modal
```

## Initialization

```typescript
import { EthereumProvider } from "@walletconnect/ethereum-provider";

const provider = await EthereumProvider.init({
  projectId, // REQUIRED your projectId
  chains, // REQUIRED chain ids
  showQrModal, // REQUIRED set to "true" to use @walletconnect/modal,
  methods, // OPTIONAL ethereum methods
  events, // OPTIONAL ethereum events
  rpcMap, // OPTIONAL rpc urls for each chain
  metadata, // OPTIONAL metadata of your app
  qrModalOptions, // OPTIONAL - `undefined` by default
});
```

## Display WalletConnectModal with QR code / Handle connection URI

```typescript
// WalletConnectModal is disabled by default, enable it during init() to display a QR code modal
await provider.connect({
  chains, // OPTIONAL chain ids
  rpcMap, // OPTIONAL rpc urls
  pairingTopic, // OPTIONAL pairing topic
});
// or
await provider.enable();
```

```typescript
// If you are not using WalletConnectModal,
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

## Supported WalletConnectModal options (qrModalOptions)

Please reference [up to date documentation](https://docs.walletconnect.com/2.0/web/web3modal/html/ethereum-provider/options) for `WalletConnectModal`
