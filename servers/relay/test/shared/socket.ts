import WebSocket from "ws";
import { EventEmitter } from "events";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import { LegacySocketMessage } from "../../src/types";

export class Socket {
  public events = new EventEmitter();

  private socket: WebSocket | undefined;

  constructor(public url: string) {
    this.url = url;
  }

  get connected(): boolean {
    return typeof this.socket !== "undefined";
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  public async open(url: string = this.url): Promise<void> {
    this.socket = await this.register(url);
  }

  public async close(): Promise<void> {
    if (typeof this.socket === "undefined") {
      throw new Error("Already disconnected");
    }
    this.socket.close();
    this.onClose();
  }

  public async send(payload: LegacySocketMessage): Promise<void> {
    if (typeof this.socket === "undefined") {
      this.socket = await this.register();
    }
    this.socket.send(safeJsonStringify(payload));
  }

  // ---------- Private ----------------------------------------------- //

  private register(url = this.url): Promise<WebSocket> {
    this.url = url;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, [], {rejectUnauthorized: false});
      socket.onopen = () => {
        this.onOpen(socket);
        resolve(socket);
      };
      socket.onerror = (event: any) => {
        this.events.emit("error", event);
        reject(event);
      };
    });
  }

  private onOpen(socket: WebSocket) {
    socket.onmessage = (event: any) => this.onPayload(event);
    socket.onclose = () => this.onClose();
    this.socket = socket;
    this.events.emit("open");
  }

  private onClose() {
    this.socket = undefined;
    this.events.emit("close");
  }

  private onPayload(e: { data: any }) {
    if (typeof e.data === "undefined") return;
    const message: any = typeof e.data === "string" ? safeJsonParse(e.data) : e.data;
    this.events.emit("message", message);
  }
}
