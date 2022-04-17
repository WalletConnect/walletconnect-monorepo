import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { toMiliseconds } from "@walletconnect/time";
import { ExpirerTypes, IClient, IExpirer } from "@walletconnect/types";
import { ERROR, formatMessageContext, formatStorageKeyName } from "@walletconnect/utils";
import { EventEmitter } from "events";
import { Logger } from "pino";
import { EXPIRER_CONTEXT, EXPIRER_EVENTS, EXPIRER_STORAGE_VERSION } from "../constants";

export class Expirer extends IExpirer {
  public expirations = new Map<string, ExpirerTypes.Expiration>();

  public events = new EventEmitter();

  public name = EXPIRER_CONTEXT;

  public version = EXPIRER_STORAGE_VERSION;

  private cached: ExpirerTypes.Expiration[] = [];

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.client;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.client.storagePrefix + this.version + "//" + formatStorageKeyName(this.context);
  }

  get length(): number {
    return this.expirations.size;
  }

  get topics(): string[] {
    return Array.from(this.expirations.keys());
  }

  get values(): ExpirerTypes.Expiration[] {
    return Array.from(this.expirations.values());
  }

  public init: IExpirer["init"] = async () => {
    this.logger.trace(`Initialized`);
    await this.initialize();
  };

  public has: IExpirer["has"] = async topic => {
    try {
      const expiration = this.getExpiration(topic);
      return typeof expiration !== "undefined";
    } catch (e) {
      // ignore
      return false;
    }
  };

  public set: IExpirer["set"] = async (topic, expiration) => {
    await this.isInitialized();
    this.expirations.set(topic, expiration);
    this.checkExpiry(topic, expiration);
    this.events.emit(EXPIRER_EVENTS.created, {
      topic,
      expiration,
    } as ExpirerTypes.Created);
  };

  public get: IExpirer["get"] = async topic => {
    await this.isInitialized();
    return this.getExpiration(topic);
  };

  public del: IExpirer["del"] = async topic => {
    await this.isInitialized();
    const expiration = this.getExpiration(topic);
    this.expirations.delete(topic);
    this.events.emit(EXPIRER_EVENTS.deleted, {
      topic,
      expiration,
    } as ExpirerTypes.Deleted);
  };

  public on: IExpirer["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: IExpirer["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: IExpirer["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: IExpirer["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private async setExpirations(expirations: ExpirerTypes.Expiration[]): Promise<void> {
    await this.client.storage.setItem<ExpirerTypes.Expiration[]>(this.storageKey, expirations);
  }

  private async getExpirations(): Promise<ExpirerTypes.Expiration[] | undefined> {
    const expirations = await this.client.storage.getItem<ExpirerTypes.Expiration[]>(
      this.storageKey,
    );
    return expirations;
  }

  private async persist() {
    await this.setExpirations(this.values);
    this.events.emit(EXPIRER_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.getExpirations();
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

  private getExpiration(topic: string): ExpirerTypes.Expiration {
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

  private checkExpiry(topic: string, expiration: ExpirerTypes.Expiration): void {
    const { expiry } = expiration;
    const msToTimeout = toMiliseconds(expiry) - Date.now();
    if (msToTimeout <= 0) this.expire(topic, expiration);
  }

  private expire(topic: string, expiration: ExpirerTypes.Expiration): void {
    this.expirations.delete(topic);
    this.events.emit(EXPIRER_EVENTS.expired, {
      topic,
      expiration,
    } as ExpirerTypes.Expired);
  }

  private checkExpirations(): void {
    this.expirations.forEach((expiration, topic) => this.checkExpiry(topic, expiration));
  }

  private registerEventListeners(): void {
    this.client.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
    this.events.on(EXPIRER_EVENTS.created, (createdEvent: ExpirerTypes.Created) => {
      const eventName = EXPIRER_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.expired, (expiredEvent: ExpirerTypes.Expired) => {
      const eventName = EXPIRER_EVENTS.expired;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: expiredEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.deleted, (deletedEvent: ExpirerTypes.Deleted) => {
      const eventName = EXPIRER_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist();
    });
  }
}
