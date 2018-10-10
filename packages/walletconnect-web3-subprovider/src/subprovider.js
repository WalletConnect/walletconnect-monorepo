import { promisify } from './utils'

export default class Subprovider {
  _createFinalPayload(payload) {
    const finalPayload = {
      // defaults
      id: Subprovider._getRandomId(),
      jsonrpc: '2.0',
      params: [],
      ...payload
    }
    return finalPayload
  }
  // Ported from: https://github.com/MetaMask/provider-engine/blob/master/util/random-id.js
  _getRandomId(): number {
    const extraDigits = 3
    const baseTen = 10
    // 13 time digits
    const datePart = new Date().getTime() * Math.pow(baseTen, extraDigits)
    // 3 random digits
    const extraPart = Math.floor(Math.random() * Math.pow(baseTen, extraDigits))
    // 16 digits
    return datePart + extraPart
  }
  /**
   * @param payload JSON RPC request payload
   * @param next A callback to pass the request to the next subprovider in the stack
   * @param end A callback called once the subprovider is done handling the request
   */
  async handleRequest() {
    return
  }

  /**
   * Emits a JSON RPC payload that will then be handled by the ProviderEngine instance
   * this subprovider is a part of. The payload will cascade down the subprovider middleware
   * stack until finding the responsible entity for handling the request.
   * @param payload JSON RPC payload
   * @returns JSON RPC response payload
   */
  async emitPayloadAsync(payload) {
    const finalPayload = Subprovider._createFinalPayload(payload)
    // Promisify does the binding internally and `this` is supplied as a second argument
    const response = await promisify(this.engine.sendAsync, this.engine)(
      finalPayload
    )
    return response
  }
  /**
   * Set's the subprovider's engine to the ProviderEngine it is added to.
   * This is only called within the ProviderEngine source code, do not call
   * directly.
   * @param engine The ProviderEngine this subprovider is added to
   */
  setEngine(engine) {
    this.engine = engine
  }
}
