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

    // encrypt data
    const encryptedData = await this.encrypt(data)

    // store session info on bridge
    const result = await this._fetchBridge(
      `/session/${this.sessionId}`,
      { method: 'PUT' },
      { fcmToken, pushEndpoint, data: encryptedData }
    )

    this.expires = result.expires
    this.connected = true

    return this.toJSON()
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
}
