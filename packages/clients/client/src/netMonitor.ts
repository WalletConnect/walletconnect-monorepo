import {
  NetworkEvent,
  INetworkEventEmitter,
  NetworkMonitor
} from '@walletconnect/types'

// -- WebNetMonitor --------------------------------------------------------- //

class WebNetMonitor {
  private _eventEmitters: INetworkEventEmitter[]

  constructor () {
    this._eventEmitters = []

    window.addEventListener('online', () => this.trigger('online'))
    window.addEventListener('offline', () => this.trigger('offline'))
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
}

export function getNetMonitor (): NetworkMonitor {
  const netMonitor = new WebNetMonitor()
  return netMonitor
}

export default WebNetMonitor
