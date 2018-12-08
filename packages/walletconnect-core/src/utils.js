/* global Buffer */

import ethParseUri from 'eth-parse-uri'

//
//  Parse ERC-1328 - WalletConnect Standard URI Format
//
export function parseWalletConnectURI(string) {
  const result = ethParseUri(string)
  if (result.prefix && result.prefix === 'wc') {
    if (!result.sessionId) {
      throw Error('Missing sessionId field')
    }

    if (!result.bridge) {
      throw Error('Missing bridge url field')
    }

    if (!result.symKey) {
      throw Error('Missing symKey field')
    }

    const symKey = Buffer.from(result.symKey, 'base64')

    const session = {
      version: result.version,
      sessionId: result.sessionId,
      bridgeUrl: result.bridge,
      symKey: symKey
    }
    return session
  } else {
    throw new Error('URI string doesn\'t follow ERC-1328 standard')
  }
}
