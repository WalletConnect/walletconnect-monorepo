import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Core } from "../src/core.js";
import { SUBSCRIBER_EVENTS, RELAYER_EVENTS } from "../src/constants/index.js";

vi.mock("@walletconnect/utils", async (original) => ({
  ...(await original<object>()),
  isOnline: async () => true,
  subscribeToNetworkChange: () => () => undefined,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

async function fixture() {
  const values = new Map<string, unknown>();
  const storage = {
    getKeys: async () => [...values.keys()],
    getEntries: async () => [...values.entries()],
    getItem: async (key: string) => values.get(key),
    setItem: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  const core = new Core({ storage, logger: "silent", telemetryEnabled: false });
  await core.start();
  Object.defineProperty(core.relayer, "connected", { configurable: true, get: () => true });
  const response = deferred<unknown>();
  const provider = Object.assign(new EventEmitter(), {
    connection: {},
    request: vi.fn(() => response.promise),
    dispose: async () => undefined,
  });
  core.relayer.provider = provider as any;
  return { core, storage, provider, response };
}

beforeEach(() => {
  process.env.DISABLE_GLOBAL_CORE = "true";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("request-owner cancellation on a shared Core", () => {
  it("cancels subscription waiters and refuses a late ACK's local state", async () => {
    const { core, storage, provider, response } = await fixture();
    const owner = new AbortController();
    const subscriber = core.relayer.subscriber;
    const beforeListeners = subscriber.events.listenerCount(SUBSCRIBER_EVENTS.created);
    const operation = core.relayer.subscribe("topic", undefined, owner.signal);
    const rejected = expect(operation).rejects.toThrow("owner retired");
    await vi.waitFor(() => expect(provider.request).toHaveBeenCalled());
    owner.abort(new Error("owner retired"));
    await rejected;
    expect(core.signal.aborted).toBe(false);
    expect(subscriber.pending.has("topic")).toBe(false);
    expect(subscriber.events.listenerCount(SUBSCRIBER_EVENTS.created)).toBe(beforeListeners);
    const writes = storage.setItem.mock.calls.length;
    response.resolve("late-subscription-id");
    await tick();
    expect(subscriber.topics).not.toContain("topic");
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
    await core.dispose();
  });

  it("cancels an unanswered unsubscribe and preserves its already-admitted local removal", async () => {
    const { core, storage, provider, response } = await fixture();
    const owner = new AbortController();
    const subscriber = core.relayer.subscriber;
    subscriber.subscriptions.set("id", { id: "id", topic: "topic", relay: { protocol: "irn" } });
    subscriber.topicMap.set("topic", "id");
    const operation = core.relayer.unsubscribe(
      "topic",
      { id: "id", relay: { protocol: "irn" } },
      owner.signal,
    );
    const rejected = expect(operation).rejects.toThrow("owner retired");
    await vi.waitFor(() => expect(provider.request).toHaveBeenCalled());
    expect(subscriber.topics).not.toContain("topic");
    owner.abort(new Error("owner retired"));
    await rejected;
    const writes = storage.setItem.mock.calls.length;
    response.resolve(true);
    await tick();
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it("drains an already-started subscription write before settling owner cancellation", async () => {
    const { core, storage, provider } = await fixture();
    provider.request.mockResolvedValue("id");
    const held = deferred<void>();
    const writeStarted = deferred<void>();
    const originalWrite = storage.setItem.getMockImplementation()!;
    storage.setItem.mockImplementation(async (key, value) => {
      if (key.endsWith("//subscription")) {
        writeStarted.resolve();
        await held.promise;
      }
      await originalWrite(key, value);
    });
    const owner = new AbortController();
    const operation = core.relayer.subscribe("topic", undefined, owner.signal);
    const rejected = expect(operation).rejects.toThrow("owner retired");
    let settled = false;
    operation.catch(() => {
      settled = true;
    });
    await writeStarted.promise;
    owner.abort(new Error("owner retired"));
    await tick();
    expect(settled).toBe(false);
    held.resolve();
    await rejected;
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it("cancels publish retries and suppresses outgoing persistence after a late ACK", async () => {
    const { core, storage, provider, response } = await fixture();
    const owner = new AbortController();
    const baseline = core.relayer.events.listenerCount(RELAYER_EVENTS.publish);
    const operation = core.relayer.publish("topic", "message", undefined, owner.signal);
    const rejected = expect(operation).rejects.toThrow("owner retired");
    await vi.waitFor(() => expect(provider.request).toHaveBeenCalled());
    owner.abort(new Error("owner retired"));
    await rejected;
    expect(core.relayer.events.listenerCount(RELAYER_EVENTS.publish)).toBe(baseline);
    expect((core.relayer.publisher as any).queue.size).toBe(0);
    const writes = storage.setItem.mock.calls.length;
    response.resolve(true);
    await tick();
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it.each(["subscribe", "publish"] as const)(
    "Core disposal cancels an unanswered %s with an independent owner signal",
    async (method) => {
      const { core, provider } = await fixture();
      const owner = new AbortController();
      const operation =
        method === "subscribe"
          ? core.relayer.subscribe("topic", undefined, owner.signal)
          : core.relayer.publish("topic", "message", undefined, owner.signal);
      const rejected = expect(operation).rejects.toThrow("disposed");
      await vi.waitFor(() => expect(provider.request).toHaveBeenCalled());
      await core.dispose();
      await rejected;
      expect(owner.signal.aborted).toBe(false);
    },
  );

  it.each([false, true])(
    "link-mode delayed wire request remains owner-bound after subscription returns (abort=%s)",
    async (abort) => {
      const { core, provider } = await fixture();
      provider.request.mockResolvedValue(true);
      const owner = new AbortController();
      vi.useFakeTimers();
      try {
        await core.relayer.subscribe("topic", { transportType: "link_mode" }, owner.signal);
        expect(provider.request).not.toHaveBeenCalled();
        if (abort) owner.abort(new Error("owner retired"));
        await vi.advanceTimersByTimeAsync(1000);
        expect(provider.request).toHaveBeenCalledTimes(abort ? 0 : 1);
      } finally {
        vi.useRealTimers();
        await core.dispose();
      }
    },
  );
});
