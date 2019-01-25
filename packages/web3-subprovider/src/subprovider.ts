import { payloadId, promisify } from '@walletconnect/utils'
import {
  IJsonRpcRequest,
  IJsonRpcResponse,
  IWeb3Provider,
  ICallback,
  IErrorCallback
} from '@walletconnect/types'

abstract class Subprovider {
  public engine!: IWeb3Provider
  protected static _createFinalPayload (
    payload: Partial<IJsonRpcRequest>
  ): Partial<IJsonRpcRequest> {
    const finalPayload = {
      id: Subprovider._getRandomId(),
      jsonrpc: '2.0',
      params: [],
      ...payload
    }
    return finalPayload
  }

  private static _getRandomId (): number {
    return payloadId()
  }

  public abstract async handleRequest(
    payload: IJsonRpcRequest,
    next: ICallback,
    end: IErrorCallback
  ): Promise<void>

  public async emitPayloadAsync (
    payload: Partial<IJsonRpcRequest>
  ): Promise<IJsonRpcResponse> {
    const finalPayload = Subprovider._createFinalPayload(payload)
    const response = await promisify(this.engine.sendAsync, this.engine)(
      finalPayload
    )
    return response
  }

  public setEngine (engine: IWeb3Provider): void {
    this.engine = engine
  }
}

export default Subprovider
