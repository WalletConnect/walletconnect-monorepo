import { promisify } from './utils'

export default class Subprovider {
  _createFinalPayload(payload) {
    const finalPayload = {
      id: Subprovider._getRandomId(),
      jsonrpc: '2.0',
      params: [],
      ...payload
    }
    return finalPayload
  }
  _getRandomId() {
    const extraDigits = 3
    const baseTen = 10
    const datePart = new Date().getTime() * Math.pow(baseTen, extraDigits)
    const extraPart = Math.floor(Math.random() * Math.pow(baseTen, extraDigits))
    return datePart + extraPart
  }

  async handleRequest() {
    return
  }

  async emitPayloadAsync(payload) {
    const finalPayload = Subprovider._createFinalPayload(payload)
    const response = await promisify(this.engine.sendAsync, this.engine)(
      finalPayload
    )
    return response
  }

  setEngine(engine) {
    this.engine = engine
  }
}
