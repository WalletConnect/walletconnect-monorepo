import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";
import { IRpcConnection } from "@walletconnect/types";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  private _accounts: string[] = [];
  private _connected = false;

  public connection: IRpcConnection;

  constructor(connection: IRpcConnection) {
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

      this.connection.open();
    });
  }

  public close() {
    this.connected = false;
    this.connection.close();
  }

  public async getAccounts() {
    const result = await this.send("stark_accounts");
    return result;
  }

  public async register() {
    const result = await this.send("stark_register");
    return result;
  }

  public async deposit(amount: string, token: string) {
    const result = await this.send("stark_deposit", { amount, token });
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

  public async withdraw(token: string) {
    const result = await this.send("stark_withdraw", { token });
    return result;
  }
}

export default StarkwareProvider;
