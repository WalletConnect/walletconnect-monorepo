/* global fetch Promise */

import { Utils } from 'js-walletconnect-core'
import WalletConnector from './walletConnector'
import {
  asyncStorageLoadSessions,
  asyncStorageSaveSession,
  asyncStorageDeleteSession
} from './asyncStorage'

export default class WalletConnectController {
  constructor(opts) {
    this.push = this._checkPushOptions(opts)
    this.walletConnectors = {}
  }

  async init() {
    const liveSessions = {}
    let savedSessions = {}
    try {
      savedSessions = await asyncStorageLoadSessions()
    } catch (err) {
      throw err
    }
    const savedSessionIds = savedSessions ? Object.keys(savedSessions) : []
    if (savedSessions && savedSessionIds.length) {
      try {
        await Promise.all(
          savedSessionIds.map(async sessionId => {
            const now = Date.now()
            const session = savedSessions[sessionId]
            if (session.expires > now) {
              liveSessions[sessionId] = session
            } else {
              try {
                await asyncStorageDeleteSession(session)
              } catch (err) {
                throw err
              }
            }
          })
        )
      } catch (err) {
        throw err
      }
      const liveSessionIds = liveSessions ? Object.keys(liveSessions) : {}
      if (liveSessions && liveSessionIds.length) {
        try {
          await Promise.all(
            liveSessionIds.map(async sessionId => {
              const session = liveSessions[sessionId]

              const walletConnector = await this.generateSession(session)

              this.setWalletConnector(sessionId, walletConnector)
            })
          )
        } catch (err) {
          throw err
        }
      }
    }
    return liveSessions
  }

  async generateSession(uri) {
    let session = Utils.parseWalletConnectURI(uri)

    const walletConnector = new WalletConnector(session, this.push.webhook)

    const sessionId = walletConnector.sessionId

    const result = await walletConnector._getEncryptedData(
      `/session/${sessionId}`
    )

    if (result) {
      const dappData = result.data

      walletConnector.dappData = dappData

      await this._fetchPush(sessionId, dappData.name)

      this._setWalletConnector(sessionId, walletConnector)

      return { sessionId, dappData }
    } else {
      throw new Error('Failed to get Session Request data')
    }
  }

  async approveSession({ sessionId, chainId, accounts }) {
    const walletConnector = this._getWalletConnector(sessionId)

    const session = await walletConnector.approveSession({ chainId, accounts })

    try {
      await asyncStorageSaveSession(session)
    } catch (err) {
      throw err
    }
  }

  async rejectSession({ sessionId, error }) {
    const walletConnector = this._getWalletConnector(sessionId)

    const session = await walletConnector.rejectSession(error)

    try {
      await asyncStorageDeleteSession(session)
    } catch (err) {
      throw err
    }
  }

  async killSession({ sessionId }) {
    const walletConnector = this._getWalletConnector(sessionId)

    const session = await walletConnector.killSession()

    try {
      await asyncStorageDeleteSession(session)
    } catch (err) {
      throw err
    }
  }

  async getCallRequests({ sessionId }) {
    const walletConnector = this._getWalletConnector(sessionId)

    const allCallRequests = await walletConnector.getAllCallRequests()

    return allCallRequests
  }

  async approveCallRequest({ sessionId, callId, callResult }) {
    const walletConnector = this._getWalletConnector(sessionId)

    await walletConnector.approveCallRequest(callId, callResult)

    return true
  }

  async rejectCallRequest({ sessionId, callId, error }) {
    const walletConnector = this._getWalletConnector(sessionId)

    await walletConnector.rejectCallRequest(callId, error)

    return true
  }

  // -- Private Methods ----------------------------------------------------- //

  async _fetchPush(sessionId, dappName) {
    const push = this.push

    if (push) {
      const response = await fetch(push.database, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionId,
          type: push.type,
          token: push.token,
          dappName: dappName,
          language: push.language
        })
      })
      return response
    }
    return null
  }

  _setWalletConnector(sessionId, walletConnector) {
    this.walletConnectors[sessionId] = walletConnector
    return true
  }

  _getWalletConnector(sessionId) {
    const walletConnector = this.walletConnectors[sessionId]
    return walletConnector
  }

  _checkPushOptions(opts) {
    if (!opts.push || typeof opts.push !== 'object') {
      return null
    }

    const push = opts.push

    const supportedTypes = ['fcm', 'apn']
    const supportedString = supportedTypes.reduce(
      (a, b, i) => (i === 0 ? b : a + `, ${b}`),
      ''
    )

    if (!push.type || typeof push.type !== 'string') {
      throw new Error('Push type parameter is missing or invalid')
    } else if (!supportedTypes.includes(push.type.toLowerCase())) {
      throw new Error(
        `Push type must be one of the following: ${supportedString}`
      )
    }

    if (!push.token || typeof push.token !== 'string') {
      throw new Error('Push token parameter is missing or invalid')
    }

    if (!push.webhook || typeof push.webhook !== 'string') {
      throw new Error('Push webhook parameter is missing or invalid')
    }

    if (!push.database || typeof push.database !== 'string') {
      throw new Error('Push database parameter is missing or invalid')
    }

    if (push.language && typeof push.language !== 'string') {
      throw new Error('Push language parameter is invalid')
    }

    return push
  }
}
