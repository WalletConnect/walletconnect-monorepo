import EventEmitter from "events";
import { payloadId } from "@walletconnect/utils";
import { IError } from "@walletconnect/types";
import WCRpcConnection from "@walletconnect/rpc-connection";

// -- StarkwareProvider ---------------------------------------------------- //

class StarkwareProvider extends EventEmitter {
  public connected = false;
  public connection: WCRpcConnection;

  constructor(connection: WCRpcConnection) {
    super();
    this.connection = connection;
  }

  // -- public ---------------------------------------------------------------- //

  public enable() {
    return new Promise((resolve, reject) => {
      this.connection.on("close", () => {
        this.connected = false;
        this.emit("close");
      });

      this.connection.on("connect", () => {
        this.onConnect()
          .then(resolve)
          .catch(reject);
      });

      this.connection.create();
    });
  }

  public send(method: string, params: any = null) {
    return this.connection.send({
      id: payloadId(),
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  public close() {
    this.connection.close();
    this.connected = false;
  }

  public register() {
    // 1. send stark_register with registry address
    // 2. wallet generates starkKey (if not present)
    // 3. wallet signs and ETH message of the hash of ethKey and hashKey
    // 4. wallet sends transaction of starkKey and registration signature to smart contract
    // 5. wallet returns transaction hash
  }

  public deposit() {
    // 1. send stark_deposit with tokenAddress and amount
    // 2. wallet verifies balance and asserts
    // 3. wallet calls deposit on smart contract
    // 4. wallets returns transaction hash
  }

  public transfer() {
    // 1. format message to be signed
    // 2. send stark_sign with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
  }

  public trade() {
    // 1. format message to be signed
    // 2. send stark_sign with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
  }

  public withdraw() {
    // 1. format message to be signed
    // 2. send stark_sign with formatted message
    // 3. wallet signs message
    // 4. wallet returns signature
  }

  // -- private ---------------------------------------------------------------- //

  private onConnect() {
    return new Promise(async (resolve, reject) => {
      try {
        const accounts: string[] = await this.send("stark_enable");
        if (accounts.length > 0) {
          this.emit("enable");
          this.emit("connect");
          resolve(accounts);
        } else {
          const err: IError = new Error("User Denied Full Provider");
          err.code = 4001;
          this.connected = false;
          this.connection.close();
          reject(err);
        }
      } catch (e) {
        this.connected = false;
        this.connection.close();
        reject(e);
      }
    });
  }
}

export default StarkwareProvider;
