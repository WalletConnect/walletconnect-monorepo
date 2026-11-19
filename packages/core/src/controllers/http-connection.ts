import { EventEmitter } from "events";
import {
  IJsonRpcConnection,
  isJsonRpcRequest,
  JsonRpcPayload,
  JsonRpcRequest,
  payloadId,
} from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { isReactNative } from "@walletconnect/utils";

import {
  RELAYER_HTTP_EVENT_MESSAGE,
  RELAYER_HTTP_FIRST_LINE_TIMEOUT,
  RELAYER_HTTP_MAX_CONCURRENT_SENDS,
  RELAYER_HTTP_NOT_MEMBER_ERROR,
  RELAYER_HTTP_NOT_MEMBER_RETRIES,
  RELAYER_HTTP_REQUEST_TIMEOUT,
  RELAYER_HTTP_ROUTES,
  RELAYER_HTTP_STALE_TIMEOUT,
} from "../constants/index.js";

export interface HttpConnectionOptions {
  url: string;
  query: Record<string, string | undefined>;
  auth: () => Promise<string>;
  /**
   * Every topic the client is subscribed to. The relay treats a topic missing from this list
   * as left for good, so it must never be partial.
   */
  topics: () => string[];
}

interface LineRequest {
  headers: Record<string, string>;
  body: string;
}

interface LineStream {
  done: Promise<void>;
  abort: () => void;
}

type LineReader = (url: string, request: LineRequest, onLine: (line: string) => void) => LineStream;

interface Waiter {
  topics: string[];
  resolve: () => void;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public reason?: string,
  ) {
    super(code);
  }
}

/**
 * the relay won't accept this client as it is, so reconnecting can't help
 */
export function isRefusedError(error: unknown) {
  return [400, 401, 403].includes((error as HttpError)?.status);
}

export function toHttpUrl(url: string) {
  return url.replace(/^ws(s?):\/\//i, "http$1://");
}

function toHttpError(status: number, body: string) {
  const parsed = safeJsonParse(body);
  const { error, reason } = typeof parsed === "object" && parsed !== null ? parsed : ({} as any);
  return new HttpError(status, typeof error === "string" ? error : `HTTP ${status}`, reason);
}

function splitLines(buffer: string, onLine: (line: string) => void) {
  const lines = buffer.split("\n");
  const rest = lines.pop() as string;
  lines.forEach((line) => line.trim() && onLine(line));
  return rest;
}

const fetchLines: LineReader = (url, request, onLine) => {
  const controller = new AbortController();
  const read = async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: controller.signal,
    });
    if (response.status !== 200) {
      throw toHttpError(response.status, await response.text());
    }
    const reader = response.body?.getReader?.();
    if (!reader) {
      splitLines((await response.text()) + "\n", onLine);
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = splitLines(buffer + decoder.decode(value, { stream: true }), onLine);
    }
    splitLines(buffer + "\n", onLine);
  };
  return { done: read(), abort: () => controller.abort() };
};

