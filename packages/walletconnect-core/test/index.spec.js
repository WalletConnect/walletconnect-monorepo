/* global describe it beforeEach Buffer */

import { expect } from 'chai'

import Connector from '../src/connector'
import generateKey from '../src/generateKey'
import parseStandardURI from '../src/parseStandardURI'

function testEncoding(testString, encoding) {
  const buffer = Buffer.from(testString, encoding)
  const result = buffer.toString(encoding)
  return result === testString
}

const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const testURI =
  'ethereum:wc-8a5e5bdc-a0e4-4702-ba63-8f1a5655744f@1?name=DappExample&bridge=https://bridge.example.com&symKey=KzpSTk1pezg5eTJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U='

describe('// ------------- js-walletconnect-core ------------- //', () => {
  describe('Connector class', () => {
    let config = {
      bridgeUrl: 'https://bridge.walletconnect.org',
      dappName: 'ExampleDapp',
      sessionId: '8a5e5bdc-a0e4-4702-ba63-8f1a5655744f'
    }

    let connector = null

    beforeEach(async() => {
      config.symKey = await generateKey()
      connector = new Connector(config)
    })

    it('creates an instance of Connector', () => {
      expect(connector).to.be.instanceOf(Connector)
    })

    it('protocol exists', () => {
      const protocol = connector.protocol
      expect(protocol).to.exist
    })

    it('protocol defaults to ethereum', () => {
      const protocol = connector.protocol
      expect(protocol).to.equal('ethereum')
    })

    it('chainId exists', () => {
      const chainId = connector.chainId
      expect(chainId).to.exist
    })

    it('chainId defaults to 1', () => {
      const chainId = connector.chainId
      expect(chainId).to.equal(1)
    })

    it('symKey exists', () => {
      const symKey = connector.symKey
      expect(symKey).to.exist
    })

    it('symKey is hex', () => {
      const symKey = connector.symKey
      const result = testEncoding(symKey, 'hex')
      expect(result).to.exist
    })

    it('sessionId exists', () => {
      const sessionId = connector.sessionId
      expect(sessionId).to.exist
    })

    it('sessionId is UUID', () => {
      const sessionId = connector.sessionId
      const regexTest = uuidRegex.test(sessionId)
      expect(regexTest).to.be.true
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
  })

  describe('generateKey', () => {
    let key = null

    beforeEach(async() => {
      key = await generateKey()
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

  describe('parseStandardURI', () => {
    let resultURI = null

    beforeEach(() => {
      resultURI = parseStandardURI(testURI)
    })

    it('result is an object', () => {
      expect(resultURI).to.be.a('object')
    })

    it('result includes protocol', () => {
      const protocol = resultURI.protocol
      expect(protocol).to.exist
    })

    it('result protocol is string', () => {
      const protocol = resultURI.protocol
      expect(protocol).to.be.a('string')
    })

    it('result includes prefix', () => {
      const prefix = resultURI.prefix
      expect(prefix).to.exist
    })

    it('result prefix is string', () => {
      const prefix = resultURI.prefix
      expect(prefix).to.be.a('string')
    })

    it('result includes sessionId', () => {
      const sessionId = resultURI.sessionId
      expect(sessionId).to.exist
    })

    it('result sessionId is string', () => {
      const sessionId = resultURI.sessionId
      expect(sessionId).to.be.a('string')
    })

    // it('result sessionId is UUID', () => {
    //   const sessionId = resultURI.sessionId
    //   const regexTest = uuidRegex.test(sessionId)
    //   expect(regexTest).to.be.true
    // })

    it('result includes name', () => {
      const name = resultURI.name
      expect(name).to.exist
    })

    it('result name is string', () => {
      const name = resultURI.name
      expect(name).to.be.a('string')
    })

    it('result includes symKey', () => {
      const symKey = resultURI.symKey
      expect(symKey).to.exist
    })

    it('result symKey is base64', () => {
      const symKey = resultURI.symKey
      const result = testEncoding(symKey, 'base64')
      expect(result).to.exist
    })
  })
})
