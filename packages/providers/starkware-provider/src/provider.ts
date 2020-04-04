import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";
import { IRpcConnection } from "@walletconnect/types";

import { Token, TransferParams, OrderParams } from "./types";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  private _connected = false;
  private connection: IRpcConnection;
  private index = 0;

  public contractAddress: string;
  public starkPublicKey: string | undefined;

  constructor(connection: IRpcConnection, contractAddress: string) {
    super();
    this.connection = connection;
    this.contractAddress = contractAddress;
  }

  // -- public ---------------------------------------------------------------- //

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

  public async enable(index?: number): Promise<string> {
    try {
      if (!this.connected) {
        await this.open();
      }
      const starkPublicKey = await this.getAccount(index);
      this.emit("enable");
      return starkPublicKey;
    } catch (err) {
      this.connected = false;
      this.connection.close();
      throw err;
    }
  }

  public async send(method: string, params: any = []): Promise<any> {
    return this.connection.send({
      id: payloadId(),
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  public open(): void {
    new Promise((resolve, reject) => {
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

  public close(): void {
    this.connected = false;
    this.connection.close();
  }

  public async getAccount(index: number = this.index): Promise<string> {
    const contractAddress = this.contractAddress;
    if (this.starkPublicKey && this.index === index) {
      return this.starkPublicKey;
    }
    if (this.index !== index) {
      this.index = index;
    }
    const { starkPublicKey } = await this.send("stark_account", {
      contractAddress,
      index: this.index,
    });
    this.starkPublicKey = starkPublicKey;
    return starkPublicKey;
  }

  public async register(operatorSignature: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const { txhash } = await this.send("stark_register", {
      contractAddress,
      starkPublicKey,
      operatorSignature,
    });
    return txhash;
  }

  public async deposit(quantizedAmount: string, token: Token, vaultId: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const { txhash } = await this.send("stark_deposit", {
      contractAddress,
      starkPublicKey,
      quantizedAmount,
      token,
      vaultId,
    });
    return txhash;
  }

  public async depositCancel(token: Token, vaultId: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const { txhash } = await this.send("stark_depositCancel", {
      contractAddress,
      starkPublicKey,
      token,
      vaultId,
    });
    return txhash;
  }

  public async depositReclaim(token: Token, vaultId: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const { txhash } = await this.send("stark_depositReclaim", {
      contractAddress,
      starkPublicKey,
      token,
      vaultId,
    });
    return txhash;
  }

  public async transfer(
    to: TransferParams,
    vaultId: string,
    token: Token,
    quantizedAmount: string,
    nonce: string,
    expirationTimestamp: string,
  ): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const from = { starkPublicKey, vaultId };
    const { starkSignature } = await this.send("stark_transfer", {
      contractAddress,
      from,
      to,
      token,
      quantizedAmount,
      nonce,
      expirationTimestamp,
    });
    return starkSignature;
  }

  public async createOrder(
    sell: OrderParams,
    buy: OrderParams,
    nonce: string,
    expirationTimestamp: string,
  ): Promise<string> {
    const contractAddress = this.contractAddress;
    const starkPublicKey = await this.getAccount();
    const { starkSignature } = await this.send("stark_createOrder", {
      contractAddress,
      starkPublicKey,
      sell,
      buy,
      nonce,
      expirationTimestamp,
    });
    return starkSignature;
  }

  public async withdraw(token: Token): Promise<string> {
    const contractAddress = this.contractAddress;
    const { txhash } = await this.send("stark_withdrawal", { contractAddress, token });
    return txhash;
  }

  public async withdrawFull(vaultId: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const { txhash } = await this.send("stark_fullWithdrawal", { contractAddress, vaultId });
    return txhash;
  }

  public async freezeVault(vaultId: string): Promise<string> {
    const contractAddress = this.contractAddress;
    const { txhash } = await this.send("stark_freeze", { contractAddress, vaultId });
    return txhash;
  }

  public async verifyEspace(proof: string[]): Promise<string> {
    const contractAddress = this.contractAddress;
    const { txhash } = await this.send("stark_verifyEscape", { contractAddress, proof });
    return txhash;
  }
}

export default StarkwareProvider;
