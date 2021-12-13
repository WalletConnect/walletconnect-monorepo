import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IRelayer, PublisherTypes, RelayerTypes } from "@walletconnect/types";

import { PUBLISHER_CONTEXT, HEARTBEAT_EVENTS, PUBLISHER_DEFAULT_TTL } from "../constants";
import { getRelayProtocolName, getRelayProtocolApi } from "./relayer";
import { IEvents, JsonRpcPayload, RequestArguments } from "@walletconnect/jsonrpc-types";
import { RelayJsonRpc } from "@walletconnect/relay-api";

export abstract class IPublisher extends IEvents {
  public abstract name: string;

  public abstract readonly context: string;

  constructor(public relayer: IRelayer, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;
}

export class Publisher extends IPublisher {
  public events = new EventEmitter();

  public name: string = PUBLISHER_CONTEXT;

  public queue = new Map<number, PublisherTypes.Params>();

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
    try {
      const ttl = opts?.ttl || PUBLISHER_DEFAULT_TTL;
      const relay = getRelayProtocolName(opts);
      const params = { topic, payload, opts: { ttl, relay } };
      this.queue.set(payload.id, params);
      const message = await this.relayer.encoder.encode(topic, payload);
      await this.rpcPublish(topic, message, ttl, relay);
      await this.onPublish(payload.id, params);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, payload, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
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

  private async initialize() {
    // if needed
  }

  private async rpcPublish(
    topic: string,
    message: string,
    ttl: number,
    relay: RelayerTypes.ProtocolOptions,
  ): Promise<void> {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: api.publish,
      params: {
        topic,
        message,
        ttl,
      },
    };
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "payload", direction: "outgoing", request });
    return this.relayer.provider.request(request);
  }

  private async onPublish(id: number, params: PublisherTypes.Params) {
    // const { topic, payload } = params;
    // await this.relayer.recordPayloadEvent({ topic, payload });
    this.queue.delete(id);
  }

  private checkQueue(): void {
    this.queue.forEach(async params => {
      const {
        topic,
        payload,
        opts: { ttl, relay },
      } = params;
      const message = await this.relayer.encoder.encode(topic, payload);
      await this.rpcPublish(topic, message, ttl, relay);
      await this.onPublish(payload.id, params);
    });
  }

  private registerEventListeners(): void {
    this.relayer.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkQueue();
    });
  }
}
