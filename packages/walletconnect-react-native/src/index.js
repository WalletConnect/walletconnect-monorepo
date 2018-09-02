/* global fetch */

import { Connector } from 'js-walletconnect-core'

export default class WalletConnector extends Connector {
  //
  // send session status
  //
  async sendSessionStatus(sessionData = {}) {
    const { fcmToken, pushEndpoint, data = {} } = sessionData
    if (!fcmToken || !pushEndpoint) {
      throw new Error('fcmToken and pushEndpoint are required')
    }

    let verifiedData = []
    // check if provided data is array or string
    if (Array.isArray(data)) {
      data.forEach(address => {
        if (this.validateEthereumAddress(address)) {
          verifiedData.push(address)
        } else {
          throw new Error('Invalid ethereum address')
        }
      })
    } else if (typeof data === 'string') {
      data.split().forEach(address => {
        if (this.validateEthereumAddress(address)) {
          verifiedData.push(address)
        } else {
          throw new Error('Invalid ethereum address')
        }
      })
    }

    // encrypt data
    const encryptedData = await this.encrypt(verifiedData)

    // store transaction info on bridge
    const res = await fetch(`${this.bridgeUrl}/session/${this.sessionId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fcmToken, pushEndpoint, data: encryptedData })
    })
    if (res.status >= 400) {
      throw new Error(res.statusText)
    }
    return true
  }

  //
  // send transaction status
  //
  async sendTransactionStatus(transactionId, statusData = {}) {
    if (!transactionId) {
      throw new Error('`transactionId` is required')
    }

    // encrypt data
    const encryptedData = await this.encrypt(statusData)

    // store transaction info on bridge
    const res = await fetch(
      `${this.bridgeUrl}/transaction-status/${transactionId}/new`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: encryptedData })
      }
    )
    if (res.status >= 400) {
      throw new Error(res.statusText)
    }
    return true
  }

  //
  // get session request data
  //
  // async getSessionRequest() {   return
  // this._getEncryptedData(`/session/${this.sessionId}`) }

  //
  // get transaction request data
  //
  async getTransactionRequest(transactionId) {
    if (!transactionId) {
      throw new Error('transactionId is required')
    }

    return this._getEncryptedData(
      `/session/${this.sessionId}/transaction/${transactionId}`
    )
  }

  validateEthereumAddress(address) {
    return /^(0x){1}[0-9a-fA-F]{40}$/i.test(address)
  }
}
