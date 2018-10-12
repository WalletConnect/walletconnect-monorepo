/* global describe it beforeEach Buffer */

import { expect } from 'chai'

import { Connector, Listener } from '../src'

const hexRegex = /[0-9a-f]+/gi
const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const testURI =
  'ethereum:wc-8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?name=DappExample&bridge=https://test-bridge.example.com&symKey=KzpSTk1pezg5eTJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U='

describe('// ------------- js-walletconnect-core ------------- //', () => {
  describe('Connector class', () => {
    let config = {
      bridgeUrl: 'https://test-bridge.walletconnect.org',
      dappName: 'ExampleDapp',
      sessionId: '8a5e5bdc-a0e4-4702-ba63-8f1a5655744f',
      symKey: null
    }

    let connector = null

    beforeEach(async() => {
      connector = new Connector(config)
      connector.symKey = await connector.generateKey()
    })

    it('creates an instance of Connector', () => {
      expect(connector).to.be.instanceOf(Connector)
    })

    describe('protocol', () => {
      let protocol = null

      beforeEach(() => {
        protocol = connector.protocol
      })

      it('exists', () => {
        expect(protocol).to.exist
      })

      it('defaults to ethereum', () => {
        expect(protocol).to.equal('ethereum')
      })
    })

    describe('chainId', () => {
      let chainId = null

      beforeEach(() => {
        chainId = connector.chainId
      })

      it('exists', () => {
        expect(chainId).to.exist
      })

      it('defaults to 1', () => {
        expect(chainId).to.equal(1)
      })
    })

    describe('symKey', () => {
      let symKey = null

      beforeEach(() => {
        symKey = connector.symKey
      })

      it('exists', () => {
        expect(symKey).to.exist
      })

      it('is a string', () => {
        expect(symKey).to.be.a('string')
      })

      it('is hex', () => {
        expect(hexRegex.test(symKey)).to.be.true
      })
    })

    describe('sessionId', () => {
      let sessionId = null

      beforeEach(() => {
        sessionId = connector.sessionId
      })

      it('exists', () => {
        expect(sessionId).to.exist
      })

      it('is UUID', () => {
        const regexTest = uuidRegex.test(sessionId)
        expect(regexTest).to.be.true
      })
    })

    describe('_formatWalletConnectURI', () => {
      let formattedURI = null

      beforeEach(() => {
        formattedURI = connector._formatWalletConnectURI()
      })

      it('result is a string', () => {
        expect(formattedURI).to.be.a('string')
      })

      it('result starts with protocol', () => {
        const protocol = connector.protocol
        expect(formattedURI.startsWith(protocol)).to.be.true
      })
    })

    describe('_parseWalletConnectURI', () => {
      let parsedURI = null

      beforeEach(() => {
        parsedURI = connector._parseWalletConnectURI(testURI)
      })

      it('result is an object', () => {
        expect(parsedURI).to.be.a('object')
      })

      it('result symKey exists', () => {
        const symKey = parsedURI.symKey
        expect(symKey).to.exist
      })

      it('result symKey is Buffer', () => {
        const symKey = parsedURI.symKey
        expect(Buffer.isBuffer(symKey)).to.be.true
      })
    })
    describe('generateKey', () => {
      let key = null

      beforeEach(async() => {
        key = await connector.generateKey()
      })

      it('returns a Buffer object', () => {
        expect(Buffer.isBuffer(key)).to.be.true
      })

      it('defaults to 256 bit key', () => {
        const string = key.toString('hex')
        const hexLength = 64
        expect(string.length).to.equal(hexLength)
      })
    })
  })

  describe('Listener class', () => {
    it('Creates an instance of Listener', () => {
      const listener = new Listener({ cb: () => {}, fn: () => {} })
      expect(listener).to.be.instanceOf(Listener)
    })
  })
})
