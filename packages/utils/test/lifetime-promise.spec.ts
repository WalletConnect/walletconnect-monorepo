import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDelayedPromise, createExpiringPromise } from "../src/misc.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("lifetime-owned expiring promises", () => {
  it("aborts a pending operation and clears its timer and listener", async () => {
    const source = deferred<string>();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const reason = new Error("owner disposed");
    const pending = createExpiringPromise(source.promise, 1000, "expired", controller.signal);
    const rejected = expect(pending).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    source.resolve("late");
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("observes late source rejection after a pre-aborted owner", async () => {
    const source = deferred<void>();
    const controller = new AbortController();
    const reason = new Error("already disposed");
    controller.abort(reason);
    await expect(
      createExpiringPromise(source.promise, 1000, "expired", controller.signal),
    ).rejects.toBe(reason);
    source.reject(new Error("late source failure"));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the abort listener after ordinary success and failure", async () => {
    for (const failed of [false, true]) {
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, "removeEventListener");
      const reason = new Error("source failed");
      const source = failed ? Promise.reject(reason) : Promise.resolve("ok");
      const pending = createExpiringPromise(source, 1000, "expired", controller.signal);
      if (failed) await expect(pending).rejects.toBe(reason);
      else await expect(pending).resolves.toBe("ok");
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("retains ordinary expiry behavior without a signal", async () => {
    const source = deferred<void>();
    const pending = createExpiringPromise(source.promise, 1000, "expired");
    const rejected = expect(pending).rejects.toThrow("expired");
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("lifetime-owned delayed promises", () => {
  it("aborts an admitted waiter and removes its deadline", async () => {
    const controller = new AbortController();
    const delayed = createDelayedPromise<string>(10, "expired", controller.signal);
    const reason = new Error("owner disposed");
    const rejected = expect(delayed.done()).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("refuses an already-aborted owner without installing a deadline", async () => {
    const controller = new AbortController();
    const reason = new Error("disposed");
    controller.abort(reason);
    const delayed = createDelayedPromise<string>(10, "expired", controller.signal);
    await expect(delayed.done()).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes the owner listener after success and preserves its cached result", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const delayed = createDelayedPromise<string>(10, "expired", controller.signal);
    const pending = delayed.done();
    delayed.resolve("ok");
    await expect(pending).resolves.toBe("ok");
    await expect(delayed.done()).resolves.toBe("ok");
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes the owner listener after an explicit rejection", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const delayed = createDelayedPromise<string>(10, "expired", controller.signal);
    const reason = { code: 1, message: "rejected" };
    const rejected = expect(delayed.done()).rejects.toBe(reason);
    delayed.reject(reason);
    await rejected;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares ordinary resolution across concurrent admitted waiters", async () => {
    const delayed = createDelayedPromise<string>(10, "expired");
    const first = delayed.done();
    const second = delayed.done();
    delayed.resolve("ok");
    await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts every admitted waiter without leaving another deadline active", async () => {
    const controller = new AbortController();
    const delayed = createDelayedPromise<string>(10, "expired", controller.signal);
    const errors: unknown[] = [];
    delayed.done().catch((error) => {
      errors.push(error);
    });
    delayed.done().catch((error) => {
      errors.push(error);
    });
    controller.abort();
    await Promise.resolve();
    expect(errors).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
