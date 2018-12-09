import { Connector } from 'js-walletconnect-core'

export default class WalletConnector extends Connector {
  //
  // get session request data
  //
  async getSessionRequest(sessionId) {
    const result = await this._getEncryptedData(`/session/${sessionId}`)

    if (result) {
      return result.data
    } else {
      throw new Error('Failed to get Session Request data')
    }
  }

  //
  // approve session
  //
  async approveSession(data, pushWebhook) {
    if (!pushWebhook || typeof pushWebhook !== 'string') {
      throw new Error('Session pushWebhook is missing or invalid')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Session data is missing or invalid')
    }

    const chainId = data.chainId
    if (!chainId || typeof chainId !== 'number') {
      throw new Error('chainId parameter is missing or invalid')
    }
    this.chainId = chainId

    const accounts = data.accounts
    if (!accounts || typeof accounts !== 'number') {
      throw new Error('accounts parameter is missing or invalid')
    }
    this.accounts = accounts

    data.approved = true

    const encryptionPayload = await this.encrypt(data)

    const result = await this.sendSessionStatus({
      pushWebhoo: pushWebhook,
      encryptionPayload
    })

    this.expires = result.expires
    this.isConnected = true

    const session = this.toJSON()

    return session
  }

  //
  // reject session
  //
  async rejectSession(error) {
    const data = { approved: false, error: error }

    const encryptionPayload = await this.encrypt(data)

    await this.sendSessionStatus({
      push: null,
      encryptionPayload
    })

    this.isConnected = false

    const session = this.toJSON()

    return session
  }

  //
  // send session status
  //
  async sendSessionStatus(sessionStatus = {}) {
    const result = await this._fetchBridge(
      `/session/${this.sessionId}`,
      { method: 'PUT' },
      sessionStatus
    )

    return result
  }

  //
  // kill session
  //
  async killSession() {
    const result = await this._fetchBridge(`/session/${this.sessionId}`, {
      method: 'DELETE'
    })

    this.isConnected = false

    return result
  }

  //
  // approve call request
  //
  async approveCallRequest(callId, callResult) {
    if (!callId) {
      throw new Error('`callId` is required')
    }

    const data = {
      approved: true,
      result: callResult
    }

    const encryptionPayload = await this.encrypt(data)

    const result = await this.sendCallStatus(callId, {
      encryptionPayload
    })

    return result
  }

  //
  // reject call request
  //
  async rejectCallRequest(callId, error) {
    if (!callId) {
      throw new Error('`callId` is required')
    }

    const data = { approved: false, error: error }

    const encryptionPayload = await this.encrypt(data)

    const result = await this.sendCallStatus(callId, {
      encryptionPayload
    })

    return result
  }

  //
  // Send call status
  //
  async sendCallStatus(callId, callStatus) {
    await this._fetchBridge(
      `/call-status/${callId}/new`,
      { method: 'POST' },
      callStatus
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
