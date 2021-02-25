import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { IClient, ITimeout, ISequence } from "@walletconnect/types";

import { TIMEOUT_EVENTS, TIMEOUT_CONTEXT } from "../constants";

export class Timeout extends ITimeout {
  public timeout = new Map<string, NodeJS.Timeout>();

  public events = new EventEmitter();

  protected context: string = TIMEOUT_CONTEXT;

  constructor(public client: IClient, public logger: Logger, public sequence: ISequence) {
    super(client, logger, sequence);
    this.client = client;
    this.logger = generateChildLogger(logger, this.context);
    this.sequence = sequence;
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

  public async init(): Promise<void> {
    const persisted = this.sequence.settled.values.map((x: any) => ({
      topic: x.topic,
      timeout: x.data.timeout,
    }));
    persisted.forEach(({ topic, timeout }) => this.set(topic, timeout));
  }

  public set(topic: string, expiry: number): void {
    if (this.timeout.has(topic)) return;
    const ttl = expiry - Date.now();
    if (ttl <= 0) {
      this.onTimeout(topic);
      return;
    }
    const timeout = setTimeout(() => this.onTimeout(topic), ttl);
    this.timeout.set(topic, timeout);
    this.events.emit(TIMEOUT_EVENTS.created, { topic });
  }

  public get(topic: string): NodeJS.Timeout {
    const timeout = this.timeout.get(topic);
    if (typeof timeout === "undefined") {
      throw new Error(`No timeout timeout for topic: ${topic}`);
    }
    return timeout;
  }

  public has(topic: string): boolean {
    return this.timeout.has(topic);
  }

  public delete(topic: string): void {
    if (!this.timeout.has(topic)) return;
    const timeout = this.get(topic);
    clearTimeout(timeout);
    this.events.emit(TIMEOUT_EVENTS.deleted, { topic });
  }

  // ---------- Private ----------------------------------------------- //

  private onTimeout(topic: string): void {
    if (this.timeout.has(topic)) {
      this.delete(topic);
    }
    this.events.emit(TIMEOUT_EVENTS.expired, { topic });
  }
}
