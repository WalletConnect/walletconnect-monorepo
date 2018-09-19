/* global describe it beforeEach Buffer */

import { expect } from 'chai'

import { Connector } from 'js-walletconnect-core'
import RNWalletConnect from '../src'

function testEncoding(testString, encoding) {
  const buffer = Buffer.from(testString, encoding)
  const result = buffer.toString(encoding)
  return result === testString
}

async function mockCreateSession(connector) {
  connector.symKey = await connector.generateKey()
  const { sessionId } = await connector._fetchBridge('/session/new', {
    method: 'POST'
  })
  connector.sessionId = sessionId
  const uri = connector._formatWalletConnectURI()
  return uri
}

// const testURI =
//   'ethereum:wc-8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?name=DappExample&bridge=https://bridge.example.com&symKey=KzpSTk1pezg5eTJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U='

describe('// ------------- rn-walletconnect-wallet ------------- //', () => {
  let walletConnector = null
  let connector = null

  let config = {
    bridgeUrl: 'https://bridge.walletconnect.org',
    dappName: 'Example'
  }

  beforeEach(async() => {
    connector = new Connector(config)

    const uri = await mockCreateSession(connector)

    walletConnector = new RNWalletConnect(uri)
  })

  it('creates an instance using URI string', () => {
    expect(walletConnector).to.exist
  })

  describe('sendSessionStatus', () => {
    const sessionStatus = {
      fcmToken:
        'cSgGd8BWURk:APA91bGXsLd_ga4wnUqtO5O8CQqe6RRdyb4LuJ1h-TAwVRFha1PDe6LPAr5irb0ZRYtEkGvrJ38LsvG9INiqlx4KBx9ATCHkc2dWwsncN4YkkZnSPwsaJNABVYdFbutyfc8pScl0Qe8-',
      pushEndpoint:
        'https://us-central1-walletconnect-app.cloudfunctions.net/push',
      data: {
        accounts: ['0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7']
      }
    }

    it('successfully posts session status to bridge', async() => {
      const result = await walletConnector.sendSessionStatus(sessionStatus)

      expect(result).to.be.true
    })
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
