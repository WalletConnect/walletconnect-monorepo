import { BlockchainProvider } from "@json-rpc-tools/blockchain";
import { BlockchainProviderConfig } from "@json-rpc-tools/types";
import { SignerConnection } from "@walletconnect/signer-connection";
import { IRPCMap, IWCEthRpcConnectionOptions } from "@walletconnect/types";
import { signingMethods, stateMethods } from "@walletconnect/utils";
import { IEthereumProvider, ProviderAccounts, RequestArguments } from "eip1193-provider";

class WalletConnectEthereumProvider implements IEthereumProvider {
  private infuraId: string | undefined;
  private rpc: IRPCMap | undefined;
  private provider: BlockchainProvider;
  constructor(opts?: IWCEthRpcConnectionOptions) {
    this.infuraId = opts?.infuraId;
    this.rpc = opts?.rpc;
    this.provider = this.setBlockchainProvider(opts);
  }

  public request(args: RequestArguments): Promise<unknown> {
    return this.provider.request(args);
  }

  public async enable(): Promise<ProviderAccounts> {
    await this.provider.connect();
    return this.provider.request({ method: "eth_accounts" });
  }

  public on(event: any, listener: any) {
    this.provider.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.provider.once(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.provider.removeListener(event, listener);
  }

  public off(event: string, listener: any): void {
    this.provider.off(event, listener);
  }

  get isWalletConnect() {
    return true;
  }

  // ---------- Private ----------------------------------------------- //

  private getRpcUrl(chainId: number): string {
    let rpcUrl: string | undefined;
    const infuraNetworks = {
      1: "mainnet",
      3: "ropsten",
      4: "rinkeby",
      42: "kovan",
      5: "goerli",
    };
    const network = infuraNetworks[chainId];
    if (this.rpc && this.rpc[chainId]) {
      rpcUrl = this.rpc[chainId];
    } else if (network) {
      rpcUrl = `https://${network}.infura.io/v3/${this.infuraId}`;
    }
    if (typeof rpcUrl === "undefined") {
      throw new Error(`Missing rpc url for chainId: ${chainId}`);
    }
    return rpcUrl;
  }

  private setBlockchainProvider(opts?: IWCEthRpcConnectionOptions): BlockchainProvider {
    const chainId = opts?.chainId || 1;
    const rpcUrl = this.getRpcUrl(chainId);
    const config: BlockchainProviderConfig = {
      chainId: "eip155:" + chainId,
      routes: ["*"],
      signer: {
        connection: new SignerConnection(opts),
        routes: [...stateMethods, ...signingMethods],
      },
    };
    const provider = new BlockchainProvider(rpcUrl, config);
    return provider;
  }
}

export default WalletConnectEthereumProvider;
