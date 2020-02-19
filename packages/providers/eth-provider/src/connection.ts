import WCRpcConnection from "@walletconnect/rpc-connection";
import HttpConnection from "@walletconnect/http-connection";
import { convertNumberToHex, signingMethods, stateMethods } from "@walletconnect/utils";
import { ISessionParams, IWCEthRpcConnectionOptions, IRPCMap } from "@walletconnect/types";

// -- WCEthRpcConnection --------------------------------------------- //

class WCEthRpcConnection extends WCRpcConnection {
  public bridge = "https://bridge.walletconnect.org";
  public qrcode = true;
  public infuraId = "";
  public rpc: IRPCMap | null = null;
  public http: HttpConnection | null = null;
  public accounts: string[] = [];
  public networkId = 1;
  public rpcUrl = "";

  constructor (opts: IWCEthRpcConnectionOptions) {
    super(opts);
    this.rpc = opts.rpc || null;
    if (
      !this.rpc &&
      (!opts.infuraId || typeof opts.infuraId !== "string" || !opts.infuraId.trim())
    ) {
      throw new Error("Invalid or missing Infura App ID");
    }
    this.infuraId = opts.infuraId || "";
    this.networkId = this.chainId;
    setTimeout(() => this.create(), 0);
  }

  public async send (payload: any) {
    if (this.wc && this.wc.connected) {
      if (signingMethods.includes(payload.method) && payload.method.includes("wallet_")) {
        const response = await this.sendPayload(payload);
        this.emit("payload", response);
      } else if (stateMethods.includes(payload.method)) {
        const response = await this.handleStateMethods(payload);
        this.emit("payload", response);
      } else {
        if (this.http) {
          this.http.send(payload);
        } else {
          this.onError(payload, "HTTP Connection not available");
        }
      }
    } else {
      this.onError(payload, "Not connected");
    }
  }

  public async handleStateMethods (payload: any) {
    let result: any = null;
    switch (payload.method) {
    case "eth_accounts":
      result = this.accounts;
      break;
    case "eth_chainId":
      result = convertNumberToHex(this.chainId);
      break;

    case "net_version":
      result = this.networkId;
      break;
    default:
      break;
    }
    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    };
  }

  public async updateState (sessionParams: ISessionParams) {
    const { accounts, chainId, networkId, rpcUrl } = sessionParams;

    // Check if accounts changed and trigger event
    if (accounts && this.accounts !== accounts) {
      this.accounts = accounts;
      this.emit("accountsChanged", accounts);
    }

    // Check if chainId changed and trigger event
    if (chainId && this.chainId !== chainId) {
      this.chainId = chainId;
      this.emit("chainChanged", chainId);
    }

    // Check if networkId changed and trigger event
    if (networkId && this.networkId !== networkId) {
      this.networkId = networkId;
      this.emit("networkChanged", networkId);
    }

    // Handle rpcUrl update
    this.updateRpcUrl(this.chainId, rpcUrl || "");
  }

  public updateRpcUrl (chainId: number, rpcUrl = "") {
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
      if (this.rpcUrl) {
        this.http = new HttpConnection(this.rpcUrl);
        this.http.on("payload", payload => this.emit("payload", payload));
        this.http.on("error", (error: Error) => this.emit("error", error));
      }
    } else {
      this.emit("error", new Error(`No RPC Url available for chainId: ${chainId}`));
    }
  }
}

export default WCEthRpcConnection;
