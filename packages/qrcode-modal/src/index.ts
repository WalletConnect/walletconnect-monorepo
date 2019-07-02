import browser from './browser'
import node from './node'

const isNode = new Function(
  'try {return this===global;}catch(e){return false;}'
)

function open (uri: string, cb: any) {
  if (isNode()) {
    node.open(uri, cb)
  } else {
    browser.open(uri, cb)
  }
}

function close () {
  if (isNode()) {
    node.close()
  } else {
    browser.close()
  }
}

export default { open, close }
