import {
  ISocketMessage,
  ITransportEvent,
  INetworkMonitor,
  ITransportLib,
  ISocketTransportOptions,
} from "@walletconnect/legacy-types";
import {
  isBrowser,
  getLocation,
  detectEnv,
  getQueryString,
  appendToQueryString,
} from "@walletconnect/legacy-utils";

import NetworkMonitor from "./network";

// @ts-ignore
const WS = typeof global.WebSocket !== "undefined" ? global.WebSocket : require("ws");

// -- SocketTransport ------------------------------------------------------ //

class SocketTransport implements ITransportLib {
  private _protocol: string;
  private _version: number;
  private _url: string;
  private _netMonitor: INetworkMonitor | null;
  private _socket: WebSocket | null;
  private _nextSocket: WebSocket | null;
  private _queue: ISocketMessage[] = [];
  private _events: ITransportEvent[] = [];
  private _subscriptions: string[] = [];

  // -- constructor ----------------------------------------------------- //

  constructor(private opts: ISocketTransportOptions) {
    this._protocol = opts.protocol;
    this._version = opts.version;
    this._url = "";
    this._netMonitor = null;
    this._socket = null;
    this._nextSocket = null;
    this._subscriptions = opts.subscriptions || [];
    this._netMonitor = opts.netMonitor || new NetworkMonitor();

    if (!opts.url || typeof opts.url !== "string") {
      throw new Error("Missing or invalid WebSocket url");
    }

    this._url = opts.url;

    this._netMonitor.on("online", () => this._socketCreate());
  }

  set readyState(_value) {
    // empty
  }

  get readyState(): number {
    return this._socket ? this._socket.readyState : -1;
  }

  set connecting(_value) {
    // empty
  }

  get connecting(): boolean {
    return this.readyState === 0;
  }

  set connected(_value) {
    // empty
  }

  get connected(): boolean {
    return this.readyState === 1;
  }

  set closing(_value) {
    // empty
  }

  get closing(): boolean {
    return this.readyState === 2;
  }

  set closed(_value) {
    // empty
  }

  get closed(): boolean {
    return this.readyState === 3;
  }

  // -- public ---------------------------------------------------------- //

  public open() {
    this._socketCreate();
  }

  public close() {
    this._socketClose();
  }

  public send(message: string, topic?: string, silent?: boolean): void {
    if (!topic || typeof topic !== "string") {
      throw new Error("Missing or invalid topic field");
    }

    this._socketSend({
      topic: topic,
      type: "pub",
      payload: message,
      silent: !!silent,
    });
  }

  public subscribe(topic: string) {
    this._socketSend({
      topic: topic,
      type: "sub",
      payload: "",
      silent: true,
    });
  }

  public on(event: string, callback: (payload: any) => void) {
    this._events.push({ event, callback });
  }

  // -- private ---------------------------------------------------------- //

  private _socketCreate() {
    if (this._nextSocket) {
      return;
    }

    const url = getWebSocketUrl(this._url, this._protocol, this._version);

    this._nextSocket = new WS(url);

    if (!this._nextSocket) {
      throw new Error("Failed to create socket");
    }

    this._nextSocket.onmessage = (event: MessageEvent) => this._socketReceive(event);

    this._nextSocket.onopen = () => this._socketOpen();

    this._nextSocket.onerror = (event: Event) => this._socketError(event);

    this._nextSocket.onclose = () => {
      setTimeout(() => {
        this._nextSocket = null;
        this._socketCreate();
      }, 1000);
    };
  }

  private _socketOpen() {
    this._socketClose();
    this._socket = this._nextSocket;
    this._nextSocket = null;
    this._queueSubscriptions();
    this._pushQueue();
  }

  private _socketClose() {
    if (this._socket) {
      this._socket.onclose = () => {
        // empty
      };
      this._socket.close();
    }
  }

  private _socketSend(socketMessage: ISocketMessage) {
    const message: string = JSON.stringify(socketMessage);

    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(message);
    } else {
      this._setToQueue(socketMessage);
      this._socketCreate();
    }
  }

  private async _socketReceive(event: MessageEvent) {
    let socketMessage: ISocketMessage;

    try {
      socketMessage = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    this._socketSend({
      topic: socketMessage.topic,
      type: "ack",
      payload: "",
      silent: true,
    });

    if (this._socket && this._socket.readyState === 1) {
      const events = this._events.filter(event => event.event === "message");
      if (events && events.length) {
        events.forEach(event => event.callback(socketMessage));
      }
    }
  }

  private _socketError(e: Event) {
    const events = this._events.filter(event => event.event === "error");
    if (events && events.length) {
      events.forEach(event => event.callback(e));
    }
  }

  private _queueSubscriptions() {
    const subscriptions = this._subscriptions;

    subscriptions.forEach((topic: string) =>
      this._queue.push({
        topic: topic,
        type: "sub",
        payload: "",
        silent: true,
      }),
    );

    this._subscriptions = this.opts.subscriptions || [];
  }

  private _setToQueue(socketMessage: ISocketMessage) {
    this._queue.push(socketMessage);
  }

  private _pushQueue() {
    const queue = this._queue;

    queue.forEach((socketMessage: ISocketMessage) => this._socketSend(socketMessage));

    this._queue = [];
  }
}

function getWebSocketUrl(_url: string, protocol: string, version: number): string {
  const url = _url.startsWith("https")
    ? _url.replace("https", "wss")
    : _url.startsWith("http")
    ? _url.replace("http", "ws")
    : _url;
  const splitUrl = url.split("?");
  const params = isBrowser()
    ? {
        protocol,
        version,
        env: "browser",
        host: getLocation()?.host || "",
      }
    : {
        protocol,
        version,
        env: detectEnv()?.name || "",
      };
  const queryString = appendToQueryString(getQueryString(splitUrl[1] || ""), params);
  return splitUrl[0] + "?" + queryString;
}

export default SocketTransport;
