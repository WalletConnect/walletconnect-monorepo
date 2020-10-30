import { EventEmitter } from "events";
import { Logger } from "pino";
import { RelayTypes, IRelay } from "@walletconnect/types";
import {
  encrypt,
  decrypt,
  getRelayProtocolJsonRpc,
  formatLoggerContext,
} from "@walletconnect/utils";
import {
  IJsonRpcProvider,
  formatJsonRpcRequest,
  JsonRpcPayload,
  JsonRpcRequest,
} from "rpc-json-utils";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import { RELAY_CONTEXT, RELAY_DEFAULT_PROTOCOL, RELAY_DEFAULT_TTL } from "../constants";
import { WSProvider } from "../providers";

export class Relay extends IRelay {
  public events = new EventEmitter();

  public provider: IJsonRpcProvider;

  public context: string = RELAY_CONTEXT;

  constructor(public logger: Logger, provider?: string | IJsonRpcProvider) {
    super(logger);
    this.logger = logger.child({
      context: formatLoggerContext(logger, this.context),
    });

    this.provider = this.setProvider(provider);
    this.provider.on("request", this.onRequest);
  }

  public async init(): Promise<void> {
    this.logger.trace({ type: "init" });
    await this.provider.connect();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayTypes.PublishOptions,
  ): Promise<void> {
    this.logger.info(`Publishing Payload`);
    this.logger.debug({ type: "method", method: "publish", params: { topic, payload, opts } });
    try {
      const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
      const msg = safeJsonStringify(payload);
      const message = opts?.encrypt
        ? await encrypt({
            ...opts.encrypt,
            message: msg,
          })
        : msg;
      const jsonRpc = getRelayProtocolJsonRpc(protocol);
      const request = formatJsonRpcRequest<RelayTypes.PublishParams>(jsonRpc.publish, {
        topic,
        message,
        ttl: RELAY_DEFAULT_TTL,
      });
      await this.provider.request(request);
      this.logger.info(`Successfully Published Payload`);
      this.logger.debug({ type: "method", method: "publish", request });
    } catch (error) {
      this.logger.info(`Failed to publish Payload`);
      this.logger.error(error);
      throw error;
    }
  }

  public async subscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelayTypes.SubscribeOptions,
  ): Promise<void> {
    this.logger.info(`Subscribing Topic`);
    this.logger.debug({ type: "method", method: "subscribe", params: { topic, opts } });
    try {
      const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
      const jsonRpc = getRelayProtocolJsonRpc(protocol);
      const request = formatJsonRpcRequest<RelayTypes.SubscribeParams>(jsonRpc.subscribe, {
        topic,
        ttl: RELAY_DEFAULT_TTL,
      });
      const id = await this.provider.request(request);
      this.events.on(id, async (message: string) => {
        const payload = safeJsonParse(
          opts?.decrypt
            ? await decrypt({
                ...opts.decrypt,
                encrypted: message,
              })
            : message,
        );
        listener(payload);
      });
      this.logger.info(`Successfully subscribed Topic`);
      this.logger.debug({ type: "method", method: "subscribe", request });
    } catch (error) {
      this.logger.info(`Failed to subscribe Topic`);
      this.logger.error(error);
      throw error;
    }
  }

  public async unsubscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelayTypes.SubscribeOptions,
  ): Promise<void> {
    this.logger.info(`Unsubscribing Topic`);
    this.logger.debug({ type: "method", method: "unsubscribe", params: { topic, opts } });
    try {
      const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
      const jsonRpc = getRelayProtocolJsonRpc(protocol);
      const request = formatJsonRpcRequest<RelayTypes.UnsubscribeParams>(jsonRpc.unsubscribe, {
        topic,
      });
      const id = await this.provider.request(request);
      this.events.off(id, async (message: string) => {
        const payload = safeJsonParse(
          opts?.decrypt
            ? await decrypt({
                ...opts.decrypt,
                encrypted: message,
              })
            : message,
        );
        listener(payload);
      });
      this.logger.info(`Successfully unsubscribed Topic`);
      this.logger.debug({ type: "method", method: "unsubscribe", request });
    } catch (error) {
      this.logger.info(`Failed to unsubscribe Topic`);
      this.logger.error(error);
      throw error;
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

  // ---------- Private ----------------------------------------------- //

  private onRequest(request: JsonRpcRequest) {
    if (request.method.endsWith("_subscription")) {
      const params = request.params as RelayTypes.SubscriptionParams;
      this.events.emit(params.topic, params.message);
    } else {
      this.events.emit("request", request);
    }
  }

  private setProvider(provider?: string | IJsonRpcProvider): IJsonRpcProvider {
    const rpcUrl = typeof provider === "string" ? provider : "wss://relay.walletconnect.org";
    return typeof provider !== "string" && typeof provider !== "undefined"
      ? provider
      : new WSProvider(rpcUrl);
  }
}
