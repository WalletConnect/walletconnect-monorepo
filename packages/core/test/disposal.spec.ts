import { beforeEach, describe, expect, it, vi } from "vitest";
import { Core } from "../src/core.js";

const network = vi.hoisted(() => ({
  online: vi.fn(async () => true),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  callback: undefined as undefined | ((connected: boolean) => void),
}));
const logging = vi.hoisted(() => ({
  enabled: false,
  download: vi.fn(),
  blob: vi.fn(),
}));
vi.mock("@walletconnect/logger", async (original) => {
  const actual = await original<typeof import("@walletconnect/logger")>();
  return {
    ...actual,
    generatePlatformLogger: (...args: Parameters<typeof actual.generatePlatformLogger>) => {
      const generated = actual.generatePlatformLogger(...args);
      return logging.enabled
        ? {
            ...generated,
            chunkLoggerController: {
              downloadLogsBlobInBrowser: logging.download,
              logsToBlob: logging.blob,
            },
          }
        : generated;
    },
  };
});
vi.mock("@walletconnect/utils", async (original) => ({
  ...(await original<object>()),
  isOnline: network.online,
  subscribeToNetworkChange: network.subscribe,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const values = new Map<string, unknown>();
  const storage = {
    getKeys: async () => [...values.keys()],
    getEntries: async () => [...values.entries()],
    getItem: vi.fn(async (key: string) => values.get(key)),
    setItem: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  const core = new Core({ storage, logger: "silent", telemetryEnabled: false });
  return { core, storage };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  logging.enabled = false;
  logging.download.mockReset();
  logging.blob.mockReset();
  process.env.DISABLE_GLOBAL_CORE = "true";
  network.online.mockReset().mockResolvedValue(true);
  network.unsubscribe.mockReset();
  network.callback = undefined;
  network.subscribe.mockReset().mockImplementation((callback) => {
    network.callback = callback;
    return network.unsubscribe;
  });
});

describe("terminal Core disposal", () => {
  it("cancels log exports waiting for the client identity before disposal", async () => {
    const browser: { downloadLogsBlobInBrowser?: () => Promise<void> } = {};
    vi.stubGlobal("window", browser);
    logging.enabled = true;
    const { core } = fixture();
    const identity = deferred<string>();
    vi.spyOn(core.crypto, "getClientId").mockReturnValue(identity.promise);
    const download = expect(browser.downloadLogsBlobInBrowser!()).rejects.toThrow("disposed");
    const blob = expect(core.getLogsBlob()).rejects.toThrow("disposed");
    await tick();
    const closing = core.dispose();
    identity.resolve("retired-client");
    await Promise.all([closing, download, blob]);
    expect(logging.download).not.toHaveBeenCalled();
    expect(logging.blob).not.toHaveBeenCalled();
  });

  it("retries a failed initialization while still joining concurrent starts", async () => {
    const { core } = fixture();
    const initialize = vi.spyOn(core.crypto, "init");
    initialize.mockRejectedValueOnce(new Error("Storage temporarily unavailable"));
    await expect(core.start()).rejects.toThrow("Storage temporarily unavailable");
    await Promise.all([core.start(), core.start()]);
    expect(initialize).toHaveBeenCalledTimes(2);
    await core.dispose();
    await expect(core.start()).rejects.toThrow("disposed");
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("retires only its own browser log callback", async () => {
    const browser: { downloadLogsBlobInBrowser?: () => Promise<void> } = {};
    vi.stubGlobal("window", browser);
    logging.enabled = true;
    const first = fixture().core;
    const firstDownload = browser.downloadLogsBlobInBrowser!;
    const replacement = fixture().core;
    const replacementDownload = browser.downloadLogsBlobInBrowser;
    await first.dispose();
    expect(browser.downloadLogsBlobInBrowser).toBe(replacementDownload);
    await expect(firstDownload()).rejects.toThrow("disposed");
    await replacement.dispose();
    expect(browser.downloadLogsBlobInBrowser).toBeUndefined();
  });

  it("cancels an independent-owner pairing ping when the Core retires", async () => {
    const { core } = fixture();
    await core.start();
    await core.pairing.pairings.set("topic", {
      topic: "topic",
      expiry: Math.floor(Date.now() / 1000) + 300,
      active: true,
      relay: { protocol: "irn" },
    });
    const pairing = core.pairing as any;
    pairing.isValidPing = async () => undefined;
    pairing.sendRequest = vi.fn(async () => 1);
    const owner = new AbortController();
    const operation = core.pairing.ping({ topic: "topic" }, owner.signal);
    const failed = expect(operation).rejects.toThrow("disposed");
    await tick();
    await core.dispose();
    await failed;
    expect(owner.signal.aborted).toBe(false);
    expect(core.pairing.events.eventNames()).toHaveLength(0);
  });

  it("joins concurrent initialization and rejects restarting a disposed instance", async () => {
    const { core } = fixture();
    const initialize = vi.spyOn(core.crypto, "init");
    await Promise.all([core.start(), core.start(), core.start()]);
    expect(initialize).toHaveBeenCalledTimes(1);
    const closing = core.dispose();
    expect(core.dispose()).toBe(closing);
    await closing;
    await expect(core.start()).rejects.toThrow("disposed");
    expect(() =>
      core.dispatchEnvelope({ topic: "topic", message: "message", sessionExists: true }),
    ).toThrow("disposed");
    expect(network.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not install listeners or start heartbeat after a retired online lookup", async () => {
    const lookup = deferred<boolean>();
    network.online.mockReturnValueOnce(lookup.promise);
    const { core } = fixture();
    const heartbeat = vi.spyOn(core.heartbeat, "init");
    const opening = core.start();
    const rejected = expect(opening).rejects.toThrow("disposed");
    await tick();
    const closing = core.dispose();
    lookup.resolve(true);
    await Promise.all([closing, rejected]);
    expect(network.subscribe).not.toHaveBeenCalled();
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it("drains an admitted storage write before reporting disposal complete", async () => {
    const { core, storage } = fixture();
    await core.start();
    const write = deferred<void>();
    storage.setItem.mockImplementationOnce(() => write.promise);
    const operation = core.run(() => storage.setItem("held", true));
    const rejected = expect(operation).rejects.toThrow("disposed");
    await tick();
    let finished = false;
    const closing = core.dispose().then(() => {
      finished = true;
    });
    await tick();
    expect(finished).toBe(false);
    expect(() => core.run(() => storage.setItem("late", true))).toThrow("disposed");
    write.resolve();
    await Promise.all([closing, rejected]);
    expect(finished).toBe(true);
  });

  it("does not create a provider after delayed JWT signing finishes", async () => {
    const { core } = fixture();
    await core.start();
    core.relayer.subscriber.topicMap.set("topic", "subscription");
    const signed = deferred<string>();
    vi.spyOn(core.crypto, "signJWT").mockReturnValueOnce(signed.promise);
    const opening = core.relayer.transportOpen();
    const rejected = expect(opening).rejects.toThrow("disposed");
    await tick();
    const closing = core.dispose();
    signed.resolve("stale-jwt");
    await Promise.all([closing, rejected]);
    expect(core.relayer.provider).toEqual({});
  });

  it("removes the network subscriber and ignores a callback already queued at disposal", async () => {
    const { core } = fixture();
    await core.start();
    const queued = network.callback!;
    const open = vi.spyOn(core.relayer, "transportOpen");
    await core.dispose();
    queued(false);
    queued(true);
    await tick();
    expect(network.unsubscribe).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(core.heartbeat.events.eventNames()).toEqual([]);
    expect(core.relayer.events.eventNames()).toEqual([]);
  });
  it("awaits the owned provider's native disposal before completing", async () => {
    const { core } = fixture();
    await core.start();
    const socket = deferred<void>();
    const dispose = vi.fn(() => socket.promise);
    core.relayer.provider = { connection: {}, off() {}, dispose } as any;
    let complete = false;
    const closing = core.dispose().then(() => {
      complete = true;
    });
    await tick();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(complete).toBe(false);
    socket.resolve();
    await closing;
    expect(complete).toBe(true);
  });

  it("retires a superseded connecting provider before requesting another JWT", async () => {
    const { core } = fixture();
    await core.start();
    const socket = deferred<void>();
    const old = { connection: {}, off() {}, dispose: vi.fn(() => socket.promise) };
    core.relayer.provider = old as any;
    const jwt = deferred<string>();
    const sign = vi.spyOn(core.crypto, "signJWT").mockReturnValueOnce(jwt.promise);
    const replacing = (core.relayer as any).createProvider();
    const rejected = expect(replacing).rejects.toThrow("disposed");
    await tick();
    expect(old.dispose).toHaveBeenCalledTimes(1);
    expect(sign).not.toHaveBeenCalled();
    socket.resolve();
    await tick();
    expect(sign).toHaveBeenCalledTimes(1);
    const closing = core.dispose();
    jwt.resolve("late-jwt");
    await Promise.all([closing, rejected]);
    expect(core.relayer.provider).toBe(old);
  });
  it("does not reinstall pairing listeners when cleanup finishes after disposal", async () => {
    const { core } = fixture();
    const cleanup = deferred<void>();
    const pairing = core.pairing as any;
    vi.spyOn(pairing, "cleanup").mockReturnValueOnce(cleanup.promise);
    const opening = core.start();
    const rejected = expect(opening).rejects.toThrow("disposed");
    await tick();
    const closing = core.dispose();
    cleanup.resolve();
    await Promise.all([closing, rejected]);
    expect(core.relayer.events.eventNames()).toEqual([]);
    expect(core.expirer.events.eventNames()).toEqual([]);
  });
  it("replaces a disposed global Core without letting its cleanup erase the new owner", async () => {
    process.env.DISABLE_GLOBAL_CORE = "false";
    const prefix = "terminal-disposal-test";
    const key = `_walletConnectCore_${prefix}`;
    const original = new Core({
      customStoragePrefix: prefix,
      logger: "silent",
      telemetryEnabled: false,
    });
    expect(new Core({ customStoragePrefix: prefix, logger: "silent" })).toBe(original);
    const closing = original.dispose();
    const replacement = new Core({
      customStoragePrefix: prefix,
      logger: "silent",
      telemetryEnabled: false,
    });
    expect(replacement).not.toBe(original);
    await closing;
    expect((globalThis as any)[key]).toBe(replacement);
    expect(replacement.signal.aborted).toBe(false);
    await replacement.dispose();
    expect((globalThis as any)[key]).toBeUndefined();
    delete (globalThis as any)[`${key}_count`];
  });
});
