import { EventEmitter } from "events";
import { Logger } from "pino";

import { IClient, IExpirer } from "@walletconnect/types";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { calcExpiry, ERROR, formatMessageContext, toMiliseconds } from "@walletconnect/utils";

import {
  EXPIRER_CONTEXT,
  EXPIRER_EVENTS,
  EXPIRER_DEFAULT_TTL,
  HEARTBEAT_EVENTS,
} from "../constants";

interface Expiration {
  id: string;
  expiry: number;
}

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
      return true;
    } catch (e) {
      // ignore
      return false;
    }
  }

  public async set(topic: string, expiry: number): Promise<void> {
    return this.setExpiration(topic, { id: "", expiry });
  }

  public async get(topic: string): Promise<number> {
    return this.getExpiration(topic) as any;
  }

  public async del(topic: string): Promise<void> {
    return this.deleteExpiration(topic, { id: "", expiry: 0 });
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

  private setExpiration(topic: string, expiration: Expiration): void {
    const expiry = expiration.expiry || calcExpiry(EXPIRER_DEFAULT_TTL);
    this.expirations.set(topic, { ...expiration, expiry });
    this.checkExpiry(topic, expiry);
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

  private deleteExpiration(topic: string, expiration: Expiration): void {
    this.expirations.delete(topic);
  }

  private checkExpiry(topic: string, expiry: number): void {
    const msToTimeout = toMiliseconds(expiry) - Date.now();
    if (msToTimeout <= 0) this.expire(topic);
  }

  private expire(topic: string): void {
    const reason = ERROR.EXPIRED.format({ context: formatMessageContext(this.context) });
    const expiration = this.getExpiration(topic);
    this.deleteExpiration(topic, expiration);
    this.events.emit(EXPIRER_EVENTS.del, {
      ...expiration,
      reason,
    } as any); // ExpirerEvents.Deleted
  }

  private checkExpirations(): void {
    this.expirations.forEach(expiration => this.checkExpiry(expiration.id, expiration.expiry));
  }

  private registerEventListeners(): void {
    // TODO: inactive until implemented
    // this.client.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
  }
}
