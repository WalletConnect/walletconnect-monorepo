import {
  IInternalEvent,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcRequest,
  IEventEmitter,
} from "@walletconnect/legacy-types";
import {
  isJsonRpcRequest,
  isJsonRpcResponseSuccess,
  isJsonRpcResponseError,
  isInternalEvent,
  isReservedEvent,
} from "@walletconnect/legacy-utils";

// -- EventManager --------------------------------------------------------- //

class EventManager {
  private _eventEmitters: IEventEmitter[];

  constructor() {
    this._eventEmitters = [];
  }

  public subscribe(eventEmitter: IEventEmitter) {
    this._eventEmitters.push(eventEmitter);
  }

  public unsubscribe(event: string) {
    this._eventEmitters = this._eventEmitters.filter(x => x.event !== event);
  }

  public trigger(
    payload: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | IInternalEvent,
  ): void {
    let eventEmitters: IEventEmitter[] = [];
    let event: string;

    if (isJsonRpcRequest(payload)) {
      event = payload.method;
    } else if (isJsonRpcResponseSuccess(payload) || isJsonRpcResponseError(payload)) {
      event = `response:${payload.id}`;
    } else if (isInternalEvent(payload)) {
      event = payload.event;
    } else {
      event = "";
    }

    if (event) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === event,
      );
    }

    if (
      (!eventEmitters || !eventEmitters.length) &&
      !isReservedEvent(event) &&
      !isInternalEvent(event)
    ) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: IEventEmitter) => eventEmitter.event === "call_request",
      );
    }

    eventEmitters.forEach((eventEmitter: IEventEmitter) => {
      if (isJsonRpcResponseError(payload)) {
        const error = new Error(payload.error.message);
        eventEmitter.callback(error, null);
      } else {
        eventEmitter.callback(null, payload);
      }
    });
  }
}

export default EventManager;
