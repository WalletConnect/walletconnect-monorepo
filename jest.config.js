const path = require("path");

function project(name, environment = "node") {
  const root = path.dirname(require.resolve(`${name}/package.json`));

  return {
    displayName: name.replace("@walletconnect/", ""),
    roots: [`${root}/test/`],
    testEnvironment: environment,
  };
}

module.exports = {
  moduleFileExtensions: ["js", "jsx", "json", "ts", "tsx"],
  projects: [
    project("walletconnect"),
    project("@walletconnect/client"),
    // project("@walletconnect/core"),
    // project("@walletconnect/http-connection"),
    // project("@walletconnect/iso-crypto"),
    // project("@walletconnect/qrcode-modal"),
    // project("@walletconnect/rpc-connection"),
    // project("@walletconnect/signer-connection"),
    // project("@walletconnect/socket-transport"),
    // project("@walletconnect/types"),
    project("@walletconnect/utils"),
    project("@walletconnect/3id-provider"),
    project("@walletconnect/channel-provider"),
    project("@walletconnect/ethereum-provider"),
    project("@walletconnect/starkware-provider"),
    project("@walletconnect/truffle-provider"),
    project("@walletconnect/web3-provider"),
    project("@walletconnect/web3-subprovider"),
  ],
  testTimeout: 30000,
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
};
