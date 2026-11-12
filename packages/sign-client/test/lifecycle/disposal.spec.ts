import { beforeEach, describe, expect, it, vi } from "vitest";
import { Core } from "@walletconnect/core";
import { SignClient } from "../../src/client.js";
import { getDeepLink, handleDeeplinkRedirect } from "@walletconnect/utils";

vi.mock("@walletconnect/utils", async (original) => ({
  ...(await original<object>()),
  isOnline: async () => true,
  getDeepLink: vi.fn(),
  handleDeeplinkRedirect: vi.fn(async () => undefined),
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
  const values = new Map<string, any>();
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
  const client = await SignClient.init({
    core,
    logger: "silent",
    metadata: {
      name: "disposal test",
      description: "",
      url: "https://wallet.test",
      icons: [],
    },
  });
  return { core, client, storage };
}
beforeEach(() => {
  process.env.DISABLE_GLOBAL_CORE = "true";
});

describe("SignClient terminal disposal with shared Core", () => {
  it("awaits failed initialization cleanup while preserving the external Core", async () => {
    const { core, client } = await fixture();
    await client.dispose();
    const failure = new Error("initialization failed");
    const held = deferred<void>();
    const initialize = vi
      .spyOn(SignClient.prototype as any, "initialize")
      .mockRejectedValueOnce(failure);
    const originalDispose = SignClient.prototype.dispose;
    const dispose = vi
      .spyOn(SignClient.prototype, "dispose")
      .mockImplementationOnce(async function () {
        await held.promise;
        await originalDispose.call(this);
      });
    try {
      let finished = false;
      const opening = SignClient.init({ core, logger: "silent" });
      const rejected = expect(opening)
        .rejects.toBe(failure)
        .then(() => {
          finished = true;
        });
      await tick();
      expect(dispose).toHaveBeenCalledOnce();
      expect(finished).toBe(false);
      held.resolve();
      await rejected;
      expect(core.signal.aborted).toBe(false);
      await expect(core.start()).resolves.toBeUndefined();
    } finally {
      initialize.mockRestore();
      dispose.mockRestore();
      await core.dispose();
    }
  });

  it("reports a cleanup failure together with the initialization cause", async () => {
    const { core, client } = await fixture();
    await client.dispose();
    const failure = new Error("initialization failed");
    const cleanupError = new Error("native cleanup failed");
    const initialize = vi
      .spyOn(SignClient.prototype as any, "initialize")
      .mockRejectedValueOnce(failure);
    const dispose = vi.spyOn(SignClient.prototype, "dispose").mockRejectedValueOnce(cleanupError);
    try {
      await expect(SignClient.init({ core, logger: "silent" })).rejects.toMatchObject({
        message: "SignClient initialization cleanup failed",
        cause: failure,
        cleanupError,
      });
      expect(core.signal.aborted).toBe(false);
    } finally {
      initialize.mockRestore();
      dispose.mockRestore();
      await core.dispose();
    }
  });

  it("detaches this client's listeners and leaves its external Core usable", async () => {
    const { client, core } = await fixture();
    const pulseBefore = core.heartbeat.events.listenerCount("heartbeat_pulse");
    const messageBefore = core.relayer.events.listenerCount("relayer_message");
    const closing = client.dispose();
    expect(client.dispose()).toBe(closing);
    await closing;
    expect(core.signal.aborted).toBe(false);
    await expect(core.start()).resolves.toBeUndefined();
    expect(core.heartbeat.events.listenerCount("heartbeat_pulse")).toBeLessThan(pulseBefore);
    expect(core.relayer.events.listenerCount("relayer_message")).toBeLessThan(messageBefore);
    await expect(client.pair({ uri: "wc:obsolete" })).rejects.toThrow("disposed");
    expect(() => client.session.getAll()).toThrow("disposed");
    await core.dispose();
  });

  it("does not launch a deeplink when client disposal wins its storage read", async () => {
    const { client, core } = await fixture();
    const engine = client.engine as any;
    await client.session.set("topic", {
      topic: "topic",
      peer: { metadata: client.metadata },
      sessionConfig: {},
    } as any);
    engine.isValidRequest = async () => undefined;
    engine.getAppLinkIfEnabled = () => undefined;
    engine.sendRequest = vi.fn(async () => 1);
    const storedLink = deferred<string>();
    vi.mocked(getDeepLink).mockReturnValueOnce(storedLink.promise);
    vi.mocked(handleDeeplinkRedirect).mockClear();
    const operation = client.request({
      topic: "topic",
      chainId: "eip155:1",
      request: { method: "personal_sign", params: [] },
    });
    const failed = expect(operation).rejects.toThrow("disposed");
    await vi.waitFor(() => expect(getDeepLink).toHaveBeenCalled());
    await client.dispose();
    storedLink.resolve("wallet://obsolete");
    await tick();
    await failed;
    expect(handleDeeplinkRedirect).not.toHaveBeenCalled();
    await core.dispose();
  });

  it("drains other owners and removes remaining listeners when one cleanup throws", async () => {
    const { client, core } = await fixture();
    const held = deferred<void>();
    const closedStore = vi.spyOn(client.session, "dispose").mockReturnValueOnce(held.promise);
    const removed = vi.fn();
    (client.engine as any).linkListeners.push(() => {
      throw new Error("native listener cleanup failed");
    }, removed);
    let finished = false;
    const closing = client.dispose();
    const failed = expect(closing).rejects.toThrow("native listener cleanup failed");
    closing.catch(() => {
      finished = true;
    });
    await tick();
    expect(closedStore).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledOnce();
    expect(finished).toBe(false);
    held.resolve();
    await failed;
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it.each(["history", "expirer"])(
    "drains an actual %s write admitted by the Engine before client disposal",
    async (store) => {
      const { client, core, storage } = await fixture();
      const engine = client.engine as any;
      if (store === "expirer") {
        await client.session.set("topic", { topic: "topic" } as any);
      }
      const held = deferred<void>();
      const started = deferred<void>();
      const originalWrite = storage.setItem.getMockImplementation()!;
      storage.setItem.mockImplementation(async (key, value) => {
        if (key.endsWith(`//${store}`)) {
          started.resolve();
          await held.promise;
        }
        await originalWrite(key, value);
      });
      vi.spyOn(core.crypto, "encode").mockResolvedValue("message");
      const publish = vi.spyOn(core.relayer, "publish");
      const operation =
        store === "history"
          ? engine.sendRequest({
              topic: "topic",
              method: "wc_sessionPing",
              params: {},
              throwOnFailedPublish: true,
            })
          : engine.setExpiry("topic", Math.floor(Date.now() / 1000) + 300);
      const rejected = expect(operation).rejects.toThrow("disposed");
      await started.promise;
      let disposed = false;
      const closing = client.dispose().then(() => {
        disposed = true;
      });
      await tick();
      expect(disposed).toBe(false);
      held.resolve();
      await closing;
      await rejected;
      expect(publish).not.toHaveBeenCalled();
      expect(core.signal.aborted).toBe(false);
      await core.dispose();
    },
  );

  it("does not resume an approval after its asynchronous key generation returns", async () => {
    const { client, core } = await fixture();
    const engine = client.engine as any;
    engine.isValidProposalId = async () => undefined;
    engine.isValidApprove = async () => undefined;
    await client.proposal.set(1, {
      id: 1,
      pairingTopic: "pairing",
      expiryTimestamp: Math.floor(Date.now() / 1000) + 300,
      proposer: { publicKey: "peer", metadata: client.metadata },
      requiredNamespaces: {},
      optionalNamespaces: {},
      relays: [{ protocol: "irn" }],
    });
    const key = deferred<string>();
    const generate = vi.spyOn(core.crypto, "generateKeyPair").mockReturnValueOnce(key.promise);
    const shared = vi.spyOn(core.crypto, "generateSharedKey");
    const publish = vi.spyOn(core.relayer, "publishCustom");
    const operation = client.approve({ id: 1, namespaces: {} });
    const rejected = expect(operation).rejects.toThrow("disposed");
    await tick();
    expect(generate).toHaveBeenCalledTimes(1);
    let disposed = false;
    const closing = client.dispose().then(() => {
      disposed = true;
    });
    await tick();
    expect(disposed).toBe(false);
    key.resolve("obsolete-key");
    await closing;
    await rejected;
    await tick();
    expect(shared).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it("waits for an admitted owned-store write before completing disposal", async () => {
    const { client, core, storage } = await fixture();
    const held = deferred<void>();
    storage.setItem.mockImplementationOnce(() => held.promise);
    const write = client.proposal.set(2, { id: 2 } as any);
    const rejected = expect(write).rejects.toThrow("disposed");
    await tick();
    let complete = false;
    const closing = client.dispose().then(() => {
      complete = true;
    });
    await tick();
    expect(complete).toBe(false);
    held.resolve();
    await Promise.all([rejected, closing]);
    expect(complete).toBe(true);
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });
  it("never publishes a response whose encoding finishes after client disposal", async () => {
    const { client, core } = await fixture();
    const encoded = deferred<string>();
    vi.spyOn(core.crypto, "encode").mockReturnValueOnce(encoded.promise);
    const publish = vi.spyOn(core.relayer, "publish");
    const operation = (client.engine as any).sendResult({
      id: 7,
      topic: "topic",
      result: "signature",
    });
    const rejected = expect(operation).rejects.toThrow("disposed");
    await tick();
    const closing = client.dispose();
    encoded.resolve("obsolete-encoded-response");
    await closing;
    await rejected;
    await tick();
    expect(publish).not.toHaveBeenCalled();
    expect(core.signal.aborted).toBe(false);
    await core.dispose();
  });

  it("releases completed once-listener ownership instead of retaining each request", async () => {
    const { client, core } = await fixture();
    const engine = client.engine as any;
    const initial = engine.listeners.size;
    const callback = vi.fn();
    for (let index = 0; index < 20; index++) {
      engine.listen(engine.events, `test-${index}`, callback, true);
      engine.events.emit(`test-${index}`);
    }
    expect(callback).toHaveBeenCalledTimes(20);
    expect(engine.listeners.size).toBe(initial);
    await client.dispose();
    await core.dispose();
  });
  it("drains an admitted Core mutation that has not reached storage when disposal begins", async () => {
    const { client, core, storage } = await fixture();
    const beforeWrite = deferred<void>();
    let written = false;
    const mutation = client.runMutation(async () => {
      await beforeWrite.promise;
      await core.crypto.keychain.set("admitted-client-key", "public-test-value");
      written = true;
    });
    const rejected = expect(mutation).rejects.toThrow("disposed");
    await tick();
    let complete = false;
    const closing = client.dispose().then(() => {
      complete = true;
    });
    await tick();
    expect(complete).toBe(false);
    expect(written).toBe(false);
    beforeWrite.resolve();
    await Promise.all([closing, rejected]);
    expect(written).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      expect.stringContaining("keychain"),
      expect.objectContaining({ "admitted-client-key": "public-test-value" }),
    );
    expect(complete).toBe(true);
    await core.dispose();
  });

  it("cancels an unanswered shared-Core subscription without accepting its late acknowledgement", async () => {
    const { client, core } = await fixture();
    const response = deferred<any>();
    const request = vi.fn(() => response.promise);
    core.relayer.provider = {
      connection: { socket: { readyState: 1 } },
      request,
      on() {},
      once() {},
      off() {},
      dispose: async () => undefined,
    } as any;
    const subscribe = client.runMutation(() =>
      core.relayer.subscribe("client-owned-topic", undefined, client.signal),
    );
    const rejected = expect(subscribe).rejects.toThrow("disposed");
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    await client.dispose();
    await rejected;
    expect(core.signal.aborted).toBe(false);
    response.resolve("late-subscription-id");
    await tick();
    expect(core.relayer.subscriber.topics).not.toContain("client-owned-topic");
    await core.dispose();
  });
});
