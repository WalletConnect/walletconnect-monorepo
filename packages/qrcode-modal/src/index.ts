import browser from './browser'
import node from './node'

function open (uri: string, cb: any, isNode?: boolean) {
  if (isNode) {
    node.open(uri, cb)
  } else {
    browser.open(uri, cb)
  }
}

function close (isNode?: boolean) {
  if (isNode) {
    node.close()
  } else {
    browser.close()
  }
}

export default { open, close }
