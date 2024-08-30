# TezosProvider

The `TezosProvider` is a class that allows you to interact with the Tezos blockchain via the WalletConnect protocol.
This provider manages the connection to the Tezos network, facilitates transactions, and handles account management.

## Installation

```
npm i @walletconnect/tezos-provider @walletconnect/modal
```

## Initialization

To use `TezosProvider`, you first need to initialize it with the necessary options:

```typescript
import TezosProvider from 'path-to-tezos-provider';

const provider = await TezosProvider.init({
  projectId: 'your-project-id', // REQUIRED WalletConnect project ID
  metadata: {
    name: 'Your DApp Name',
    description: 'Your DApp Description',
    url: 'https://your-dapp-url.com',
    icons: ['https://your-dapp-url.com/icon.png'],
  },
  relayUrl: 'wss://relay.walletconnect.com', // OPTIONAL WalletConnect relay URL
  storageOptions: {}, // OPTIONAL key-value storage settings
  disableProviderPing: false, // OPTIONAL set to true to disable provider ping
  logger: 'info', // OPTIONAL log level, default is 'info'
});
```

Default relay URL is defined in `RelayUrl`.

### Options (TezosProviderOpts)

- `projectId`: Your WalletConnect project ID.
- `metadata`: Metadata for your DApp, including name, description, url, and icons.
- `relayUrl`: URL of the WalletConnect relay server.
- `storageOptions`: Optional settings for key-value storage.
- `disableProviderPing`: If set to true, disables provider ping.
- `logger`: Sets the log level, default is 'info'.

## Display WalletConnectModal with QR code / Connecting to the Tezos Network

After initializing the provider, you can connect it to the Tezos network:

```typescript
await provider.connect({
  chains: [
    {
      id: 'tezos:mainnet',
      rpc: ['https://mainnet-tezos.giganode.io'],
    },
  ],
  methods: ['tezos_getAccounts', 'tezos_send', 'tezos_sign'],
  events: [], // OPTIONAL Tezos events
});
```

Connection Options (TezosConnectOpts):

- `chains`: An array of chain data, each with an id and rpc endpoint(s). Default chain data is defined in `TezosChainMap`.
- `methods`: An array of methods that the provider should support. Default methods are defined in `DefaultTezosMethods`.
- `events`: An array of event names that the provider should listen for.

If you are not using a modal for QR code display, you can subscribe to the `display_uri` event to handle the connection URI yourself:

```typescript
provider.on("display_uri", (uri: string) => {
  // Handle the connection URI
  console.log('Connection URI:', uri);
});

await provider.connect();
```

## Sending requests

### Get Accounts

To send a request to the Tezos network:

```typescript
const accounts = await provider.request({ method: "tezos_getAccounts" });

// OR

provider.sendAsync({ method: "tezos_getAccounts" }, callbackFunction);
```

### Send Transactions

To send a transaction:

```typescript
const transactionResponse = await provider.tezosSendTransaction({
  kind: 'transaction',
  destination: 'tz1...',
  amount: '1000000', // Amount in mutez
});

console.log('Transaction hash:', transactionResponse.hash);
```

### Sign Messages

To sign a message, encode it to hex first:

```typescript
const textEncoder = new TextEncoder();
const bytes = textEncoder.encode('Your string here');
const hexBytes = Buffer.from(bytes).toString('hex');

const signResponse = await provider.tezosSign({
  payload: hexBytes,
});

console.log('Signature:', signResponse.signature);
```

## Events

Listen to various events from the TezosProvider:

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

## Error Handling
The provider will throw errors if:

- `TezosInitializationError`: If the provider is not initialized correctly.
- `TezosProviderError`: If there are issues with the connection or account retrieval.

## Supported WalletConnectModal options (qrModalOptions)

Please reference the [up-to-date WalletConnect documentation](https://docs.walletconnect.com) for any additional `qrModalOptions`.

## References

- [Tezos documentation for WalletConnect](https://docs.walletconnect.com/advanced/multichain/rpc-reference/tezos-rpc)
- [dApp examples](https://github.com/WalletConnect/web-examples/tree/main/dapps)
