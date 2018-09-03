var web3 = window['web3']
var Provider = window['web3-provider']

function getLoginTypedData(address) {
  return [
    {
      type: 'string',
      name: 'App',
      value: 'dapp:wallet'
    },
    {
      type: 'string',
      name: 'Reason',
      value: 'login'
    },
    {
      type: 'address',
      name: 'Address',
      value: address
    }
  ]
}

var web3 = new Web3(
  new Provider({
    host: 'https://kovan.infura.io'
  })
)

function signTx() {
  web3.eth
    .getAccounts()
    .then(data => {
      var account = data
      var params = [account, getLoginTypedData(account)]
      var method = 'eth_signTypedData'
      return new Promise((resolve, reject) => {
        web3.currentProvider.sendAsync(
          {
            method: method,
            params: params,
            address: account
          },
          (err, result) => {
            var e = err || (result && result.error)
            if (e) {
              reject(e)
            } else {
              resolve(result)
            }
          }
        )
      })
    })
    .then(result => {
      console.log(result)
    })
    .catch(e => {
      console.log('Wallet connect error', e)
    })
}

function sendTx() {
  web3.eth
    .getAccounts()
    .then(data => {
      var account = data
      return new Promise((resolve, reject) => {
        web3.eth.sendTransaction(
          {
            from: data[0],
            to: '0x31ea8795EE32D782C8ff41a5C68Dcbf0F5B27f6d',
            gasPrice: 1,
            nonce: 100,
            gas: 50000,
            value: 0
          },
          (err, result) => {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          }
        )
      })
    })
    .then(result => {
      console.log(result)
    })
    .catch(e => {
      console.log('Wallet connect error', e)
    })
}

sendTx()
