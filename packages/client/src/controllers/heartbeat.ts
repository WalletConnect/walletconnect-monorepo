import pino, { Logger } from "pino";
import { EventEmitter } from "events";

import { IHeartBeat, HeartBeatOptions } from "@walletconnect/types";

import {
  HEARTBEAT_INTERVAL,
  HEARTBEAT_EVENTS,
  HEARTBEAT_CONTEXT,
  HEARTBEAT_DEFAULT_LOGGER,
} from "../constants";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { toMiliseconds } from "@walletconnect/utils";

export class HeartBeat extends IHeartBeat {
  static async init(opts?: HeartBeatOptions) {
    const heartbeat = new HeartBeat(opts);
    await heartbeat.init();
    return heartbeat;
  }

  public events = new EventEmitter();

  public interval = HEARTBEAT_INTERVAL;

  public name: string = HEARTBEAT_CONTEXT;

  public logger: Logger;

  constructor(opts?: HeartBeatOptions) {
    super(opts);
    this.logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? generateChildLogger(opts.logger, this.name)
        : pino(getDefaultLoggerOptions({ level: opts?.logger || HEARTBEAT_DEFAULT_LOGGER }));
    this.interval = opts?.interval || HEARTBEAT_INTERVAL;
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
