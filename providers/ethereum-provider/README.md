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
  showQrModal, // REQUIRED set to "true" to use @web3modal/standalone,
  methods, // OPTIONAL ethereum methods
  events, // OPTIONAL ethereum events
  rpcMap, // OPTIONAL rpc urls for each chain
  metadata, // OPTIONAL metadata of your app
  qrModalOptions, // OPTIONAL - `undefined` by default, see https://docs.walletconnect.com/2.0/web3modal/options
});
```

## Display Web3Modal with QR code / Handle connection URI

```typescript
// Web3Modal is disabled by default, enable it during init() to display a QR code modal
await provider.connect({
  chains, // OPTIONAL chain ids
  rpcMap, // OPTIONAL rpc urls
  pairingTopic, // OPTIONAL pairing topic
});
// or
await provider.enable();
```

```typescript
// If you are not using Web3Modal,
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

## Supported Web3Modal options (qrModalOptions)

- [themeMode](https://docs.walletconnect.com/2.0/web3modal/options#thememode-optional)
- [themeVariables](https://docs.walletconnect.com/2.0/web3modal/options#themevariables-optional)
- [chainImages](https://docs.walletconnect.com/2.0/web3modal/options#chainimages-optional)
- [tokenImages](https://docs.walletconnect.com/2.0/web3modal/options#tokenimages-optional)
- [walletImages](https://docs.walletconnect.com/2.0/web3modal/options#walletimages-optional)
- [desktopWallets](https://docs.walletconnect.com/2.0/web3modal/options#desktopwallets-optional)
- [mobileWallets](https://docs.walletconnect.com/2.0/web3modal/options#mobilewallets-optional)
- [enableExplorer](https://docs.walletconnect.com/2.0/web3modal/options#enableexplorer-optional)
- [explorerAllowList](https://docs.walletconnect.com/2.0/web3modal/options#explorerallowlist-optional)
- [explorerDenyList](https://docs.walletconnect.com/2.0/web3modal/options#explorerdenylist-optional)
- [privacyPolicyUrl](https://docs.walletconnect.com/2.0/web3modal/options#privacypolicyurl-optional)
- [termsOfServiceUrl](https://docs.walletconnect.com/2.0/web3modal/options#privacypolicyurl-optional)
