import { EventEmitter } from "events";
import { Logger } from "pino";

import { IHeartBeat } from "@walletconnect/types";

import { HEARTBEAT_INTERVAL, HEARTBEAT_EVENTS, HEARTBEAT_CONTEXT } from "../constants";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { toMiliseconds } from "@walletconnect/utils";

export class HeartBeat extends IHeartBeat {
  public events = new EventEmitter();

  public interval = HEARTBEAT_INTERVAL;

  public name: string = HEARTBEAT_CONTEXT;

  constructor(public logger: Logger, interval?: number) {
    super(logger);
    this.logger = generateChildLogger(logger, this.name);
    this.interval = interval || HEARTBEAT_INTERVAL;
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
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

  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<any> {
    setInterval(() => this.pulse(), toMiliseconds(this.interval));
    this.logger.trace(`Initialized`);
  }

  private pulse() {
    this.events.emit(HEARTBEAT_EVENTS.pulse);
  }
}
