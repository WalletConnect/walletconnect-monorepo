import {
  IInternalEvent,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcRequest,
  IEventEmitter
} from '@walletconnect/types'

// -- typeChecks ----------------------------------------------------------- //

function isRpcRequest (object: any): object is IJsonRpcRequest {
  return 'method' in object
}

function isRpcResponseSuccess (object: any): object is IJsonRpcResponseSuccess {
  return 'result' in object
}

function isRpcResponseError (object: any): object is IJsonRpcResponseError {
  return 'error' in object
}

function isInternalEvent (object: any): object is IInternalEvent {
  return 'event' in object
}

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

    if (isRpcRequest(payload)) {
      event = payload.method
    } else if (isRpcResponseSuccess(payload) || isRpcResponseError(payload)) {
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

    function isReservedEvent (event: string) {
      const reservedEvents = [
        'session_request',
        'session_update',
        'exchange_key',
        'connect',
        'disconnect'
      ]
      return reservedEvents.includes(event) || event.startsWith('wc_')
    }
    if ((!eventEmitters || !eventEmitters.length) && !isReservedEvent(event)) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === 'call_request'
      )
    }

    eventEmitters.forEach((eventEmitter: IEventEmitter) => {
      if (isRpcResponseError(payload)) {
        const error = new Error(payload.error.message)
        eventEmitter.callback(error, null)
      } else {
        eventEmitter.callback(null, payload)
      }
    })
  }
}

export default EventManager
