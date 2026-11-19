import { expect, vi } from "vitest";

// Every suite but test/v3 runs without the v3 engine, so it covers v2 alone.
if (!expect.getState().testPath?.includes("/test/v3/")) {
  vi.doMock("../../src/v3/client.js", () => ({
    V3Client: { init: () => Promise.resolve(undefined) },
    SignV3Error: class SignV3Error extends Error {},
  }));
}
