import { EventEmitter } from "events";
import { Logger } from "pino";

import { IClient, IExpirer, Expiration, ExpirerEvents } from "@walletconnect/types";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { ERROR, formatMessageContext, toMiliseconds } from "@walletconnect/utils";

import { EXPIRER_CONTEXT, EXPIRER_EVENTS, HEARTBEAT_EVENTS } from "../constants";

export class Expirer extends IExpirer {
  public expirations = new Map<string, Expiration>();

  public events = new EventEmitter();

  public name: string = EXPIRER_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.client;
    this.logger = generateChildLogger(logger, this.name);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  public async has(topic: string): Promise<boolean> {
    try {
      const expiration = this.getExpiration(topic);
      return typeof expiration !== "undefined";
    } catch (e) {
      // ignore
      return false;
    }
  }

  public async set(topic: string, expiration: Expiration): Promise<void> {
    this.expirations.set(topic, expiration);
    this.checkExpiry(topic, expiration);
    this.events.emit(EXPIRER_EVENTS.created, {
      topic,
      expiration,
    } as ExpirerEvents.Created);
  }

  public async get(topic: string): Promise<Expiration> {
    return this.getExpiration(topic);
  }

  public async del(topic: string): Promise<void> {
    const expiration = this.getExpiration(topic);
    this.expirations.delete(topic);
    this.events.emit(EXPIRER_EVENTS.deleted, {
      topic,
      expiration,
    } as ExpirerEvents.Deleted);
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
    this.logger.trace(`Initialized`);
    this.registerEventListeners();
  }

  private getExpiration(topic: string): Expiration {
    const expiration = this.expirations.get(topic);
    if (!expiration) {
      const error = ERROR.NO_MATCHING_ID.format({
        context: formatMessageContext(this.context),
        topic,
      });
      // this.logger.error(error.message);
      throw new Error(error.message);
    }
    return expiration;
  }

  private checkExpiry(topic: string, expiration: Expiration): void {
    const { expiry } = expiration;
    const msToTimeout = toMiliseconds(expiry) - Date.now();
    if (msToTimeout <= 0) this.expire(topic, expiration);
  }

  private expire(topic: string, expiration: Expiration): void {
    this.expirations.delete(topic);
    this.events.emit(EXPIRER_EVENTS.expired, {
      topic,
      expiration,
    } as ExpirerEvents.Expired);
  }

  private checkExpirations(): void {
    this.expirations.forEach((expiration, topic) => this.checkExpiry(topic, expiration));
  }

  private registerEventListeners(): void {
    this.client.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
  }
}
