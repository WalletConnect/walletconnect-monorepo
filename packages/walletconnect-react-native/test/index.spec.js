/* global describe it */

import { expect } from 'chai'

import RNWalletConnect from '../src'

const testURI =
  'ethereum:wc-8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?name=DappExample&bridge=https://bridge.example.com&symKey=KzpSTk1pezg5eTJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U='

let walletConnector = null

describe('// ------------- rn-walletconnect-wallet ------------- //', () => {
  it('needs tests', () => {})

  it('creates an instance using URI string', () => {
    walletConnector = new RNWalletConnect(testURI)
    expect(walletConnector).to.exist
  })
})
