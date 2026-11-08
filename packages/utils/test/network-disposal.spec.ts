import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const environment = vi.hoisted(() => ({ value: "browser" }));
vi.mock("../src/misc.js", async (original) => ({
  ...(await original<object>()),
  getEnvironment: () => environment.value,
  isBrowser: () => environment.value === "browser",
  isReactNative: () => environment.value === "react-native",
}));

import { subscribeToNetworkChange } from "../src/network.js";

beforeEach(() => {
  environment.value = "browser";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("network subscription disposal", () => {
  it("removes the exact browser online and offline listeners", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const add = vi.spyOn(target, "addEventListener");
    const remove = vi.spyOn(target, "removeEventListener");
    const callback = vi.fn();
    const unsubscribe = subscribeToNetworkChange(callback);
    target.dispatchEvent(new Event("online"));
    target.dispatchEvent(new Event("offline"));
    expect(callback.mock.calls).toEqual([[true], [false]]);
    unsubscribe();
    expect(remove).toHaveBeenCalledWith("online", add.mock.calls[0][1]);
    expect(remove).toHaveBeenCalledWith("offline", add.mock.calls[1][1]);
    target.dispatchEvent(new Event("online"));
    target.dispatchEvent(new Event("offline"));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("removes only the disposed browser subscriber", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToNetworkChange(first);
    const unsubscribeSecond = subscribeToNetworkChange(second);
    unsubscribeFirst();
    unsubscribeFirst();
    target.dispatchEvent(new Event("online"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith(true);
    unsubscribeSecond();
  });

  it("returns and invokes the native NetInfo unsubscriber", () => {
    environment.value = "react-native";
    const callbacks = new Set<(state: { isConnected: boolean }) => void>();
    const unsubscribe = vi.fn();
    const addEventListener = vi.fn((callback) => {
      callbacks.add(callback);
      unsubscribe.mockImplementation(() => {
        callbacks.delete(callback);
      });
      return unsubscribe;
    });
    vi.stubGlobal("NetInfo", { addEventListener });
    const callback = vi.fn();
    const stop = subscribeToNetworkChange(callback);
    expect(stop).toBe(unsubscribe);
    for (const listener of callbacks) listener({ isConnected: true });
    expect(callback).toHaveBeenCalledExactlyOnceWith(true);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    for (const listener of callbacks) listener({ isConnected: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("has an inert disposer when the environment has no subscription", () => {
    environment.value = "node";
    const callback = vi.fn();
    const unsubscribe = subscribeToNetworkChange(callback);
    expect(unsubscribe).toBeTypeOf("function");
    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
});
