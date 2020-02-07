// @ts-ignore
// import { NetInfo, ConnectionInfo, ConnectionType } from 'react-native'
import {
  NetworkEvent,
  INetworkEventEmitter,
  NetworkMonitor
} from '@walletconnect/types'

// -- RNNetMonitor --------------------------------------------------------- //

class RNNetMonitor {
  private _eventEmitters: INetworkEventEmitter[]

  constructor () {
    this._eventEmitters = []

    // TODO: Fix compile error "Can't resolve 'react-native'"
    // NetInfo.addEventListener('connectionChange', this.handleConnectivityChange)
  }

  public on (event: NetworkEvent, callback: () => void): void {
    this._eventEmitters.push({
      event,
      callback
    })
  }

  public trigger (event: NetworkEvent): void {
    let eventEmitters: INetworkEventEmitter[] = []

    if (event) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: INetworkEventEmitter) => eventEmitter.event === event
      )
    }

    eventEmitters.forEach((eventEmitter: INetworkEventEmitter) => {
      eventEmitter.callback()
    })
  }

  public handleConnectivityChange (
    // connectionInfo: ConnectionInfo | ConnectionType
    connectionInfo: any
  ) {
    if (typeof connectionInfo === 'string') {
      if (connectionInfo === 'none') {
        this.trigger('offline')
      } else {
        this.trigger('online')
      }
    } else {
      if (connectionInfo.type === 'none') {
        this.trigger('offline')
      } else {
        this.trigger('online')
      }
    }
  }
}

export function getNetMonitor (): NetworkMonitor {
  const netMonitor = new RNNetMonitor()
  return netMonitor
}

export default RNNetMonitor
