import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";
// import WCRpcConnection from "@walletconnect/rpc-connection";
import { formatMessage } from "starkware-crypto";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  private _accounts: string[] = [];
  private _connected = false;

  // @ts-ignore
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
    const {} = await this.send("stark_accounts");
    // 1. send stark_accounts with array of starkKeys
    // 2. wallet returns accounts array
    const accounts: string[] = [];
    return { accounts };
  }

  public async register() {
    // 1. send stark_register with registry address
    const { accounts, txhash } = await this.send("stark_register");
    // 2. wallet generates starkKey (if not present)
    // 3. wallet signs and ETH message of the hash of ethKey and hashKey
    // 4. wallet sends transaction of starkKey and registration signature to smart contract
    // 5. wallet returns accounts array and transaction hash
    return { accounts, txhash };
  }

  public async deposit(tokenAddress: string) {
    // 1. send stark_deposit with tokenAddress and amount
    const { txhash } = await this.send("stark_deposit", { tokenAddress });
    // 2. wallet verifies balance and asserts
    // 3. wallet calls deposit on smart contract
    // 4. wallets returns transaction hash
    return { txhash };
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
    // 1. format message to be signed
    const message = formatMessage(
      "transfer",
      senderVaultId,
      receiverVaultId,
      amount,
      "0",
      token,
      receiverPublicKey,
      nonce,
      expirationTimestamp,
    );
    // 2. send stark_sign with formatted message
    const { signature } = await this.send("stark_transfer", { message });
    // 3. wallet signs message
    // 4. wallet returns signature
    return { signature };
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
    // 1. format message to be signed
    const message = formatMessage(
      "order",
      vaultSell,
      vaultBuy,
      amountSell,
      amountBuy,
      tokenSell,
      tokenBuy,
      nonce,
      expirationTimestamp,
    );
    // 2. send stark_sign with formatted message
    const { signature } = await this.send("stark_sign", { message });
    // 3. wallet signs message
    // 4. wallet returns signature
    return { signature };
  }

  public async withdraw(address: string) {
    // 1. send stark_withdraw with formatted message
    const { signature } = await this.send("stark_withdraw", { address });
    // 2. wallet signs message
    // 3. wallet returns signature
    return { signature };
  }
}

export default StarkwareProvider;
