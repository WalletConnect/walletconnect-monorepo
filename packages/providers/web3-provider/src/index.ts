import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";
import HttpConnection from "@walletconnect/http-connection";
import {
  IRPCMap,
  IConnector,
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IWalletConnectProviderOptions,
} from "@walletconnect/types";

const ProviderEngine = require("web3-provider-engine");
const CacheSubprovider = require("web3-provider-engine/subproviders/cache");
const FixtureSubprovider = require("web3-provider-engine/subproviders/fixture");
const FilterSubprovider = require("web3-provider-engine/subproviders/filters");
const HookedWalletSubprovider = require("web3-provider-engine/subproviders/hooked-wallet");
const NonceSubprovider = require("web3-provider-engine/subproviders/nonce-tracker");
const SubscriptionsSubprovider = require("web3-provider-engine/subproviders/subscriptions");

class WalletConnectProvider extends ProviderEngine {
  public bridge = "https://bridge.walletconnect.org";
  public qrcode = true;
  public rpc: IRPCMap | null = null;
  public infuraId = "";
  public http: HttpConnection | null = null;
  public wc: IConnector;
  public isConnecting = false;
  public connected = false;
  public connectCallbacks: any[] = [];
  public accounts: string[] = [];
  public chainId = 1;
  public networkId = 1;
  public rpcUrl = "";

