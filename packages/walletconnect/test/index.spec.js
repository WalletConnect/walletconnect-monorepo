/* global describe it beforeEach setTimeout */

import { expect } from 'chai'

import WalletConnect from '../src'

// async function mockSendSessionStatus(c) {
//   const rawData = {
//     accounts: ['0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7']
//   }
//
//   const encryptedData = await c.encrypt(rawData)
//
//   const sessionStatus = {
//     fcmToken:
//       'cSgGd8BWURk:APA91bGXsLd_ga4wnUqtO5O8CQqe6RRdyb4LuJ1h-TAwVRFha1PDe6LPAr5irb0ZRYtEkGvrJ38LsvG9INiqlx4KBx9ATCHkc2dWwsncN4YkkZnSPwsaJNABVYdFbutyfc8pScl0Qe8-',
//     pushEndpoint:
//       'https://us-central1-walletconnect-app.cloudfunctions.net/push',
//     data: encryptedData
//   }
//
//   c._fetchBridge(`/session/${c.sessionId}`, { method: 'PUT' }, sessionStatus)
// }

setTimeout

describe('// ------------------ walletconnect ------------------ //', () => {
  let config = {
    bridgeUrl: 'https://bridge.walletconnect.org',
    dappName: 'ExampleDapp'
  }

  let webConnector = null

  let session = null

  beforeEach(async() => {
    webConnector = new WalletConnect(config)
    session = await webConnector.createSession()
  })

  it('createSession success', () => {
    expect(session).to.be.ok
  })

  it('listenSessionStatus is a promise', () => {
    const test = webConnector.listenSessionStatus()
    console.log('test', JSON.stringify(test, null, 2)) // eslint-disable-line
    expect(test).to.be.a('promise')
  })

  // it('listenSessionStatus success', async() => {
  //   setTimeout(() => mockSendSessionStatus(webConnector), 5000)
  //   const sessionStatus = await webConnector.listenSessionStatus()
  //   expect(sessionStatus).to.be.ok
  // })
})
