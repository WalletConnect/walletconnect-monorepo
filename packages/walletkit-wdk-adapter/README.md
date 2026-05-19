# @walletconnect/walletkit-wdk-adapter

A thin adapter that simplifies [`@reown/walletkit`](https://www.npmjs.com/package/@reown/walletkit) with WDK.

It removes the boilerplate of constructing a `Core` instance yourself: you provide a `projectId` and `metadata`, and the adapter returns a fully-initialized `WalletKit` client ready to handle pairings, sessions, and requests.

## Installation

```bash
npm install @walletconnect/walletkit-wdk-adapter
```

The adapter has the following runtime dependencies, which are installed automatically:

- `@reown/walletkit`
- `@walletconnect/core`

## Usage

### Basic initialization

```ts
import { WalletKitWdkAdapter } from "@walletconnect/walletkit-wdk-adapter";

const walletKit = await WalletKitWdkAdapter.init({
  projectId: "YOUR_PROJECT_ID",
  metadata: {
    name: "My Wallet",
    description: "My WalletConnect wallet",
    url: "https://my-wallet.example",
    icons: ["https://my-wallet.example/icon.png"],
  },
});

walletKit.on("session_proposal", async ({ id, params }) => {
  // approve / reject the proposal here
});

await walletKit.pair({ uri: "wc:..." });
```

`WalletKitWdkAdapter.init(...)` returns an `IWalletKit` instance — the same interface exposed by `@reown/walletkit`. Anywhere in your app where you'd previously type against `IWalletKit`, you can keep doing so.

### Options

`WalletKitWdkAdapter.init` accepts every option that `WalletKit.init` accepts, except for `core` (which the adapter constructs internally). You must pass a `projectId`, which is forwarded to the underlying `Core`.

```ts
type Options = Omit<WalletKitTypes.Options, "core"> & {
  projectId: string;
};
```

| Field        | Required | Description                                                            |
| ------------ | -------- | ---------------------------------------------------------------------- |
| `projectId`  | yes      | WalletConnect Cloud project ID, used to construct the internal `Core`. |
| `metadata`   | yes      | Wallet metadata (`name`, `description`, `url`, `icons`).               |
| `name`       | no       | Optional client name. Defaults to `"WalletKit"`.                       |
| `signConfig` | no       | Forwarded to the underlying `SignClient`.                              |
| `payConfig`  | no       | Forwarded to `WalletKitPay`.                                           |

Get a `projectId` at [WalletConnect Dashboard](https://dashboard.walletconnect.com).

### Bring your own `Core`

If you need to share a `Core` across multiple clients, or want full control over relay/storage configuration, use `@reown/walletkit` directly:

```ts
import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";

const core = new Core({ projectId: "YOUR_PROJECT_ID" });
const walletKit = await WalletKit.init({ core, metadata });
```

The adapter is a convenience layer; the WalletKit instance it returns is identical in shape.

## API

### `WalletKitWdkAdapter.init(opts): Promise<IWalletKit>`

Constructs a new internal `Core` from `opts.projectId`, calls `WalletKit.init({ core, ...opts })`, and returns the initialized WalletKit instance.

### `new WalletKitWdkAdapter(opts)`

Low-level constructor. Holds the options but does not initialize anything until you call `initialize()`. Prefer the static `init` factory in most cases.

### `adapter.initialize(): Promise<IWalletKit>`

Performs the same work as the static `init` factory and returns the `IWalletKit` instance. Also assigned to `adapter.walletKit`.

## License

see LICENSE.md
