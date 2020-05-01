import crypto from "crypto";
import subtle from "webcrypto";

export function mockWebCrypto() {
  Object.defineProperty(global, "crypto", {
    value: {
      getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
      subtle,
    },
  });
}
