# WalletConnect Truffle Provider

Deploy your contracts using WalletConnect

## Install

```bash
yarn add @walletconnect/truffle-provider

# OR

npm install --save @walletconnect/truffle-provider
```

## Example usage

```javascript
const WalletConnectProvider = require('@walletconnect/truffle-provider').default

let provider = new WalletConnectProvider(
  `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`
)

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // Match any network id
    },
    ropsten: {
      provider: () => provider,
      network_id: '3',
      networkCheckTimeout: 10000
    }
  }
}
```

On command line:
```bash
truffle migrate --network ropsten
```