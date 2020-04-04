# WalletConnect Starkware Provider

Starkware Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Setup

```javascript
import StarkwareProvider from "@walletconnect/starkware-provider";

//  Create StarkwareProvider Provider
const provider = new StarkwareProvider();

//  Enable session (triggers QR Code modal)
const accounts = await provider.enable();

//  Get StarkKey
const starkKey = accounts[0];
```

## Provider Methods

```javascript
// Get accounts
const accounts = await provider.getAccounts();

// Register account
const txhash = await provider.register(signature);

// Deposit asset
const txhash = await provider.deposit(amount, token, vaultId);

// Transfer asset
const signature = await provider.transfer(
  amount,
  nonce,
  senderVaultId,
  token,
  receiverVaultId,
  receiverPublicKey,
  expirationTimestamp,
);

// Create Limit Order
const signature = await provider.createOrder(
  vaultSell,
  vaultBuy,
  amountSell,
  amountBuy,
  tokenSell,
  tokenBuy,
  nonce,
  expirationTimestamp,
);

// Withdraw Asset
const txhash = await provider.withdraw(token);

// Close provider session
await provider.close();
```
