/* global describe it beforeEach Buffer */

import { expect } from 'chai'

import RNWalletConnect from '../src'

function testEncoding(testString, encoding) {
  const buffer = Buffer.from(testString, encoding)
  const result = buffer.toString(encoding)
  return result === testString
}

const testURI =
  'ethereum:wc-8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?name=DappExample&bridge=https://bridge.example.com&symKey=KzpSTk1pezg5eTJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U='

describe('// ------------- rn-walletconnect-wallet ------------- //', () => {
  let walletConnector = null

  beforeEach(async() => {
    walletConnector = new RNWalletConnect(testURI)
  })

  it('creates an instance using URI string', () => {
    expect(walletConnector).to.exist
  })

  describe('symKey', () => {
    let symKey = null

    beforeEach(() => {
      symKey = walletConnector.symKey
    })

    it('exists', () => {
      expect(symKey).to.exist
    })

    it('is hex', () => {
      const result = testEncoding(symKey, 'hex')
      expect(result).to.exist
    })
  })
})
