/* global describe it  */
// /* global describe it beforeEach setTimeout Promise */

// import { expect } from 'chai'

// import { Connector } from 'js-walletconnect-core'
// import RNWalletConnect from '../src'
// import { mockCreateSession } from './mock/createSession.js'

// const hexRegex = /[0-9a-f]+/gi

describe('// ------------- rn-walletconnect-wallet ------------- //', () => {
  it('needs tests', () => {})
  // let walletConnector = null
  // let connector = null
  //
  // let config = {
  //   bridgeUrl: 'https://test-bridge.walletconnect.org',
  //   dappName: 'Example'
  // }
  //
  // beforeEach(async() => {
  //   connector = new Connector(config)
  //
  //   const uri = await mockCreateSession(connector)
  //
  //   walletConnector = new RNWalletConnect({
  //     uri,
  //     push: {
  //       type: 'fcm',
  //       token:
  //         'cSgGd8BWURk:APA91bGXsLd_ga4wnUqtO5O8CQqe6RRdyb4LuJ1h-TAwVRFha1PDe6LPAr5irb0ZRYtEkGvrJ38LsvG9INiqlx4KBx9ATCHkc2dWwsncN4YkkZnSPwsaJNABVYdFbutyfc8pScl0Qe8-',
  //       webhook:
  //         'https://us-central1-walletconnect-app.cloudfunctions.net/push'
  //     }
  //   })
  // })

  // it('creates an instance', () => {
  //   expect(walletConnector).to.exist
  // })

  // describe('approveSession', () => {
  //   it('successfully approves session', async() => {
  //     const data = {
  //       accounts: ['0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7']
  //     }
  //
  //     const result = await walletConnector.approveSession(data)
  //
  //     expect(result).to.be.ok
  //   })
  // })
  //
  // describe('rejectSession', () => {
  //   it('successfully rejects session', async() => {
  //     const result = await walletConnector.rejectSession()
  //
  //     expect(result).to.be.ok
  //   })
  // })
  //
  // describe('killSession', () => {
  //   it('successfully approves and later kills session', async() => {
  //     const data = {
  //       accounts: ['0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7']
  //     }
  //     await walletConnector.approveSession(data)
  //
  //     const promise = () =>
  //       new Promise((resolve, reject) => {
  //         setTimeout(() => {
  //           walletConnector
  //             .killSession()
  //             .then(result => resolve(result))
  //             .catch(err => reject(err))
  //         }, 1000)
  //       })
  //
  //     const result = await promise()
  //
  //     expect(result).to.be.ok
  //   })
  // })

  // describe('symKey', () => {
  //   let symKey = null
  //
  //   beforeEach(() => {
  //     symKey = walletConnector.symKey
  //   })
  //
  //   it('exists', () => {
  //     expect(symKey).to.exist
  //   })
  //
  //   it('is a string', () => {
  //     expect(symKey).to.be.a('string')
  //   })
  //
  //   it('is hex', () => {
  //     expect(hexRegex.test(symKey)).to.be.true
  //   })
  // })
})
