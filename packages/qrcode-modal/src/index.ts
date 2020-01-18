import { detectEnv } from '@walletconnect/utils'

import browser from './browser'
import node from './node'

const env = detectEnv()
const isNode = env.name === 'node'

function open (uri: string, cb: any) {
  if (isNode) {
    node.open(uri, cb)
  } else {
    browser.open(uri, cb)
  }
}

function close () {
  if (isNode) {
    node.close()
  } else {
    browser.close()
  }
}

export default { open, close }
