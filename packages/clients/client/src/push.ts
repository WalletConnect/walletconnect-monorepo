import {
  IConnector,
  IPushServerOptions,
  IPushSubscription
} from '@walletconnect/types'

export function registerPushServer (
  connector: IConnector,
  pushOpts: IPushServerOptions
) {
  if (!pushOpts.url || typeof pushOpts.url !== 'string') {
    throw Error('Invalid or missing pushOpts.url parameter value')
  }

  if (!pushOpts.type || typeof pushOpts.type !== 'string') {
    throw Error('Invalid or missing pushOpts.type parameter value')
  }

  if (!pushOpts.token || typeof pushOpts.token !== 'string') {
    throw Error('Invalid or missing pushOpts.token parameter value')
  }

  const pushSubscription: IPushSubscription = {
    bridge: connector.bridge,
    topic: connector.clientId,
    type: pushOpts.type,
    token: pushOpts.token,
    peerName: '',
    language: pushOpts.language || ''
  }

  connector.on('connect', async (error: Error | null, payload: any) => {
    if (error) {
      throw error
    }

    if (pushOpts.peerMeta) {
      const peerName = payload.params[0].peerMeta.name
      pushSubscription.peerName = peerName
    }

    try {
      const response = await fetch(`${pushOpts.url}/new`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pushSubscription)
      })

      const json = await response.json()
      if (!json.success) {
        throw Error('Failed to register in Push Server')
      }
    } catch (error) {
      throw Error('Failed to register in Push Server')
    }
  })
}
