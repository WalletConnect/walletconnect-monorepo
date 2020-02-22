import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";
import WCRpcConnection from "@walletconnect/rpc-connection";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  private _accounts: string[] = [];
  private _connected = false;

  public connection: WCRpcConnection;

  constructor(connection: WCRpcConnection) {
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

  public send(method: string, params: any = []) {
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
    await this.send("stark_accounts");
    // 1. send stark_accounts with array of starkKeys
    // 2. wallet returns accounts array
    const accounts: string[] = [];
    return { accounts };
  }

  public async register() {
    await this.send("stark_register");
    // 1. send stark_register with registry address
    // 2. wallet generates starkKey (if not present)
    // 3. wallet signs and ETH message of the hash of ethKey and hashKey
    // 4. wallet sends transaction of starkKey and registration signature to smart contract
    // 5. wallet returns accounts array and transaction hash
    const accounts: string[] = [];
    const txhash = "";
    return { accounts, txhash };
  }

  public async deposit() {
    await this.send("stark_deposit");
    // 1. send stark_deposit with tokenAddress and amount
    // 2. wallet verifies balance and asserts
    // 3. wallet calls deposit on smart contract
    // 4. wallets returns transaction hash
    const txhash = "";
    return { txhash };
  }

  public async transfer() {
    await this.send("stark_transfer");
    // 1. format message to be signed
    // 2. send stark_sign with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
    const signature = "";
    return { signature };
  }

  public async trade() {
    await this.send("stark_sign");
    // 1. format message to be signed
    // 2. send stark_sign with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
    const signature = "";
    return { signature };
  }

  public async withdraw() {
    await this.send("stark_withdraw");
    // 1. format message to be signed
    // 2. send stark_withdraw with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
    const signature = "";
    return { signature };
  }
}

export default StarkwareProvider;
