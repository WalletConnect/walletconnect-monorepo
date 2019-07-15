import browser from './browser'
import node from './node'

let isNode = false

function open (uri: string, cb: any, _isNode?: boolean) {
  isNode = !!_isNode
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
