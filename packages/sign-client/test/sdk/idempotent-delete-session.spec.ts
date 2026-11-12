import { expect, describe, it } from "vitest";
import { Engine } from "../../src/controllers/engine.js";

/**
 * `deleteSession` is private on Engine. Rather than spinning up two clients over
 * a live relay, drive the engine directly with a minimal fake client -- the fix
 * is a synchronous guard, so no relay/network is involved.
 *
 * Kept under `test/sdk` on purpose: that is the only directory CI runs for this
 * package (`npm run test:run` -> `vitest run --dir test/sdk`), so a test placed
 * anywhere else would never execute.
 *
 * The fake `session.get` reproduces the real `Store.getData` behaviour that made
 * this a bug: it throws `No matching key. session: <topic>` for a missing topic.
 */
const createFakeClient = (topic: string) => {
  const sessions: Record<string, unknown> = {
    [topic]: { topic, self: { publicKey: "pubkey" } },
  };
  const calls = { unsubscribe: 0, sessionDelete: 0 };

  const client = {
    session: {
      // Dynamic so it reflects deletions, like the real store's keys getter.
      get keys() {
        return Object.keys(sessions);
      },
      get: (t: string) => {
        if (!(t in sessions)) {
          throw new Error(`No matching key. session: ${t}`);
        }
        return sessions[t];
      },
      delete: async (t: string) => {
        calls.sessionDelete += 1;
        delete sessions[t];
      },
    },
    core: {
      relayer: {
        unsubscribe: async () => {
          calls.unsubscribe += 1;
        },
      },
      crypto: {
        keychain: { has: () => false },
        deleteKeyPair: async () => {},
        deleteSymKey: async () => {},
      },
      expirer: { del: () => {} },
      storage: { removeItem: async () => {} },
    },
    pendingRequest: { getAll: () => [] },
    events: { emit: () => {} },
    logger: { warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, info: () => {} },
  };

  return { client, calls };
};

// Engine's constructor only stores the client, so a fake is enough.
const createEngine = (topic: string) => {
  const { client, calls } = createFakeClient(topic);
  const engine = new Engine(client as never);
  // `addToRecentlyDeleted` lives on the IEngine base and touches engine internals
  // that are irrelevant here; stub it out so the test stays focused.
  (engine as unknown as { addToRecentlyDeleted: () => void }).addToRecentlyDeleted = () => {};
  return { engine, calls };
};

const deleteSession = (engine: Engine, topic: string) =>
  (engine as unknown as { deleteSession: (p: { topic: string }) => Promise<void> }).deleteSession({
    topic,
  });

describe("Session delete idempotency", () => {
  it("deletes a present session", async () => {
    const topic = "topic-present";
    const { engine, calls } = createEngine(topic);

    await deleteSession(engine, topic);

    expect(calls.unsubscribe).toBe(1);
    expect(calls.sessionDelete).toBe(1);
  });

  it("is a no-op when the same topic is deleted twice (the #2983 case)", async () => {
    const topic = "topic-twice";
    const { engine, calls } = createEngine(topic);

    // #given - the session is deleted once
    await deleteSession(engine, topic);
    expect(calls.sessionDelete).toBe(1);

    // #when - the same topic is deleted again, e.g. the peer disconnected first
    // (we removed it handling their wc_sessionDelete) or a concurrent
    // disconnect/expiry won the race
    // #then - it resolves instead of throwing "No matching key. session: <topic>"
    await expect(deleteSession(engine, topic)).resolves.toBeUndefined();

    // and it did not re-run the cleanup
    expect(calls.unsubscribe).toBe(1);
    expect(calls.sessionDelete).toBe(1);
  });

  it("is a no-op (not a throw) for a topic that was never present", async () => {
    const { engine, calls } = createEngine("topic-exists");

    await expect(deleteSession(engine, "topic-never-existed")).resolves.toBeUndefined();

    expect(calls.unsubscribe).toBe(0);
    expect(calls.sessionDelete).toBe(0);
  });
});
