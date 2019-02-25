# WalletConnect Web3 Subprovider

Web3 Subprovider for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

## Example

```javascript
import Web3 from "web3";
import ProviderEngine from "web3-provider-engine";
import RpcSubprovider from "web3-provider-engine/subproviders/rpc";
import WalletConnectSubprovider from "@walletconnect/web3-subprovider";

const engine = new ProviderEngine();

engine.addProvider(
  new WalletConnectSubprovider({
    bridge: "https://bridge.walletconnect.org" // Required
  })
);
engine.addProvider(
  new RpcSubprovider({
    rpcUrl: "http://localhost:8545" // Required
  })
);
engine.start();

const web3 = new Web3(engine);
```
