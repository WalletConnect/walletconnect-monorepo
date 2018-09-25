/* global window Promise */

import { Connector, Listener } from 'js-walletconnect-core'

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
    let liveSessions = null
    const savedSessions = this.getLocalSessions()
    if (savedSessions) {
      const openSessions = []
      Object.keys(savedSessions).forEach(sessionId => {
        const session = savedSessions[sessionId]
        const now = Date.now()
        if (session.expires > now) {
          openSessions.push(session)
        } else {
          this.deleteLocalSession(session)
        }
      })
      liveSessions = await Promise.all(
        openSessions.map(async session => {
          this.sessionId = session.sessionId
          this.symKey = session.symKey
          const sessionStatus = await this.getSessionStatus()
          if (sessionStatus) {
            return {
              ...session,
              accounts: sessionStatus.accounts,
              expires: sessionStatus.expires
            }
          } else {
            return null
          }
        })
      )
      liveSessions = liveSessions.filter(session => !!session)
    }

    let session = {
      new: false
    }

    let currentSession =
      liveSessions && liveSessions.length ? liveSessions[0] : null

    if (currentSession) {
      this.bridgeUrl = currentSession.bridgeUrl
      this.sessionId = currentSession.sessionId
      this.symKey = currentSession.symKey
      this.dappName = currentSession.dappName
      this.expires = currentSession.expires

      session.accounts = currentSession.accounts
    } else {
      currentSession = await this.createSession()
      session.new = true
      session.uri = currentSession.uri
    }

    return session
  }

  //
  // Create session
  //
  async createSession() {
    this.symKey = await this.generateKey()

    const body = await this._fetchBridge('/session/new', {
      method: 'POST'
    })

    this.sessionId = body.sessionId

    const sessionData = {
      bridgeUrl: this.bridgeUrl,
      sessionId: this.sessionId,
      symKey: this.symKey,
      dappName: this.dappName
    }

    const uri = this._formatWalletConnectURI()

    return { ...sessionData, uri }
  }

  //
  // Send Transaction
  //
  async sendTransaction(tx = {}) {
    const txId = await this.createCall('eth_sendTransaction', tx)

    const txStatus = await this.listenCallStatus(txId)

    if (txStatus.success) {
      const { result } = txStatus
      return result
    } else {
      throw new Error('Rejected: Transaction Request')
    }
  }

  //
  // Sign Message
  //
  async signMessage(msg) {
    const msgId = await this.createCall('eth_sign', msg)

    const msgStatus = await this.listenCallStatus(msgId)

    if (msgStatus.success) {
      const { result } = msgStatus
      return result
    } else {
      throw new Error('Rejected: Signed Message')
    }
  }

  //
  //  Sign Typed Data
  //
  async signTypedData(msgParams) {
    const msgId = await this.createCall('eth_signTypedData', msgParams)

    const msgStatus = await this.listenCallStatus(msgId)

    if (msgStatus.success) {
      const { result } = msgStatus
      return result
    } else {
      throw new Error('Rejected: Signed Typed Data')
    }
  }

  //
  // Create call
  //
  async createCall(method = 'eth_sendTransaction', data = {}) {
    if (!this.sessionId) {
      throw new Error(
        'Create session using `initSession` before creating a call'
      )
    }

    // encrypt data
    const encryptedData = await this.encrypt(data)

    // store call data on bridge
    const body = await this._fetchBridge(
      `/session/${this.sessionId}call/new`,
      {
        method: 'POST'
      },
      {
        method: method,
        data: encryptedData,
        dappName: this.dappName
      }
    )

    // return callId
    return {
      callId: body.callId
    }
  }

  //
  // Get session status
  //
  async getSessionStatus() {
    if (!this.sessionId) {
      throw new Error('sessionId is required')
    }
    const result = await this._getEncryptedData(`/session/${this.sessionId}`)

    if (result) {
      const expires = Number(result.expiresInSeconds) * 1000
      const accounts = result.data

      this.expires = expires

      const sessionData = {
        bridgeUrl: this.bridgeUrl,
        sessionId: this.sessionId,
        symKey: this.symKey,
        dappName: this.dappName,
        expires
      }

      this.saveLocalSession(sessionData)

      return { accounts, expires }
    }
    return null
  }

  //
  // Get call status
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
  // Listen for session status
  //
  listenSessionStatus(pollInterval = 1000, timeout = 60000) {
    return new Promise((resolve, reject) => {
      new Listener({
        fn: async() => await this.getSessionStatus(),
        cb: (err, result) => {
          if (err) {
            reject(err)
          }
          resolve(result)
        },
        pollInterval,
        timeout
      })
    })
  }

  //
  // Listen for call status
  //
  listenCallStatus(callId, pollInterval = 1000, timeout = 60000) {
    return new Promise((resolve, reject) => {
      new Listener({
        fn: async() => await this.getCallStatus(callId),
        cb: (err, result) => {
          if (err) {
            reject(err)
          }
          resolve(result)
        },
        pollInterval,
        timeout
      })
    })
  }

  // -- localStorage -------------------------------------------------------- //

  getLocalSessions() {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    let savedSessions = null
    if (savedLocal) {
      savedSessions = JSON.parse(savedLocal)
    }
    return savedSessions
  }

  saveLocalSession(session) {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    let savedSessions = {}
    if (savedLocal) {
      savedSessions = JSON.parse(savedLocal)
    }
    savedSessions[session.sessionId] = session
    localStorage.setItem(localStorageId, JSON.stringify(savedSessions))
  }

  updateLocalSession(session) {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    let savedSessions = {}
    if (savedLocal) {
      savedSessions = JSON.parse(savedLocal)
    }
    savedSessions[session.sessionId] = {
      ...savedSessions[session.sessionId],
      ...session
    }
    localStorage.setItem(localStorageId, JSON.stringify(savedSessions))
  }

  deleteLocalSession(session) {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    if (savedLocal) {
      let savedSessions = JSON.parse(savedLocal)
      delete savedSessions[session.sessionId]
      localStorage.setItem(localStorageId, JSON.stringify(savedSessions))
    }
  }
}
