import { Connector } from 'js-walletconnect-core'

export default class WalletConnector extends Connector {
  constructor(string) {
    super()
    const uri = this._parseURI(string)
    this.bridgeUrl = uri.bridgeUrl
    this.sessionId = uri.sessionId
    this.symKey = uri.symKey
    this.dappName = uri.dappName
  }
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
    const response = await this._fetchBridge(
      `/session/${this.sessionId}`,
      { method: 'PUT' },
      { fcmToken, pushEndpoint, data: encryptedData }
    )

    const expires = Number(response.expiresInSeconds) * 1000

    this.expires = expires

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
    await this._fetchBridge(
      `/transaction-status/${transactionId}/new`,
      { method: 'POST' },
      { data: encryptedData }
    )

    return true
  }

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

  //
  // get all transaction requests data
  //
  async getAllTransactionRequests() {
    return this._getMultipleEncryptedData(
      `/session/${this.sessionId}/transactions`
    )
  }

  validateEthereumAddress(address) {
    return /^(0x)?[0-9a-f]{40}$/i.test(address)
  }
}
