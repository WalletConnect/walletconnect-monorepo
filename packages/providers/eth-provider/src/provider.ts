import EventEmitter from "events";
import {
  payloadId,
  isJsonRpcSubscription,
  isJsonRpcRequest,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError,
} from "@walletconnect/utils";
import WCRpcConnection from "@walletconnect/rpc-connection";
import { IError, JsonRpc } from "@walletconnect/types";

// -- types ---------------------------------------------------------------- //

interface IPromisesMap {
  [id: number]: { resolve: (res: any) => void; reject: (err: any) => void };
}

// -- EthereumProvider ---------------------------------------------------- //

class EthereumProvider extends EventEmitter {
  public connected = false;
  public promises: IPromisesMap = {};
  public subscriptions: number[] = [];
  public connection: WCRpcConnection;
  public accounts: string[] = [];
  public coinbase = "";
  public attemptedNetworkSubscription = false;
  public attemptedChainSubscription = false;
  public attemptedAccountsSubscription = false;

  constructor(connection: WCRpcConnection) {
    super();
    this.connection = connection;
  }

  public async onConnectionPayload(payload: JsonRpc) {
    const { id } = payload;
    if (typeof id !== "undefined") {
      if (this.promises[id]) {
        if (isJsonRpcResponseError(payload)) {
          this.promises[id].reject(payload.error);
        } else if (isJsonRpcResponseSuccess(payload)) {
          this.promises[id].resolve(payload.result);
        }
        delete this.promises[id];
      }
    } else if (isJsonRpcSubscription(payload)) {
      if (payload.method && payload.method.indexOf("_subscription") > -1) {
        // Emit subscription result
        this.emit(payload.params.subscription, payload.params.result);
        this.emit(payload.method, payload.params); // Latest EIP-1193
        this.emit("data", payload); // Backwards Compatibility
      }
    }
  }

  public async checkConnection() {
    try {
      this.emit("connect", await this._send("net_version"));
      this.connected = true;

      if (this.listenerCount("networkChanged") && !this.attemptedNetworkSubscription) {
        this.startNetworkSubscription();
      }

      if (this.listenerCount("chainChanged") && !this.attemptedAccountsSubscription) {
        this.startAccountsSubscription();
      }

      if (this.listenerCount("accountsChanged") && !this.attemptedAccountsSubscription) {
        this.startAccountsSubscription();
      }
    } catch (e) {
      this.connected = false;
    }
  }

  public async startNetworkSubscription() {
    this.attemptedNetworkSubscription = true;
    try {
      const networkChanged = await this.subscribe("eth_subscribe", "networkChanged");
      this.on(networkChanged, netId => this.emit("networkChanged", netId));
    } catch (e) {
      console.warn("Unable to subscribe to networkChanged", e); // tslint:disable-line
    }
  }

  public async startChainSubscription() {
    this.attemptedChainSubscription = true;
    try {
      const chainChanged = await this.subscribe("eth_subscribe", "chainChanged");
      this.on(chainChanged, chainId => this.emit("chainChanged", chainId));
    } catch (e) {
      console.warn("Unable to subscribe to chainChanged", e); // tslint:disable-line
    }
  }

  public async startAccountsSubscription() {
    this.attemptedAccountsSubscription = true;
    try {
      const accountsChanged = await this.subscribe("eth_subscribe", "accountsChanged");
      this.on(accountsChanged, accounts => this.emit("accountsChanged", accounts));
    } catch (e) {
      console.warn("Unable to subscribe to accountsChanged", e); // tslint:disable-line
    }
  }

  public enable() {
    return new Promise((resolve, reject) => {
      this.on("newListener", event => {
        if (event === "networkChanged") {
          if (!this.attemptedNetworkSubscription && this.connected) {
            this.startNetworkSubscription();
          }
        } else if (event === "chainChanged") {
          if (!this.attemptedChainSubscription && this.connected) {
            this.startChainSubscription();
          }
        } else if (event === "accountsChanged") {
          if (!this.attemptedAccountsSubscription && this.connected) {
            this.startAccountsSubscription();
          }
        }
      });

      this.connection.on("close", () => {
        this.connected = false;
        this.emit("close");
      });
      this.connection.on("payload", this.onConnectionPayload.bind(this));

      this.connection.on("connect", async () => {
        await this.checkConnection();
        try {
          const accounts: string[] = await this._send("eth_accounts");
          if (accounts.length > 0) {
            this.accounts = accounts;
            this.coinbase = accounts[0];
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

      this.connection.create();
    });
  }

  public _send(method?: string, params: any[] = []) {
    if (!method || typeof method !== "string") {
      throw new Error("Method is not a valid string.");
    }
    if (!(params instanceof Array)) {
      throw new Error("Params is not a valid array.");
    }
    const payload = { jsonrpc: "2.0", id: payloadId(), method, params };
    const promise: Promise<any> = new Promise((resolve, reject) => {
      this.promises[payload.id] = { resolve, reject };
    });
    this.connection.send(payload);
    return promise;
  }

  public send(...args: any[]) {
    // Send can be clobbered, proxy sendPromise for backwards compatibility
    return this._send(...args);
  }

  public _sendBatch(requests: JsonRpc[]) {
    return Promise.all(
      requests.map(payload => {
        if (isJsonRpcRequest(payload)) {
          this._send(payload.method, payload.params);
        }
      }),
    );
  }

  public sendAsync(payload: JsonRpc, cb: any) {
    // Backwards Compatibility
    if (!cb || typeof cb !== "function") {
      return cb(new Error("Invalid or undefined callback provided to sendAsync"));
    }
    if (!payload) {
      return cb(new Error("Invalid Payload"));
    }
    // sendAsync can be called with an array for batch requests used by web3.js 0.x
    // this is not part of EIP-1193's backwards compatibility but we still want to support it
    if (payload instanceof Array) {
      return this.sendAsyncBatch(payload, cb);
    } else if (isJsonRpcRequest(payload)) {
      return this._send(payload.method, payload.params)
        .then(result => {
          cb(null, { id: payload.id, jsonrpc: payload.jsonrpc, result });
        })
        .catch(err => {
          cb(err);
        });
    }
  }

  public sendAsyncBatch(requests: JsonRpc[], cb: any) {
    return this._sendBatch(requests)
      .then(results => {
        const result = results.map((entry, index) => {
          return {
            id: requests[index].id,
            jsonrpc: requests[index].jsonrpc,
            result: entry,
          };
        });
        cb(null, result);
      })
      .catch(err => {
        cb(err);
      });
  }

  public subscribe(type: string, method: string, params: any[] = []) {
    return this._send(type, [method, ...params]).then(id => {
      this.subscriptions.push(id);
      return id;
    });
  }

  public unsubscribe(type: string, id: number) {
    return this._send(type, [id]).then(success => {
      if (success) {
        this.subscriptions = this.subscriptions.filter(_id => _id !== id); // Remove subscription
        this.removeAllListeners(String(id)); // Remove listeners
        return success;
      }
    });
  }

  public isConnected() {
    // Backwards Compatibility
    return this.connected;
  }

  public close() {
    this.connection.close();
    this.connected = false;
    const error = new Error(`Provider closed, subscription lost, please subscribe again.`);
    this.subscriptions.forEach(id => this.emit(String(id), error)); // Send Error objects to any open subscriptions
    this.subscriptions = []; // Clear subscriptions
  }
}

export default EthereumProvider;
