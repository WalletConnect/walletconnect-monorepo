import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  private _accounts: string[] = [];
  private _connected = false;

  public connection: any;

  constructor(connection: any) {
    super();
    this.connection = connection;
  }

  // -- public ---------------------------------------------------------------- //
  get accounts(): string[] {
    return this._accounts;
  }

  set connected(value: boolean) {
    this._connected = value;
    if (value === true) {
      this.emit("connect");
    } else {
      this.emit("close");
    }
  }

  get connected(): boolean {
    return this._connected;
  }

  public async enable() {
    try {
      if (!this.connected) {
        await this.open();
      }
      const { accounts } = await this.register();
      this.emit("enable");
      return accounts;
    } catch (err) {
      this.connected = false;
      this.connection.close();
      throw err;
    }
  }

  public async send(method: string, params: any = []) {
    return this.connection.send({
      id: payloadId(),
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  public open() {
    return new Promise((resolve, reject) => {
      this.connection.on("close", () => {
        this.connected = false;
        reject();
      });

      this.connection.on("connect", () => {
        this.connected = true;
        resolve();
      });

      this.connection.create();
    });
  }

  public close() {
    this.connected = false;
    this.connection.close();
  }

  public async getAccounts() {
    const result = await this.send("stark_accounts");
    // 1. send stark_accounts with array of starkKeys
    // 2. wallet returns accounts array
    return result;
  }

  public async register() {
    // 1. send stark_register with registry address
    const result = await this.send("stark_register");
    // 2. wallet generates starkKey (if not present)
    // 3. wallet signs and ETH message of the hash of ethKey and hashKey
    // 4. wallet sends transaction of starkKey and registration signature to smart contract
    // 5. wallet returns accounts array and transaction hash
    return result;
  }

  public async deposit(amount: string, token: string) {
    // 1. send stark_deposit with tokenAddress and amount
    const result = await this.send("stark_deposit", { amount, token });
    // 2. wallet verifies balance and asserts
    // 3. wallet calls deposit on smart contract
    // 4. wallets returns transaction hash
    return result;
  }

  public async transfer(
    amount: string,
    nonce: string,
    senderVaultId: string,
    token: string,
    receiverVaultId: string,
    receiverPublicKey: string,
    expirationTimestamp: string,
  ) {
    const result = await this.send("stark_transfer", {
      amount,
      nonce,
      senderVaultId,
      token,
      receiverVaultId,
      receiverPublicKey,
      expirationTimestamp,
    });
    return result;
  }

  public async createOrder(
    vaultSell: string,
    vaultBuy: string,
    amountSell: string,
    amountBuy: string,
    tokenSell: string,
    tokenBuy: string,
    nonce: string,
    expirationTimestamp: string,
  ) {
    const result = await this.send("stark_createOrder", {
      vaultSell,
      vaultBuy,
      amountSell,
      amountBuy,
      tokenSell,
      tokenBuy,
      nonce,
      expirationTimestamp,
    });
    return result;
  }

  public async withdraw(address: string) {
    // 1. send stark_withdraw
    const result = await this.send("stark_withdraw", { address });
    // 2. wallet signs message
    // 3. wallet returns signature
    return result;
  }
}

export default StarkwareProvider;
