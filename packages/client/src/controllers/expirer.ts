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

  private cached: Expiration[] = [];

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.client;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get length(): number {
    return this.expirations.size;
  }

  get topics(): string[] {
    return Array.from(this.expirations.keys());
  }

  get values(): Expiration[] {
    return Array.from(this.expirations.values());
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

  private async persist() {
    await this.client.storage.setSequenceStore(this.context, this.values);
    this.events.emit(EXPIRER_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.client.storage.getSequenceStore(this.context);
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.expirations.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: formatMessageContext(this.context),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(
        `Successfully Restored expirations for ${formatMessageContext(this.context)}`,
      );
      this.logger.trace({ type: "method", method: "restore", expirations: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore expirations for ${formatMessageContext(this.context)}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
    this.reset();
    this.onInit();
  }

  private reset() {
    this.cached.forEach(expiration => this.expirations.set(expiration.topic, expiration));
  }

  private onInit() {
    this.cached = [];
    this.events.emit(EXPIRER_EVENTS.init);
  }

  private async isInitialized(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once(EXPIRER_EVENTS.init, () => resolve());
    });
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
    this.events.on(EXPIRER_EVENTS.created, (createdEvent: ExpirerEvents.Created) => {
      const eventName = EXPIRER_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.expired, (expiredEvent: ExpirerEvents.Expired) => {
      const eventName = EXPIRER_EVENTS.expired;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: expiredEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.deleted, (deletedEvent: ExpirerEvents.Deleted) => {
      const eventName = EXPIRER_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist();
    });
  }
}
