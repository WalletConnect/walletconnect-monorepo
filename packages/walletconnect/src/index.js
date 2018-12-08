/* global window */

import { Connector } from 'js-walletconnect-core'
import getWebsiteData from './getWebsiteData'

const localStorageId = 'wcsmngt'
let localStorage = null
if (
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined'
) {
  localStorage = window.localStorage
}

export default class WalletConnect extends Connector {
  //
  //  Initiate session
  //
  async initSession() {
    let liveSession = null

    const savedSession = this.getLocalSession()

    if (savedSession) {
      if (savedSession.expires > Date.now()) {
        this.sessionId = savedSession.sessionId
        this.symKey = savedSession.symKey

        const sessionStatus = await this.getSessionStatus()

        if (sessionStatus) {
          liveSession = {
            ...savedSession,
            accounts: sessionStatus.accounts,
            expires: sessionStatus.expires
          }
        }
      } else {
        this.deleteLocalSession(savedSession)
      }
    }

    let currentSession = liveSession || null

    if (currentSession) {
      this.accounts = currentSession.accounts
      this.bridgeUrl = currentSession.bridgeUrl
      this.sessionId = currentSession.sessionId
      this.symKey = currentSession.symKey
      this.expires = currentSession.expires
      this.isConnected = true
    } else {
      currentSession = await this.createSession()
    }

    return currentSession
  }

  //
  //  Create new session
  //
  async createSession() {
    this.symKey = await this.generateKey()

    // get website data
    const data = getWebsiteData()

    // encrypt data
    const encryptionPayload = await this.encrypt(data)

    const body = await this._fetchBridge(
      '/session/new',
      {
        method: 'POST'
      },
      {
        encryptionPayload
      }
    )

    this.sessionId = body.sessionId
    this.expires = body.expires
    this.accounts = []

    const session = this.saveLocalSession()

    return session
  }

  //
  //  Kill active session
  //
  killSession() {
    this.sessionId = ''
    this.symKey = ''
    this.expires = null
    this.accounts = []
    this.isConnected = false
    this.deleteLocalSession()
  }

  //
  //  Send Transaction
  //
  async sendTransaction(tx = {}) {
    try {
      const response = await this.createCallRequest({
        method: 'eth_sendTransaction',
        params: [tx]
      })
      if (!response.approved) {
        const error = response.error || 'Rejected: Signed Transaction Request'
        throw new Error(error)
      }
      return response.result
    } catch (error) {
      throw error
    }
  }

  //
  //  Sign Message
  //
  async signMessage(msgParams) {
    try {
      const response = await this.createCallRequest({
        method: 'eth_sign',
        params: [...msgParams]
      })
      if (!response.approved) {
        const error = response.error || 'Rejected: Signed Message Request'
        throw new Error(error)
      }
      return response.result
    } catch (error) {
      throw error
    }
  }

  //
  //  Sign Typed Data
  //
  async signTypedData(msgParams) {
    try {
      const response = await this.createCallRequest({
        method: 'eth_signTypedData',
        params: [...msgParams]
      })
      if (!response.approved) {
        const error = response.error || 'Rejected: Signed TypedData Request'
        throw new Error(error)
      }
      return response.result
    } catch (error) {
      throw error
    }
  }

  //
  //  Create call request
  //
  async createCallRequest(payload) {
    if (!this.isConnected) {
      throw new Error(
        'Initiate session using `initSession` before creating a call request'
      )
    }

    const data = this.formatPayload(payload)

    // encrypt data
    const encryptionPayload = await this.encrypt(data)

    // store call data on bridge
    const body = await this._fetchBridge(
      `/session/${this.sessionId}/call/new`,
      {
        method: 'POST'
      },
      {
        encryptionPayload
      }
    )
    try {
      const response = await this.listenCallStatus(body.callId)

      return response
    } catch (error) {
      throw error
    }
  }

  //
  //  Get session status
  //
  async getSessionStatus() {
    if (!this.sessionId) {
      throw new Error('sessionId is required')
    }
    const result = await this._getEncryptedData(`/session/${this.sessionId}`)

    if (result) {
      if (result.data.approved) {
        this.expires = result.expires
        this.chainId = result.data.chainId
        this.accounts = result.data.accounts

        this.isConnected = true

        const session = this.saveLocalSession()

        return session
      } else {
        const error = result.data.error || 'Rejected: Signed TypedData Request'
        this.isConnected = false
        throw new Error(error)
      }
    }

    return null
  }

  //
  //  Get call status
  //
  async getCallStatus(callId) {
    if (!this.sessionId || !callId) {
      throw new Error('sessionId and callId are required')
    }

    const result = await this._getEncryptedData(`/call-status/${callId}`)

    if (result) {
      return result.data
    }

    return null
  }

  //
  //  Listen for session status
  //
  listenSessionStatus(interval, timeout) {
    return this.promisifyListener({
      fn: async() => await this.getSessionStatus(),
      interval,
      timeout
    })
  }

  //
  //  Listen for call status
  //
  listenCallStatus(callId, interval, timeout) {
    return this.promisifyListener({
      fn: async() => await this.getCallStatus(callId),
      interval,
      timeout
    })
  }

  // -- localStorage -------------------------------------------------------- //

  getLocalSession() {
    let savedSession = null
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    if (savedLocal) {
      savedSession = this.checkObject(savedLocal, 'local session')
    }
    return savedSession
  }

  saveLocalSession() {
    const session = this.toJSON()
    localStorage.setItem(localStorageId, JSON.stringify(session))

    return session
  }

  deleteLocalSession() {
    localStorage.removeItem(localStorageId)
  }
}
