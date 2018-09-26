function randomId() {
  // 13 time digits
  var datePart = new Date().getTime() * Math.pow(10, 3)
  // 3 random digits
  var extraPart = Math.floor(Math.random() * Math.pow(10, 3))
  // 16 digits
  return datePart + extraPart
}

function createPayload(data) {
  return {
    id: randomId(),
    jsonrpc: '2.0',
    params: [],
    data
  }
}

class SubProvider {
  setEngine(engine) {
    const self = this
    self.engine = engine
    engine.on('block', function(block) {
      self.currentBlock = block
    })
  }
  handleRequest() {
    throw new Error('Subproviders should override `handleRequest`.')
  }
  emitPayload(payload, cb) {
    const self = this
    self.engine.sendAsync(createPayload(payload), cb)
  }
}

export default SubProvider
