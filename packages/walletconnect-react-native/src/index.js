import { Connector } from 'js-walletconnect-core'

export default class WalletConnector extends Connector {
  constructor(options) {
    if (options && typeof options === 'object') {
      super(options)
    } else if (options && typeof options === 'string') {
      super()
      const session = this._parseWalletConnectURI(options)
      this.protocol = session.protocol
      this.bridgeUrl = session.bridgeUrl
      this.sessionId = session.sessionId
      this.symKey = session.symKey
      this.dappName = session.dappName
    } else {
      throw new Error('Missing session details')
    }
  }
  //
  // send session status
  //
  async sendSessionStatus(sessionData = {}) {
    const { fcmToken, pushEndpoint, data = {} } = sessionData
    if (!fcmToken || !pushEndpoint) {
      throw new Error('fcmToken and pushEndpoint are required')
    }

    // encrypt data
    const encryptedData = await this.encrypt(data)

    // store session info on bridge
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
  // Send call status
  //
  async sendCallStatus(callId, statusData = {}) {
    if (!callId) {
      throw new Error('`callId` is required')
    }

    // encrypt data
    const encryptedData = await this.encrypt(statusData)

    // store call info on bridge
    await this._fetchBridge(
      `/call-status/${callId}/new`,
      { method: 'POST' },
      { data: encryptedData }
    )

    return true
  }

  //
  // get call request data
  //
  async getCallRequest(callId) {
    if (!callId) {
      throw new Error('callId is required')
    }

    return this._getEncryptedData(`/session/${this.sessionId}/call/${callId}`)
  }

  //
  // get all call requests data
  //
  async getAllCallRequests() {
    return this._getMultipleEncryptedData(`/session/${this.sessionId}/calls`)
  }
  
  toJSON() {
    return {
      symKey: this.symKey,
      sessionId: this.sessionId,
      dappName: this.dappName,
      bridgeUrl: this.bridgeUrl,
      protocol: this.protocol,
    }
  }
}
