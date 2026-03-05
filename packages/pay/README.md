# WalletConnect Pay SDK

TypeScript SDK for WalletConnect Pay - a payment solution for React Native and web applications.

## Installation

```bash
npm install @walletconnect/pay
```

### React Native Setup

This SDK requires the WalletConnect React Native native module. Make sure you have `@walletconnect/react-native-compat` installed and linked in your React Native project.

### Web Setup (Coming Soon)

WASM provider support for web browsers is coming in a future release.

## Architecture

The SDK uses a provider abstraction that allows different implementations:

- **NativeProvider**: Uses React Native uniffi module (current)
- **WasmProvider**: Uses WebAssembly module (coming soon)

The SDK auto-detects the best available provider for your environment.

## Usage

### Initialize the Client

```typescript
import { WalletConnectPay } from "@walletconnect/pay";

const client = new WalletConnectPay({
  appId: "your-app-id",
  // OR use apiKey instead:
  // apiKey: "your-api-key",
});
```

### Get Payment Options

Retrieve available payment options for a payment link:

```typescript
const options = await client.getPaymentOptions({
  paymentLink: "https://pay.walletconnect.com/pay_123",
  accounts: ["eip155:8453:0xYourAddress"], // CAIP-10 accounts
  includePaymentInfo: true,
});

console.log("Payment ID:", options.paymentId);
console.log("Options:", options.options);
```

### Get Required Actions

Get the wallet RPC actions required to complete a payment option:

```typescript
const actions = await client.getRequiredPaymentActions({
  paymentId: options.paymentId,
  optionId: options.options[0].id,
});

// Each action contains wallet RPC data to sign
for (const action of actions) {
  console.log("Chain:", action.walletRpc.chainId);
  console.log("Method:", action.walletRpc.method);
  console.log("Params:", action.walletRpc.params);
}
```

### Sign and Confirm Payment

Sign the actions with your wallet and confirm the payment:

```typescript
// Sign each action with your wallet (implementation depends on your wallet SDK)
const signatures = await Promise.all(
  actions.map((action) =>
    wallet.signTypedData(action.walletRpc.chainId, JSON.parse(action.walletRpc.params)),
  ),
);

// Confirm the payment
const result = await client.confirmPayment({
  paymentId: options.paymentId,
  optionId: options.options[0].id,
  signatures,
});

if (result.status === "succeeded") {
  console.log("Payment successful!");
} else if (result.status === "processing") {
  console.log("Payment is processing...");
}
```

### Collected Data

Some payments may require additional user data:

```typescript
const options = await client.getPaymentOptions({
  paymentLink,
  accounts,
});

if (options.collectData) {
  // Show UI to collect required fields
  const collectedData = options.collectData.fields.map((field) => ({
    id: field.id,
    value: getUserInput(field.name, field.fieldType),
  }));

  // Include collected data when confirming
  const result = await client.confirmPayment({
    paymentId: options.paymentId,
    optionId: selectedOptionId,
    signatures,
    collectedData,
  });
}
```

## API Reference

### WalletConnectPay

#### Constructor

```typescript
new WalletConnectPay(options: WalletConnectPayOptions)
```

| Option   | Type   | Required | Description                                  |
| -------- | ------ | -------- | -------------------------------------------- |
| appId    | string | No*      | App ID for authentication                    |
| apiKey   | string | No*      | API key for authentication                   |
| clientId | string | No       | Client ID for tracking                       |
| baseUrl  | string | No       | Custom API base URL                          |
| logger   | Logger | No       | Custom logger instance or level              |

\* Either `appId` or `apiKey` must be provided for authentication.

#### Methods

##### `getPaymentOptions(params)`

Get available payment options for a payment link.

```typescript
interface GetPaymentOptionsParams {
  paymentLink: string; // Payment link or ID
  accounts: string[]; // CAIP-10 accounts
  includePaymentInfo?: boolean; // Include payment info in response
}
```

##### `getRequiredPaymentActions(params)`

Get the wallet RPC actions required to complete a payment.

```typescript
interface GetRequiredPaymentActionsParams {
  paymentId: string; // Payment ID
  optionId: string; // Selected option ID
}
```

##### `confirmPayment(params)`

Submit signatures and confirm the payment.

```typescript
interface ConfirmPaymentParams {
  paymentId: string; // Payment ID
  optionId: string; // Selected option ID
  signatures: string[]; // Wallet RPC signatures
  collectedData?: CollectDataFieldResult[]; // Collected data fields
}
```

##### `static isAvailable()`

Check if a provider is available on the current platform.

### Provider Utilities

```typescript
import {
  isProviderAvailable,
  detectProviderType,
  isNativeProviderAvailable,
  setNativeModule,
} from "@walletconnect/pay";

// Check if any provider is available
if (isProviderAvailable()) {
  // SDK can be used
}

// Detect which provider type is available
const providerType = detectProviderType(); // 'native' | 'wasm' | null

// Check specifically for native provider
if (isNativeProviderAvailable()) {
  // React Native native module is available
}

// Manually inject native module (if auto-discovery fails)
import { NativeModules } from "react-native";
setNativeModule(NativeModules.RNWalletConnectPay);
```

## Types

### PaymentStatus

```typescript
type PaymentStatus = "requires_action" | "processing" | "succeeded" | "failed" | "expired";
```

### PaymentOption

```typescript
interface PaymentOption {
  id: string;
  account: string; // CAIP-10 account for this option
  amount: PayAmount;
  etaS: number;
  actions: Action[];
}
```

### Action

```typescript
interface Action {
  walletRpc: WalletRpcAction;
}

interface WalletRpcAction {
  chainId: string;
  method: string;
  params: string; // JSON string
}
```

### PayProviderType

```typescript
type PayProviderType = "native" | "wasm";
```

## Error Handling

The SDK throws typed errors for different failure scenarios:

```typescript
import { PayError, PaymentOptionsError, ConfirmPaymentError } from "@walletconnect/pay";

try {
  const options = await client.getPaymentOptions({
    paymentLink: link,
    accounts,
  });
} catch (error) {
  if (error instanceof PaymentOptionsError) {
    console.error("Failed to get options:", error.originalMessage);
  } else if (error instanceof PayError) {
    console.error("Pay error:", error.code, error.message);
  }
}
```

## License

WalletConnect Community License
