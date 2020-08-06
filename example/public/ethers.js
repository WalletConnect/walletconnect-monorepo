"use strict";

// updates title to display package version
updateTitle();

const WalletConnectProvider = window.WalletConnectProvider.default;
const ethers = window.ethers;

let provider = null;

const DAI = {
  address: "0x6b175474e89094c44da98b954eedeac495271d0f",
  abi: ["function transfer(address _to, uint256 _value) returns (bool success)"],
};

async function onInit() {
  // Create a provider
  provider = new WalletConnectProvider({
    rpc: {
      1: "https://api.mycryptoapi.com/eth",
    },
  });

  onSubscribe();

  const accounts = await provider.enable();

  onConnect(
    { accounts, chainId: provider.chainId },
    { label: "Transfer DAI", callback: transferDai },
  );
}

function onSubscribe() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }

  provider.on("accountsChanged", accounts => {
    updateView({ accounts });
  });

  provider.on("chainChanged", chainId => {
    updateView({ chainId });
  });

  provider.on("close", () => {
    provider = null;
    onDisconnect();
  });
}

async function transferDai() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }
  const contract = new ethers.Contract(
    DAI.address,
    DAI.abi,
    new ethers.providers.Web3Provider(provider).getSigner(),
  );
  const res = await contract.transfer(provider.accounts[0], ethers.utils.parseEther("1"));
  console.log("res", res);
}
