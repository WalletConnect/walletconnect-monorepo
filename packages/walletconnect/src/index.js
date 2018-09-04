/* global window Promise */

import { Connector, Listener, generateKey } from 'walletconnect-core'

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
        return session.expires > now
      })
      liveSessions = await Promise.all(
        openSessions.map(async session => {
          const sessionStatus = await this.getSessionStatus()
          const accounts = sessionStatus.data
          const expires = Number(sessionStatus.expiresInSeconds) * 1000
          if (accounts) {
            return {
              ...session,
              accounts,
              expires
            }
          } else {
            return null
          }
        })
      )
      liveSessions = liveSessions.filter(session => !!session)
    }

    let currentSession =
      liveSessions && liveSessions.length ? liveSessions[0] : null

    if (currentSession) {
      this.bridgeUrl = currentSession.bridgeUrl
      this.sessionId = currentSession.sessionId
      this.sharedKey = currentSession.sharedKey
      this.dappName = currentSession.dappName
      this.expires = currentSession.expires
    } else {
      currentSession = this.createSession()
    }
    return currentSession
  }

  //
  // Create session
  //
  async createSession() {
    if (this.sessionId) {
      throw new Error('session already created')
    }

    // create shared key
    if (!this.sharedKey) {
      this.sharedKey = await generateKey()
    }

    // store session info on bridge
    const body = await this._fetchBridge('/session/new', {
      method: 'POST'
    })

    // session id
    this.sessionId = body.sessionId

    const sessionData = {
      bridgeUrl: this.bridgeUrl,
      sessionId: this.sessionId,
      sharedKey: this.sharedKey,
      dappName: this.dappName,
      expires: this.expires
    }

    const uri = this._formatURI(sessionData)
    return { ...sessionData, uri }
  }

  //
  // Create transaction
  //
  async createTransaction(data = {}) {
    if (!this.sessionId) {
      throw new Error(
        'Create session using `initSession` before sending transaction'
      )
    }

    // encrypt data
    const encryptedData = await this.encrypt(data)

    // store transaction info on bridge
    const body = await this._fetchBridge(
      `/session/${this.sessionId}/transaction/new`,
      {
        method: 'POST'
      },
      {
        data: encryptedData,
        dappName: this.dappName
      }
    )

    // return transactionId
    return {
      transactionId: body.transactionId
    }
  }

  //
  // Get session status
  //
  getSessionStatus() {
    if (!this.sessionId) {
      throw new Error('sessionId is required')
    }
    return this._getEncryptedData(`/session/${this.sessionId}`)
  }

  //
  // Get transaction status
  //
  getTransactionStatus(transactionId) {
    if (!this.sessionId || !transactionId) {
      throw new Error('sessionId and transactionId are required')
    }

    return this._getEncryptedData(`/transaction-status/${transactionId}`)
  }

  //
  // Listen for session status
  //
  listenSessionStatus(cb, pollInterval = 1000, timeout = 60000) {
    return new Listener(this, {
      fn: () => {
        return this.getSessionStatus()
      },
      cb,
      pollInterval,
      timeout
    })
  }

  //
  // Listen for session status
  //
  listenTransactionStatus(
    transactionId,
    cb,
    pollInterval = 1000,
    timeout = 60000
  ) {
    return new Listener(this, {
      fn: () => {
        return this.getTransactionStatus(transactionId)
      },
      cb,
      pollInterval,
      timeout
    })
  }

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
    if (savedLocal) {
      let savedSessions = JSON.parse(savedLocal)
      savedSessions[session.sessionId] = session
      localStorage.setItem(localStorageId, JSON.stringify(savedSessions))
    }
  }

  updateLocalSession(session) {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    if (savedLocal) {
      let savedSessions = JSON.parse(savedLocal)
      savedSessions[session.sessionId] = {
        ...savedSessions[session.sessionId],
        ...session
      }
      localStorage.setItem(localStorageId, JSON.stringify(savedSessions))
    }
  }

  deleteLocalSession(session) {
    const savedLocal = localStorage && localStorage.getItem(localStorageId)
    if (savedLocal) {
      localStorage.removeItem(session.sessionId)
    }
  }
}
