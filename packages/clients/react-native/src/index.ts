import Connector from '@walletconnect/core'
import {
  IWalletConnectOptions,
  INativeWalletOptions,
  IPushServerOptions,
  IPushSubscription
} from '@walletconnect/types'
import SocketTransport from '@walletconnect/socket-transport'
import * as cryptoLib from './rnCrypto'
import { getNetMonitor } from './rnNetMonitor'

const transportOpts = {
  initTransport: (opts: any) => new SocketTransport(opts),
  params: ['bridge', 'clientId']
}

class RNWalletConnect extends Connector {
  constructor (
    opts: IWalletConnectOptions,
    walletOptions: INativeWalletOptions
  ) {
    super(
      cryptoLib,
      opts,
      transportOpts,
      null,
      getNetMonitor,
      walletOptions.clientMeta
    )
    if (walletOptions.push) {
      this.registerPushServer(walletOptions.push)
    }
  }

  private registerPushServer (push: IPushServerOptions) {
    if (!push.url || typeof push.url !== 'string') {
      throw Error('Invalid or missing push.url parameter value')
    }

    if (!push.type || typeof push.type !== 'string') {
      throw Error('Invalid or missing push.type parameter value')
    }

    if (!push.token || typeof push.token !== 'string') {
      throw Error('Invalid or missing push.token parameter value')
    }

    const pushSubscription: IPushSubscription = {
      bridge: this.bridge,
      topic: this.clientId,
      type: push.type,
      token: push.token,
      peerName: '',
      language: push.language || ''
    }

    this.on('connect', (error: Error | null, payload: any) => {
      if (error) {
        throw error
      }

      if (push.peerMeta) {
        const peerName = payload.params[0].peerMeta.name
        pushSubscription.peerName = peerName
      }

      this.postClientDetails(push.url, pushSubscription)
    })
  }

  private async postClientDetails (
    url: string,
    pushSubcription: IPushSubscription
  ) {
    try {
      const response = await fetch(`${url}/new`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pushSubcription)
      })

      const json = await response.json()
      if (!json.success) {
        throw Error('Failed to register push server')
      }
    } catch (error) {
      throw Error('Failed to register push server')
    }
  }
}

export default RNWalletConnect
