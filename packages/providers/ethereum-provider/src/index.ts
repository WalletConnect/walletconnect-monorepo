import { BlockchainProvider } from "@json-rpc-tools/blockchain";
import { BlockchainProviderConfig } from "@json-rpc-tools/types";
import { IWCEthRpcConnectionOptions } from "@walletconnect/types";
import { signingMethods } from "@walletconnect/utils";
import { SignerConnection } from "@walletconnect/signer-connection";

function getInfuraRpcUrl(chainId: number, infuraId: string) {
  const networks = {
    1: "mainnet",
    3: "ropsten",
    4: "rinkeby",
    5: "goerli",
    42: "kovan",
  };
  return `https://${networks[chainId]}.infura.io/v3/${infuraId}`;
}

function generateEthereumProviderConfig(
  opts?: IWCEthRpcConnectionOptions,
): [string, BlockchainProviderConfig] {
  const chainId = opts?.chainId || 1;
  const rpcUrl =
    typeof opts?.infuraId !== "undefined"
      ? getInfuraRpcUrl(chainId, opts.infuraId)
      : typeof opts?.rpc !== "undefined"
      ? opts.rpc[chainId]
      : undefined;
  if (typeof rpcUrl === "undefined") {
    throw new Error(`Missing rpc url for chainId: ${chainId}`);
  }
  const config: BlockchainProviderConfig = {
    chainId: "eip155:" + chainId,
    routes: ["*"],
    signer: {
      routes: signingMethods,
      connection: new SignerConnection(opts),
    },
  };
  return [rpcUrl, config];
}

class WalletConnectEthereumProvider extends BlockchainProvider {
  constructor(opts?: IWCEthRpcConnectionOptions) {
    super(...generateEthereumProviderConfig(opts));
  }

  get isWalletConnect() {
    return true;
  }

  public async enable() {
    await this.connect();
  }
}

export default WalletConnectEthereumProvider;
