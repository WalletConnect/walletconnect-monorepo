import { EventEmitter } from "events";
import {
  RelayPublishOptions,
  RelaySubscribeOptions,
  IRelay,
  RelayPublishParams,
  RelaySubscribeParams,
  RelaySubscriptionParams,
  RelayUnsubscribeParams,
} from "@walletconnect/types";
import { encrypt, decrypt } from "@walletconnect/utils";
import {
  IJsonRpcProvider,
  formatJsonRpcRequest,
  JsonRpcPayload,
  JsonRpcRequest,
} from "rpc-json-utils";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

import { RELAY_DEFAULT_PROTOCOL, RELAY_DEFAULT_TTL } from "../constants";
import { WSProvider } from "../providers";

export class Relay extends IRelay {
  public events = new EventEmitter();

  public provider: IJsonRpcProvider;

  constructor(provider?: string | IJsonRpcProvider) {
    super();
    this.provider = this.setProvider(provider);
    this.provider.on("request", this.onRequest);
  }

  public async init(): Promise<void> {
    await this.provider.connect();
  }

  public async publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayPublishOptions,
  ): Promise<void> {
    const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
    const msg = safeJsonStringify(payload);
    const message = opts?.encrypt
      ? await encrypt({
          ...opts.encrypt,
          message: msg,
        })
      : msg;
    const request = formatJsonRpcRequest<RelayPublishParams>(`${protocol}_publish`, {
      topic,
      message,
      ttl: RELAY_DEFAULT_TTL,
    } as RelayPublishParams);
    this.provider.request(request);
  }

  public async subscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelaySubscribeOptions,
  ): Promise<void> {
    const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
    const request = formatJsonRpcRequest<RelaySubscribeParams>(`${protocol}_subscribe`, {
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
  }

  public async unsubscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelaySubscribeOptions,
  ): Promise<void> {
    const protocol = opts?.relay.protocol || RELAY_DEFAULT_PROTOCOL;
    const request = formatJsonRpcRequest<RelayUnsubscribeParams>(`${protocol}_unsubscribe`, {
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
      const params = request.params as RelaySubscriptionParams;
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
