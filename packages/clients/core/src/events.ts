import {
  isJsonRpcRequest,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError,
  isInternalEvent,
  isReservedEvent
} from '@walletconnect/utils'
import {
  IInternalEvent,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcRequest,
  IEventEmitter
} from '@walletconnect/types'

// -- EventManager --------------------------------------------------------- //

class EventManager {
  private _eventEmitters: IEventEmitter[]

  constructor () {
    this._eventEmitters = []
  }

  public subscribe (eventEmitter: IEventEmitter) {
    this._eventEmitters.push(eventEmitter)
  }

  public trigger (
    payload:
      | IJsonRpcRequest
      | IJsonRpcResponseSuccess
      | IJsonRpcResponseError
      | IInternalEvent
  ): void {
    let eventEmitters: IEventEmitter[] = []
    let event: string

    if (isJsonRpcRequest(payload)) {
      event = payload.method
    } else if (
      isJsonRpcResponseSuccess(payload) ||
      isJsonRpcResponseError(payload)
    ) {
      event = `response:${payload.id}`
    } else if (isInternalEvent(payload)) {
      event = payload.event
    } else {
      event = ''
    }

    if (event) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === event
      )
    }

    if (
      (!eventEmitters || !eventEmitters.length) &&
      !isReservedEvent(event) &&
      !isInternalEvent(event)
    ) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === 'call_request'
      )
    }

    eventEmitters.forEach((eventEmitter: IEventEmitter) => {
      if (isJsonRpcResponseError(payload)) {
        const error = new Error(payload.error.message)
        eventEmitter.callback(error, null)
      } else {
        eventEmitter.callback(null, payload)
      }
    })
  }
}

export default EventManager
