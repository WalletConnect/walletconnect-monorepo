import { IWalletConnectSession } from '@walletconnect/types'

// -- localStorage --------------------------------------------------------- //

const storageId: string = 'walletconnect'
let storage: Storage | null = null

if (
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined'
) {
  storage = window.localStorage
}

// -- typeChecks ----------------------------------------------------------- //

function isWalletConnectSession (object: any): object is IWalletConnectSession {
  return 'bridge' in object
}

// -- WebStorage ----------------------------------------------------------- //

class WebStorage {
  public getSession (): IWalletConnectSession | null {
    let session = null
    let local = null
    if (storage) {
      local = storage.getItem(storageId)
    }
    if (local && typeof local === 'string') {
      try {
        const json = JSON.parse(local)
        if (isWalletConnectSession(json)) {
          session = json
        }
      } catch (error) {
        throw error
      }
    }
    return session
  }

  public setSession (session: IWalletConnectSession): IWalletConnectSession {
    const local: string = JSON.stringify(session)
    if (storage) {
      storage.setItem(storageId, local)
    }
    return session
  }

  public removeSession (): void {
    if (storage) {
      storage.removeItem(storageId)
    }
  }
}

export default WebStorage
