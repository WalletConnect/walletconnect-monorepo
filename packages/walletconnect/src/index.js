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
          const sessionId = session.sessionId || null
          const sessionStatus = await this.getSessionStatus(sessionId)
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
    if (!this.symKey) {
      this.symKey = await this.generateKey()
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
      symKey: this.symKey,
      dappName: this.dappName
    }

    const uri = this._formatWalletConnectURI()
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
  async getSessionStatus(sessionId) {
    const _sessionId = sessionId || this.sessionId

    if (!_sessionId) {
      throw new Error('sessionId is required')
    }
    const result = await this._getEncryptedData(`/session/${_sessionId}`)

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
  // Get transaction status
  //
  async getTransactionStatus(transactionId) {
    if (!this.sessionId || !transactionId) {
      throw new Error('sessionId and transactionId are required')
    }

    const result = await this._getEncryptedData(
      `/transaction-status/${transactionId}`
    )

    return result
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
  // Listen for transaction status
  //
  listenTransactionStatus(transactionId, pollInterval = 1000, timeout = 60000) {
    return new Promise((resolve, reject) => {
      new Listener({
        fn: async() => await this.getTransactionStatus(transactionId),
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