  constructor(opts: IWalletConnectProviderOptions) {
    super({ pollingInterval: opts.pollingInterval || 4000 });
    this.bridge = opts.connector
      ? opts.connector.bridge
      : opts.bridge || "https://bridge.walletconnect.org";
    this.qrcode = typeof opts.qrcode === "undefined" || opts.qrcode !== false;
    this.wc =
      opts.connector ||
      new WalletConnect({
        bridge: this.bridge,
        qrcodeModal: this.qrcode ? QRCodeModal : undefined,
      });
    this.rpc = opts.rpc || null;
    if (
      !this.rpc &&
      (!opts.infuraId || typeof opts.infuraId !== "string" || !opts.infuraId.trim())
    ) {
      throw new Error("Missing one of the required parameters: rpc or infuraId");
    }
    this.infuraId = opts.infuraId || "";
    this.chainId = typeof opts.chainId !== "undefined" ? opts.chainId : 1;
    this.networkId = this.chainId;
    this.updateRpcUrl(this.chainId);
    this.addProvider(
      new FixtureSubprovider({
        eth_hashrate: "0x00",
        eth_mining: false,
        eth_syncing: true,
        net_listening: true,
        web3_clientVersion: `WalletConnect/v1.x.x/javascript`,
      }),
    );
    this.addProvider(new CacheSubprovider());
    this.addProvider(new SubscriptionsSubprovider());
    this.addProvider(new FilterSubprovider());
    this.addProvider(new NonceSubprovider());
    this.addProvider(
      new HookedWalletSubprovider({
        getAccounts: async (cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const accounts = wc.accounts;
            if (accounts && accounts.length) {
              cb(null, accounts);
            } else {
              cb(new Error("Failed to get accounts"));
            }
          } catch (error) {
            cb(error);
          }
        },
        processMessage: async (msgParams: { from: string; data: string }, cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const result = await wc.signMessage([msgParams.from, msgParams.data]);
            cb(null, result);
          } catch (error) {
            cb(error);
          }
        },
        processPersonalMessage: async (msgParams: { from: string; data: string }, cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const result = await wc.signPersonalMessage([msgParams.data, msgParams.from]);
            cb(null, result);
          } catch (error) {
            cb(error);
          }
        },
        processSignTransaction: async (txParams: any, cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const result = await wc.signTransaction(txParams);
            cb(null, result);
          } catch (error) {
            cb(error);
          }
        },
        processTransaction: async (txParams: any, cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const result = await wc.sendTransaction(txParams);
            cb(null, result);
          } catch (error) {
            cb(error);
          }
        },
        processTypedMessage: async (msgParams: { from: string; data: string }, cb: any) => {
          try {
            const wc = await this.getWalletConnector();
            const result = await wc.signTypedData([msgParams.from, msgParams.data]);
            cb(null, result);
          } catch (error) {
            cb(error);
          }
        },
      }),
    );
    this.addProvider({
      handleRequest: async (payload: IJsonRpcRequest, next: any, end: any) => {
        try {
          const { result } = await this.handleRequest(payload);
          end(null, result);
        } catch (error) {
          end(error);
        }
      },
      setEngine: (_: any) => _,
    });
  }

  get isWalletConnect() {
    return true;
  }

  enable() {
    return new Promise(async (resolve, reject) => {
      try {
        const wc = await this.getWalletConnector();
        if (wc) {
          this.start();
          this.subscribeWalletConnector();
          resolve(wc.accounts);
        } else {
          return reject(new Error("Failed to connect to WalleConnect"));
        }
      } catch (error) {
        return reject(error);
      }
    });
  }

  async request(payload: any): Promise<any> {
    return this.send(payload);
  }

  async send(payload: any, callback?: any): Promise<any> {
    // Web3 1.0 beta.38 (and above) calls `send` with method and parameters
    if (typeof payload === "string") {
      return new Promise((resolve, reject) => {
        this.sendAsync(
          {
            id: 42,
            jsonrpc: "2.0",
            method: payload,
            params: callback || [],
          },
          (error: any, response: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(response.result);
            }
          },
        );
      });
    }
    // Web3 1.0 beta.37 (and below) uses `send` with a callback for async queries
    if (callback) {
      this.sendAsync(payload, callback);
      return;
    }
    const res = await this.handleRequest(payload);
    return res;
  }

  onConnect(callback: any) {
    this.connectCallbacks.push(callback);
  }

  triggerConnect(result: any) {
    if (this.connectCallbacks && this.connectCallbacks.length) {
      this.connectCallbacks.forEach(callback => callback(result));
    }
  }

  async disconnect() {
    this.close();
  }

  async close() {
    const wc = await this.getWalletConnector({ disableSessionCreation: true });
    await wc.killSession();
    // tslint:disable-next-line:await-promise
    await this.stop();
    this.emit("close", 1000, "Connection closed");
    this.emit("disconnect", 1000, "Connection disconnected");
  }

  async handleRequest(payload: any) {
    try {
      let response;
      let result: any = null;
      const wc = await this.getWalletConnector();
      switch (payload.method) {
        case "wc_killSession":
          await this.close();
          result = null;
          break;
        case "eth_accounts":
          result = wc.accounts;
          break;
        case "eth_coinbase":
          result = wc.accounts[0];
          break;
        case "eth_chainId":
          result = wc.chainId;
          break;
        case "net_version":
          result = wc.networkId || wc.chainId;
          break;
        case "eth_uninstallFilter":
          this.sendAsync(payload, (_: any) => _);
          result = true;
          break;
        case "eth_sendRawTransaction":
        case "eth_sendTransaction":
        case "eth_sign":
        case "personal_sign":
        case "personal_sendTransaction":
          response = await this.handleWriteRequests(payload);
          break;
        default:
          response = await this.handleOtherRequests(payload);
      }
      if (response) {
        return response;
      }
      return this.formatResponse(payload, result);
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  formatResponse(payload: any, result: any) {
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result,
    };
  }

  async handleOtherRequests(payload: any): Promise<IJsonRpcResponseSuccess> {
    if (payload.method.startsWith("eth_")) {
      return this.handleReadRequests(payload);
    }
    const wc = await this.getWalletConnector();
    const result = await wc.sendCustomRequest(payload);
    return this.formatResponse(payload, result);
  }

  async handleReadRequests(payload: any): Promise<IJsonRpcResponseSuccess> {
    if (!this.http) {
      const error = new Error("HTTP Connection not available");
      this.emit("error", error);
      throw error;
    }
    return this.http.send(payload) as Promise<IJsonRpcResponseSuccess>;
  }
  
  async handleWriteRequests(payload: any): Promise<IJsonRpcResponseSuccess> {
    return new Promise(resolve => {
      this.sendAsync(payload,
          (error: any, response: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(response);
            }
          },
        );
    });
  }

  // disableSessionCreation - if true, getWalletConnector won't try to create a new session
  // in case the connector is disconnected
  getWalletConnector(opts: { disableSessionCreation?: boolean } = {}): Promise<IConnector> {
    const { disableSessionCreation = false } = opts;
    return new Promise((resolve, reject) => {
      const wc = this.wc;
      if (this.isConnecting) {
        this.onConnect((x: any) => resolve(x));
      } else if (!wc.connected && !disableSessionCreation) {
        this.isConnecting = true;
        const sessionRequestOpions = this.chainId ? { chainId: this.chainId } : undefined;
        wc.createSession(sessionRequestOpions)
          .then(() => {
            wc.on("connect", (error, payload) => {
              if (error) {
                this.isConnecting = false;
                return reject(error);
              }
              this.isConnecting = false;
              this.connected = true;
              if (payload) {
                // Handle session update
                this.updateState(payload.params[0]);
              }
              // Emit connect event
              this.emit("connect");
              this.triggerConnect(wc);
              resolve(wc);
            });
          })
          .catch(error => {
            this.isConnecting = false;
            reject(error);
          });
      } else {
        if (!this.connected) {
          this.connected = true;
          this.updateState(wc.session);
        }
        resolve(wc);
      }
    });
  }

  async subscribeWalletConnector() {
    const wc = await this.getWalletConnector();
    wc.on("disconnect", error => {
      if (error) {
        this.emit("error", error);
        return;
      }
      this.stop();
    });
    wc.on("session_update", (error, payload) => {
      if (error) {
        this.emit("error", error);
        return;
      }
      // Handle session update
      this.updateState(payload.params[0]);
    });
  }

  async updateState(sessionParams: any) {
    const { accounts, chainId, networkId, rpcUrl } = sessionParams;
    // Check if accounts changed and trigger event
    if (!this.accounts || (accounts && this.accounts !== accounts)) {
      this.accounts = accounts;
      this.emit("accountsChanged", accounts);
    }
    // Check if chainId changed and trigger event
    if (!this.chainId || (chainId && this.chainId !== chainId)) {
      this.chainId = chainId;
      this.emit("chainChanged", chainId);
    }
    // Check if networkId changed and trigger event
    if (!this.networkId || (networkId && this.networkId !== networkId)) {
      this.networkId = networkId;
      this.emit("networkChanged", networkId);
    }
    // Handle rpcUrl update
    this.updateRpcUrl(this.chainId, rpcUrl || "");
  }

  updateRpcUrl(chainId: number, rpcUrl = "") {
    const infuraNetworks = {
      1: "mainnet",
      3: "ropsten",
      4: "rinkeby",
      5: "goerli",
      42: "kovan",
    };
    const network = infuraNetworks[chainId];
    if (!rpcUrl) {
      if (this.rpc && this.rpc[chainId]) {
        rpcUrl = this.rpc[chainId];
      } else if (network) {
        rpcUrl = `https://${network}.infura.io/v3/${this.infuraId}`;
      }
    }
    if (rpcUrl) {
      // Update rpcUrl
      this.rpcUrl = rpcUrl;
      // Handle http update
      this.updateHttpConnection();
    } else {
      this.emit("error", new Error(`No RPC Url available for chainId: ${chainId}`));
    }
  }

  updateHttpConnection() {
    if (this.rpcUrl) {
      this.http = new HttpConnection(this.rpcUrl);
      this.http.on("payload", payload => this.emit("payload", payload));
      this.http.on("error", error => this.emit("error", error));
    }
  }
}

export default WalletConnectProvider;
