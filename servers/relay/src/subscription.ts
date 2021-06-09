import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";

import { Subscription } from "./types";
import { generateRandomBytes32 } from "./utils";
import { HttpService } from "./http";
import {
  WEBSOCKET_EVENTS,
  SERVER_EVENTS,
  SUBSCRIPTION_CONTEXT,
  SUBSCRIPTION_EVENTS,
} from "./constants";

export class SubscriptionService {
  public subscriptions: Subscription[] = [];

  public context = SUBSCRIPTION_CONTEXT;

  constructor(public server: HttpService, public logger: Logger) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
    this.initialize();
  }

  public set(partial: Omit<Subscription, "id">, legacy?: boolean): string {
    const id = generateRandomBytes32();
    this.logger.debug(`Setting Subscription`);
    this.logger.trace({ type: "method", method: "set", topic: partial.topic });
    const subscription = { ...partial, id, legacy };
    this.subscriptions.push(subscription);
    this.server.events.emit(SUBSCRIPTION_EVENTS.added, subscription);
    return id;
  }

  public get(topic: string, senderSocketId: string, legacy?: boolean): Subscription[] {
    const subscriptions = this.subscriptions.filter(
      sub => sub.topic === topic && sub.socketId !== senderSocketId && !!sub.legacy === !!legacy,
    );
    this.logger.debug(`Getting Subscriptions`);
    this.logger.trace({ type: "method", method: "get", topic, subscriptions });
    return subscriptions;
  }

  public remove(id: string): void {
    this.logger.debug(`Removing Subscription`);
    this.logger.trace({ type: "method", method: "remove", id });
    this.subscriptions = this.subscriptions.filter(sub => sub.id !== id);
    this.server.events.emit(SUBSCRIPTION_EVENTS.removed, id);
  }

  public removeSocket(socketId: string): void {
    this.logger.debug(`Removing Socket Subscriptions`);
    this.logger.trace({ type: "method", method: "removeSocket", socketId });
    this.subscriptions = this.subscriptions.filter(sub => sub.socketId !== socketId);
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
    this.registerEventListeners();
  }

  private clearInactiveSubscriptions() {
    this.subscriptions = this.subscriptions.filter(sub =>
      this.server.ws.isSocketConnected(sub.socketId),
    );
  }

  private registerEventListeners() {
    this.server.on(SERVER_EVENTS.beat, () => this.clearInactiveSubscriptions());
    this.server.events.on(WEBSOCKET_EVENTS.close, (socketId: string) =>
      this.removeSocket(socketId),
    );
  }
}
