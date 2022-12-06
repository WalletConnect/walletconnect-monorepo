/* eslint-disable no-console */
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { IPublisher, IRelayer, PublisherTypes, RelayerTypes } from "@walletconnect/types";
import {
  getRelayProtocolApi,
  getRelayProtocolName,
  hashMessage,
  isUndefined,
} from "@walletconnect/utils";
import { EventEmitter } from "events";
import { PUBLISHER_CONTEXT, PUBLISHER_DEFAULT_TTL, RELAYER_PROVIDER_EVENTS } from "../constants";

export class Publisher extends IPublisher {
  public events = new EventEmitter();
  public name = PUBLISHER_CONTEXT;
  public queue = new Map<string, PublisherTypes.Params>();
  private publishRetries = 0;

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  public publish: IPublisher["publish"] = async (topic, message, opts) => {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    try {
      const ttl = opts?.ttl || PUBLISHER_DEFAULT_TTL;
      const relay = getRelayProtocolName(opts);
      const prompt = opts?.prompt || false;
      const tag = opts?.tag || 0;
      const params = { topic, message, opts: { ttl, relay, prompt, tag } };
      const hash = hashMessage(message);
      this.queue.set(hash, params);
      const clientId = await this.relayer.core.crypto.getClientId();
      // const payload = await this.relayer.core.crypto.decode(topic, message);
      // const timeout = setTimeout(() => {
      //   // eslint-disable-next-line no-console
      //   console.log(
      //     `publishing request timeout 15s ${clientId} - ${topic} - ${this.relayer.connected} - ${process.env.TEST_RELAY_URL} - ${this.relayer.core.name} - ${payload.id}`,
      //   );
      // }, 5_000);
      // // const payload = await this.relayer.core.crypto.decode(topic, message);
      // console.log("publishing payload", payload.id, clientId, topic, this.relayer.core.name);
      // await this.rpcPublish(topic, message, ttl, relay, prompt, tag);
      // console.log("published...", payload.id, clientId, topic, this.relayer.core.name);
      // clearTimeout(timeout);

      const publish = new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          this.publishRetries++;
          reject();
        }, 5_000);
        const res = await this.rpcPublish(topic, message, ttl, relay, prompt, tag);
        clearTimeout(timeout);
        resolve(res);
      });

      for (let i = 0; i < 10; i++) {
        try {
          // console.log(
          //   "subscribing..",
          //   i,
          //   this.publishRetries,
          //   clientId,
          //   this.relayer.core.name,
          //   topic,
          //   Date.now(),
          // );
          // console.log("publishing payload", payload.id, clientId, topic, this.relayer.core.name);
          await publish;
          console.log("published...", clientId, topic, this.relayer.core.name);
          break;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log(
            `subscribe request timeout 5s - ${this.publishRetries} - ${clientId} - ${topic} - ${this.relayer.connected} - ${process.env.TEST_RELAY_URL} - ${this.relayer.core.name}`,
          );

          this.relayer.provider.events.emit(RELAYER_PROVIDER_EVENTS.disconnect);
          // await this.relayer.transportClose();
          // // some delay to allow the transport to close
          // await new Promise((resolve) => setTimeout(resolve, 300 * i));
          // await this.relayer.transportOpen();
        }
      }
      if (this.publishRetries > 0) this.publishRetries--;
      this.onPublish(hash, params);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
  };

  public on: IPublisher["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: IPublisher["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: IPublisher["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: IPublisher["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private rpcPublish(
    topic: string,
    message: string,
    ttl: number,
    relay: RelayerTypes.ProtocolOptions,
    prompt?: boolean,
    tag?: number,
  ) {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: api.publish,
      params: {
        topic,
        message,
        ttl,
        prompt,
        tag,
      },
    };
    if (isUndefined(request.params?.prompt)) delete request.params?.prompt;
    if (isUndefined(request.params?.tag)) delete request.params?.tag;
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "message", direction: "outgoing", request });
    return this.relayer.provider.request(request);
  }

  private onPublish(hash: string, _params: PublisherTypes.Params) {
    this.queue.delete(hash);
  }

  private checkQueue() {
    this.queue.forEach(async (params) => {
      const {
        topic,
        message,
        opts: { ttl, relay, prompt, tag },
      } = params;
      const hash = hashMessage(message);
      await this.rpcPublish(topic, message, ttl, relay, prompt, tag);
      this.onPublish(hash, params);
    });
  }

  private registerEventListeners() {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkQueue();
    });
  }
}
