import { Connector } from 'js-walletconnect-core'

export default class WalletConnector extends Connector {
  constructor(opts) {
    super(opts)

    this.push = this._checkPushOptions(opts)
  }

  //
  // approve session
  //
  async approveSession(data) {
    const encryptionPayload = await this.encrypt(data)

    const result = await this.sendSessionStatus({
      approved: true,
      push: this.push,
      encryptionPayload
    })

    this.expires = result.expires
    this.connected = true

    const session = this.toJSON()

    return session
  }

  //
  // reject session
  //
  async rejectSession() {
    await this.sendSessionStatus({
      approved: false,
      push: null,
      encryptionPayload: null
    })

    this.connected = false

    const session = this.toJSON()

    return session
  }

  //
  // send session status
  //
  async sendSessionStatus(session = {}) {
    const result = await this._fetchBridge(
      `/session/${this.sessionId}`,
      { method: 'PUT' },
      session
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

    this.connected = false

    return result
  }
  //
  // Send call status
  //
  async sendCallStatus(callId, statusData = {}) {
    if (!callId) {
      throw new Error('`callId` is required')
    }

    // encrypt data
    const encryptionPayload = await this.encrypt(statusData)

    // store call info on bridge
    await this._fetchBridge(
      `/call-status/${callId}/new`,
      { method: 'POST' },
      { encryptionPayload }
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

  // -- Private Methods ----------------------------------------------------- //

  //
  //  Checks Push Options are present or valid type
  //
  _checkPushOptions(opts) {
    if (!opts.push || typeof opts.push !== 'object') {
      throw new Error('Push notification options are missing or invalid')
    }

    const push = opts.push

    const supportedTypes = ['fcm', 'apn']
    const supportedString = supportedTypes.reduce(
      (a, b, i) => (i === 0 ? b : a + `, ${b}`),
      ''
    )

    if (!push.type || typeof push.type !== 'string') {
      throw new Error('Push type option is missing or invalid')
    } else if (!supportedTypes.includes(push.type.toLowerCase())) {
      throw new Error(
        `Push type must be one of the following: ${supportedString}`
      )
    }

    if (!push.token || typeof push.token !== 'string') {
      throw new Error('Push token option is missing or invalid')
    }

    if (!push.endpoint || typeof push.endpoint !== 'string') {
      throw new Error('Push endpoint option is missing or invalid')
    }

    return push
  }
}
