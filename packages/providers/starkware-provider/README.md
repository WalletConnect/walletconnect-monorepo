# WalletConnect Starkware Provider

Starkware Provider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import StarkwareProvider from "@walletconnect/starkware-provider";

//  Create StarkwareProvider Provider
const provider = new StarkwareProvider({
  contractAddress: "0xC5273AbFb36550090095B1EDec019216AD21BE6c",
});

//  Enable session (triggers QR Code modal)
const starkPublicKey = await provider.enable();
```

## Provider API

```typescript
class StarkwareProvider {
  // provider properties
  connected: boolean;
  contractAddress: string;
  starkPublicKey?: string;

  // connection methods
  send(method: string, params: any = []): Promise<any>;
  open(): void;
  close(): void;

  // provider methods
  enable(index?: number): Promise<string>;
  getAccount(index: number = this.index): Promise<string>;
  register(operatorSignature: string): Promise<string>;
  deposit(quantizedAmount: string, token: Token, vaultId: string): Promise<string>;
  depositCancel(token: Token, vaultId: string): Promise<string>;
  depositReclaim(token: Token, vaultId: string): Promise<string>;
  transfer(
    to: TransferParams,
    vaultId: string,
    token: Token,
    quantizedAmount: string,
    nonce: string,
    expirationTimestamp: string,
  ): Promise<string>;
  createOrder(
    sell: OrderParams,
    buy: OrderParams,
    nonce: string,
    expirationTimestamp: string,
  ): Promise<string>;
  withdraw(token: Token): Promise<string>;
  withdrawFull(vaultId: string): Promise<string>;
  freezeVault(vaultId: string): Promise<string>;
  verifyEspace(proof: string[]): Promise<string>;
}
```

## Interfaces

```typescript
interface ETHTokenData {
  quantum: string;
}

interface ERC20TokenData {
  quantum: string;
  tokenAddress: string;
}

interface ERC721TokenData {
  tokenId: string;
  tokenAddress: string;
}

interface Token {
  type: string;
  data: ETHTokenData | ERC20TokenData | ERC721TokenData;
}

interface TransferParams {
  starkPublicKey: string;
  vaultID: string;
}

interface OrderParams {
  vaultID: string;
  token: Token;
  quantizedAmount: string;
}
```
