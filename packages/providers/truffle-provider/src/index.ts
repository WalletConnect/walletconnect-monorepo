import WalletConnectSubprovider from "@walletconnect/web3-subprovider";

const ProviderEngine = require("web3-provider-engine");
const FiltersSubprovider = require("web3-provider-engine/subproviders/filters");
const RpcSubprovider = require("web3-provider-engine/subproviders/rpc");
const NonceSubprovider = require("web3-provider-engine/subproviders/nonce-tracker");

const DefaultOptions = {
  bridge: "https://bridge.walletconnect.org",
  shareNonce: true,
};

const singletonNonceSubProvider = new NonceSubprovider();

class WalletConnectProvider extends ProviderEngine {
  constructor(opts?: any) {
    super({ ...DefaultOptions, ...opts });
    const options = { ...DefaultOptions, ...opts };
    const { bridge, rpcUrl, shareNonce } = options;

    if (!bridge) {
      throw new Error(`Bridge Url missing, non-empty string expected, got "${bridge}"`);
    }

    if (!rpcUrl) {
      throw new Error(`RPC Url missing, non-empty string expected, got "${rpcUrl}"`);
    }

    this.addProvider(new FiltersSubprovider());
    shareNonce
      ? this.addProvider(singletonNonceSubProvider)
      : this.addProvider(new NonceSubprovider());

    this.addProvider(new WalletConnectSubprovider({ bridge }));
    this.addProvider(new RpcSubprovider({ rpcUrl }));

    this.start();
  }

  get isWalletConnect() {
    return true;
  }
}

export default WalletConnectProvider;