// React Native's fetch can't read a response as it arrives; XMLHttpRequest progress events can.
const xhrLines: LineReader = (url, request, onLine) => {
  const xhr = new XMLHttpRequest();
  let seen = 0;
  let buffer = "";
  const flush = () => {
    if (xhr.status !== 200) return;
    const text = xhr.responseText;
    buffer = splitLines(buffer + text.slice(seen), onLine);
    seen = text.length;
  };
  const done = new Promise<void>((resolve, reject) => {
    xhr.onprogress = flush;
    xhr.onload = () => {
      if (xhr.status !== 200) return reject(toHttpError(xhr.status, xhr.responseText));
      flush();
      splitLines(buffer + "\n", onLine);
      resolve();
    };
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Network request timed out"));
    xhr.onabort = () => reject(new Error("Network request aborted"));
  });
  xhr.open("POST", url);
  Object.entries(request.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
  xhr.send(request.body);
  return { done, abort: () => xhr.abort() };
};

export class HttpConnection implements IJsonRpcConnection {
  public events = new EventEmitter();
  public connected = false;
  public connecting = false;

  private baseUrl: string;
  private queryString: string;
  private active = false;
  private token: string | undefined;
  private cursor: unknown;
  private stream: LineStream | undefined;
  private restarting = false;
  private restartScheduled = false;
  private staleTimeout: ReturnType<typeof setTimeout> | undefined;
  private staleAfter = RELAYER_HTTP_STALE_TIMEOUT;
  // topics of the last list the relay accepted a poll with
  private listed = new Set<string>();
  // the last list a completed poll carried; until a poll completes the list is sent again
  private synced: string | undefined;
  // topics the open poll was sent with
  private polled = new Set<string>();
  // topics joined only to publish on them
  private transient = new Set<string>();
  private waiters: Waiter[] = [];
  private sending = 0;
  private sendQueue: (() => void)[] = [];
  private readLines: LineReader = isReactNative() ? xhrLines : fetchLines;

  constructor(private opts: HttpConnectionOptions) {
    const [base, existingQuery = ""] = toHttpUrl(opts.url).split("?");
    this.baseUrl = base.replace(/\/+$/, "");
    const query = Object.entries(opts.query)
      .filter(([, value]) => typeof value !== "undefined")
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`);
    this.queryString = [existingQuery, ...query].filter(Boolean).join("&");
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async open() {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    this.active = true;
    try {
      await new Promise<void>((resolve, reject) => {
        this.events.once("open", resolve);
        this.run().catch((error) => {
          this.events.off("open", resolve);
          reject(error);
        });
      });
    } finally {
      this.connecting = false;
    }
  }

  public async close() {
    if (!this.active) return;
    this.active = false;
    this.stream?.abort();
    this.onClose();
  }

  public async send(payload: JsonRpcPayload) {
    // a response acknowledges an inbound message; over HTTP the poll cursor does that
    if (!isJsonRpcRequest(payload)) return;
    try {
      const result = await this.handle(payload);
      this.events.emit("payload", { id: payload.id, jsonrpc: "2.0", result });
    } catch (e) {
      const error = e as HttpError;
      this.events.emit("payload", {
        id: payload.id,
        jsonrpc: "2.0",
        error: {
          code: error.status || -32000,
          message: error.code || error.message,
          data: error.reason,
        },
      });
    }
  }

  // ---------- Requests ----------------------------------------------- //

  private async handle(request: JsonRpcRequest) {
    const { method, params } = request;
    switch (method) {
      case "irn_publish": {
        const { topic, ...body } = params;
        await this.publish(topic, body);
        return true;
      }
      case "wc_proposeSession":
        await this.post(RELAYER_HTTP_ROUTES.sessionProposals, params);
        return true;
      case "wc_approveSession":
        await this.post(RELAYER_HTTP_ROUTES.sessionApprovals, params);
        return true;
      case "irn_subscribe":
        await this.toBeListed([params.topic]);
        return params.topic;
      case "irn_batchSubscribe":
        await this.toBeListed(params.topics);
        return params.topics;
      // the topic is already gone from `opts.topics()`, so the next poll leaves it
      case "irn_unsubscribe":
      case "irn_batchUnsubscribe":
        return true;
      case "irn_batchFetchMessages":
        return { messages: [], hasMore: false };
      default:
        throw new HttpError(-32601, `Method not found: ${method}`);
    }
  }

  private async publish(topic: string, body: Record<string, unknown>) {
    const path = RELAYER_HTTP_ROUTES.messages.replace("{topic}", topic);
    // the relay only accepts a publish from a client that has joined the topic
    const isTransient = !this.topics().includes(topic);
    if (isTransient) this.transient.add(topic);
    try {
      await this.toBeListed([topic]);
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.post(path, body);
        } catch (e) {
          // a poll lists the topic before the relay has finished joining it
          const isJoining = (e as HttpError).code === RELAYER_HTTP_NOT_MEMBER_ERROR;
          if (!isJoining || attempt >= RELAYER_HTTP_NOT_MEMBER_RETRIES) throw e;
          await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        }
      }
    } finally {
      if (isTransient) this.transient.delete(topic);
    }
  }

  // the relay fails publishes that arrive in large bursts, so only a few are in flight at once
  private async post(path: string, body: unknown) {
    if (this.sending >= RELAYER_HTTP_MAX_CONCURRENT_SENDS) {
      await new Promise<void>((resolve) => this.sendQueue.push(resolve));
    } else {
      this.sending++;
    }
    try {
      await this.request(path, body);
    } finally {
      const next = this.sendQueue.shift();
      if (next) next();
      else this.sending--;
    }
  }

  private async request(path: string, body: unknown, isRetry = false): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RELAYER_HTTP_REQUEST_TIMEOUT);
    let response: Response;
    try {
      response = await fetch(this.url(path), {
        method: "POST",
        headers: await this.headers(),
        body: safeJsonStringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) return;
    if (response.status === 401 && !isRetry) {
      this.token = undefined;
      return this.request(path, body, true);
    }
    throw toHttpError(response.status, await response.text());
  }

  private url(path: string) {
    return `${this.baseUrl}${path}?${this.queryString}`;
  }

  private async headers() {
    if (!this.token) this.token = await this.opts.auth();
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }

  // ---------- Topics ----------------------------------------------- //

  private topics() {
    return Array.from(new Set([...this.opts.topics(), ...this.transient])).sort();
  }

  private toBeListed(topics: string[]) {
    if (topics.every((topic) => this.listed.has(topic))) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.waiters.push({ topics, resolve });
      this.restart();
    });
  }

  // a topic list only takes effect on a new poll, so the open one is replaced
  private restart() {
    if (this.restartScheduled) return;
    this.restartScheduled = true;
    setTimeout(() => {
      this.restartScheduled = false;
      if (!this.stream) return;
      // the open poll may have started after the topics were added, and already carry them
      if (this.waiters.every(({ topics }) => topics.every((topic) => this.polled.has(topic))))
        return;
      this.restarting = true;
      this.stream.abort();
    }, 0);
  }

  // ---------- Poll ----------------------------------------------- //

  private async run() {
    let failures = 0;
    let hasRenewedToken = false;
    while (this.active) {
      try {
        await this.poll();
        failures = 0;
        hasRenewedToken = false;
      } catch (error) {
        if (!this.active) return;
        if (this.restarting) continue;
        if ((error as HttpError).status === 401 && !hasRenewedToken) {
          hasRenewedToken = true;
          this.token = undefined;
          continue;
        }
        failures++;
        const wasOpen = this.connected;
        // one immediate retry covers a dropped request; after that the relayer reconnects
        if (isRefusedError(error) || !wasOpen || failures > 1) {
          this.active = false;
          this.onClose();
          if (isRefusedError(error) && wasOpen) this.events.emit("error", error);
          throw error;
        }
      }
    }
  }

  private async poll() {
    const headers = await this.headers();
    this.restarting = false;
    const topics = this.topics();
    const list = topics.join(",");
    // an empty list leaves every topic, so it's only sent after a non-empty one
    const sendTopics = list !== this.synced && (topics.length > 0 || this.synced !== undefined);
    this.polled = sendTopics ? new Set(topics) : this.listed;
    const body = safeJsonStringify({
      n: Date.now(),
      cursor: this.cursor,
      topics: sendTopics ? topics : undefined,
    });

    let completed = false;
    let failure: Error | undefined;
    const onLine = (line: string) => {
      this.resetStaleTimeout(this.staleAfter);
      const parsed = safeJsonParse(line);
      if (typeof parsed !== "object" || parsed === null) return;
      if (parsed.config) {
        this.staleAfter = parsed.config.foreground_stale_ms || this.staleAfter;
        if (sendTopics) this.listed = new Set(topics);
        this.onOpen();
      } else if (Array.isArray(parsed.events)) {
        completed = true;
        if (sendTopics) this.synced = list;
        try {
          this.onEvents(parsed.events);
          if (typeof parsed.cursor !== "undefined") this.cursor = parsed.cursor;
        } catch (e) {
          failure = e as Error;
        }
      }
    };

    this.stream = this.readLines(this.url(RELAYER_HTTP_ROUTES.events), { headers, body }, onLine);
    this.resetStaleTimeout(RELAYER_HTTP_FIRST_LINE_TIMEOUT);
    try {
      await this.stream.done;
    } finally {
      clearTimeout(this.staleTimeout);
      this.stream = undefined;
    }
    if (failure) throw failure;
    if (!completed) throw new Error("The relay ended the poll without events");
  }

  private resetStaleTimeout(ms: number) {
    clearTimeout(this.staleTimeout);
    this.staleTimeout = setTimeout(() => this.stream?.abort(), ms);
  }

  private onOpen() {
    if (!this.connected) {
      this.connected = true;
      this.events.emit("open");
    }
    this.waiters = this.waiters.filter((waiter) => {
      if (!waiter.topics.every((topic) => this.listed.has(topic))) return true;
      waiter.resolve();
      return false;
    });
  }

  private onClose() {
    clearTimeout(this.staleTimeout);
    const wasOpen = this.connected;
    this.connected = false;
    this.listed.clear();
    this.synced = undefined;
    if (wasOpen) this.events.emit("close");
  }

  private onEvents(events: any[]) {
    events.forEach((event) => {
      if (event?.type !== RELAYER_HTTP_EVENT_MESSAGE) return;
      const { topic, message, publishedAt, tag, attestation } = event;
      this.events.emit("payload", {
        id: payloadId(),
        jsonrpc: "2.0",
        method: "irn_subscription",
        params: {
          id: topic,
          // the relay reports seconds; the relayer works in milliseconds
          data: { topic, message, publishedAt: publishedAt * 1000, tag, attestation },
        },
      });
    });
  }
}
