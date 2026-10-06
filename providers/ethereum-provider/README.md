# @walletconnect/ethereum-provider

Ethereum Provider for WalletConnect Protocol.

## Installation

```
npm i @walletconnect/ethereum-provider
```

## Initialization

```typescript
import { EthereumProvider } from "@walletconnect/ethereum-provider";

const provider = await EthereumProvider.init({
  projectId, // REQUIRED your projectId
  chains, // DEPRECATED, use `optionalChains` instead
  optionalChains, // REQUIRED optional chain ids e.g. 1 (Ethereum), 10 (Optimism), 42161 (Arbitrum)
  showQrModal, // REQUIRED set to "true" to use @walletconnect/modal,
  methods, // OPTIONAL ethereum methods
  events, // OPTIONAL ethereum events
  rpcMap, // OPTIONAL rpc urls for each chain
  metadata, // OPTIONAL metadata of your app
  storage, // OPTIONAL custom storage implementation
  storageOptions, // OPTIONAL storage config options
  qrModalOptions, // OPTIONAL - `undefined` by default
  client, // OPTIONAL existing @walletconnect/sign-client instance to reuse instead of creating a new one
  core, // OPTIONAL existing @walletconnect/core instance to share (ignored when `client` is provided)
  walletFeeApiUrl, // OPTIONAL base URL of the wallet fee API, see "Wallet launch and wallet fee"
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

## Wallet launch and wallet fee

A wallet can open your app in its in-app browser and inject a bridge, `window.walletConnectHost`, before the page loads. On such a launch, `connect()` and `enable()` hand the pairing URI to the wallet instead of emitting `display_uri`, and **the QR modal doesn't open**, even with `showQrModal: true`. The provider never connects on its own: check for a wallet launch and call `enable()` once on page load, or once the user accepts your terms if your app asks for that first.

```typescript
// synchronous and SSR-safe; also available as `provider.isHostLaunch`
if (EthereumProvider.isHostLaunch()) {
  const provider = await EthereumProvider.init({ projectId, optionalChains, showQrModal: true });
  if (!provider.session) await provider.enable();
}
```

- Don't show your wallet selector on a wallet launch, and don't reconnect automatically after the user disconnects.
- `authenticate()` isn't supported on a wallet launch yet: it still emits `display_uri` and opens the QR modal. Use `enable()`, and ask for a `personal_sign` afterwards if you need a sign-in.

When the wallet approves the session with a `wallet_guide_id`, the provider loads the wallet's fee for your app. `getWalletFee()` returns it for the active chain, `provider.chainId`. Call it just before building a transaction, after switching to the chain you transact on:

```typescript
import type { WalletFee } from "@walletconnect/ethereum-provider";

await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa" }] });
const fee: WalletFee | undefined = await provider.getWalletFee();
// { chainId: "eip155:10", feeBps: 50, recipient: "0x...", referralCode: "..." } | undefined

provider.on("wallet_fee_changed", (fee: WalletFee | undefined) => {
  // the config loaded, the chain changed, or the session ended
});
```

- `undefined` means no fee. It never throws.
- To target another API, for example staging, pass `walletFeeApiUrl` to `init()`.
- The funnel events used to count your volume are sent by Universal Provider, so keep `telemetryEnabled` on (the default).

See Universal Provider's README ("Host-originated launch", "Wallet fee config" and "Metering") for the details.

## Supported WalletConnectModal options (qrModalOptions)

Please reference [up to date documentation](https://docs.walletconnect.com/2.0/web/web3modal/html/ethereum-provider/options) for `WalletConnectModal`

## Usage with SSR Frameworks (e.g., Next.js)

The Ethereum Provider interacts with browser-specific APIs (like `window`, `document`, `localStorage`) which are not available during Server-Side Rendering (SSR). Attempting to import or initialize the provider directly in code that runs on the server will cause errors (e.g., `ReferenceError: HTMLElement is not defined`).

To use `@walletconnect/ethereum-provider` with frameworks like Next.js (using the App Router or Pages Router), you must ensure that the library is only imported and used on the client-side.

**Recommended Approach (Next.js):**

1.  **Isolate Usage:** Create a dedicated React component (e.g., `WalletConnectProvider.tsx` or `Web3Provider.tsx`) that handles the initialization and interaction with the `EthereumProvider`. Mark this component as a Client Component using the `"use client";` directive at the top of the file.
2.  **Dynamic Import:** In the parent component (which could be a Server Component page or another Client Component), import your dedicated component dynamically with SSR disabled.

**Example (`src/app/page.tsx` or similar):**

```typescript
// src/app/page.tsx (or your main layout/page)
"use client"; // Required if the page itself uses the dynamic import directly

import dynamic from 'next/dynamic';
import { Suspense } from 'react'; // Optional: Add loading UI

// Dynamically import the component that uses EthereumProvider
const WalletConnectLogic = dynamic(
  () => import('@/components/WalletConnectLogic'), // Path to your client component
  {
    ssr: false, // This is crucial to prevent server-side execution
    // Optional: Display a loading state while the component is loading
    // loading: () => <p>Loading WalletConnect...</p>,
  }
);

export default function Home() {
  return (
    <div>
      {/* Other page content */}
      <Suspense fallback={<p>Loading WalletConnect...</p>}> {/* Optional Suspense boundary */}
        <WalletConnectLogic />
      </Suspense>
      {/* Other page content */}
    </div>
  );
}
```

**Example (`src/components/WalletConnectLogic.tsx`):**

```typescript
// src/components/WalletConnectLogic.tsx
"use client"; // Mark this component as client-side only

import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { useEffect, useState, useCallback } from "react";

// Your WalletConnect Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

let provider: Awaited<ReturnType<typeof EthereumProvider.init>> | null = null;

export default function WalletConnectLogic() {
  const [account, setAccount] = useState<string | null>(null);
  // ... other state (isConnected, chainId, etc.)

  const initialize = useCallback(async () => {
    if (!projectId) {
       throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    }
    if (provider) return; // Already initialized

    try {
      provider = await EthereumProvider.init({
        projectId: projectId,
        optionalChains: [1, 10, 137], // Example chains
        showQrModal: true,
        metadata: { /* ... your metadata ... */ }
        // ... other options
      });

      // --- Add event listeners ---
      provider.on("connect", (info: { chainId: string }) => {
         console.log("connect", info);
         // Set initial account/chain state
      });
      provider.on("accountsChanged", (accounts: string[]) => {
         console.log("accountsChanged", accounts);
         setAccount(accounts[0] ?? null);
      });
      // ... other listeners (disconnect, chainChanged)

      // Check for existing session
      if (provider.session && provider.accounts.length > 0) {
        setAccount(provider.accounts[0]);
        // set chainId, isConnected etc.
      }

    } catch (error) {
      console.error("Failed to initialize WalletConnect Provider", error);
    }
  }, []);

  useEffect(() => {
    // Initialize provider on component mount (client-side)
    initialize();

    // Optional: Cleanup listeners on unmount
    return () => {
      // provider?.off(...);
    };
  }, [initialize]);

  const connectWallet = useCallback(async () => {
    if (!provider) {
       console.error("Provider not initialized");
       return;
    }
    try {
      await provider.connect();
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, []);

  // ... other functions (disconnect, signMessage, etc.)

  return (
    <div>
      {/* Your Connect/Disconnect buttons, account display, etc. */}
      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <p>Connected: {account}</p>
      )}
      {/* ... */}
    </div>
  );
}

```

This pattern ensures the provider code only runs in the browser, avoiding SSR compatibility issues. Similar approaches (lazy loading components that use browser APIs) exist for other SSR frameworks.
