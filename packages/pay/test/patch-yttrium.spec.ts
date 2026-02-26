import { describe, it, expect } from "vitest";
import { patchYttriumSource } from "../../../scripts/patch_yttrium_lazy_init.js";

const ORIGINAL_TEXT_DECODER = `const cachedTextDecoder =
  typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true })
    : {
        decode: () => {
          throw Error("TextDecoder not available");
        },
      };

if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}`;

const ORIGINAL_TEXT_ENCODER = `const cachedTextEncoder =
  typeof TextEncoder !== "undefined"
    ? new TextEncoder("utf-8")
    : {
        encode: () => {
          throw Error("TextEncoder not available");
        },
      };

const encodeString =
  typeof cachedTextEncoder.encodeInto === "function"
    ? function (arg, view) {
        return cachedTextEncoder.encodeInto(arg, view);
      }
    : function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
          read: arg.length,
          written: buf.length,
        };
      };`;

const DECODER_USAGE = `function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}`;

const ENCODER_USAGE = `function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }
}`;

const UNRELATED_CODE = `let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) {
  return heap[idx];
}`;

function buildFullInput(): string {
  return [
    UNRELATED_CODE,
    ORIGINAL_TEXT_DECODER,
    DECODER_USAGE,
    ORIGINAL_TEXT_ENCODER,
    ENCODER_USAGE,
  ].join("\n\n");
}

describe("patch_yttrium_lazy_init", () => {
  describe("TextDecoder patching", () => {
    it("should replace eager TextDecoder init with lazy getter", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("let cachedTextDecoder = null;");
      expect(code).toContain("function getTextDecoder()");
      expect(code).not.toContain("const cachedTextDecoder =");
    });

    it("should replace cachedTextDecoder usage with getTextDecoder()", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("return getTextDecoder().decode(getUint8ArrayMemory0()");
    });

    it("should preserve the warmup call inside getTextDecoder as cachedTextDecoder.decode()", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      const getterMatch = code.match(
        /function getTextDecoder\(\) \{[\s\S]*?return cachedTextDecoder;\s*\}/,
      );
      expect(getterMatch).not.toBeNull();
      expect(getterMatch![0]).toContain("cachedTextDecoder.decode();");
      expect(getterMatch![0]).not.toContain("getTextDecoder().decode()");
    });

    it("should report textDecoder as patched", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { results } = patchYttriumSource(input);

      // #then
      expect(results.textDecoder).toBe(true);
    });
  });

  describe("TextEncoder patching", () => {
    it("should replace eager TextEncoder init with lazy getter", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("let cachedTextEncoder = null;");
      expect(code).toContain("function getTextEncoder()");
      expect(code).not.toContain("const cachedTextEncoder =");
    });

    it("should replace encodeString const with a function", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("function encodeString(arg, view)");
      expect(code).not.toContain("const encodeString =");
    });

    it("should replace cachedTextEncoder.encode usage with getTextEncoder().encode", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("const buf = getTextEncoder().encode(arg);");
      expect(code).not.toContain("cachedTextEncoder.encode(arg)");
    });

    it("should report textEncoder as patched", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { results } = patchYttriumSource(input);

      // #then
      expect(results.textEncoder).toBe(true);
    });
  });

  describe("unrelated code preservation", () => {
    it("should not modify code outside the TextDecoder/TextEncoder patterns", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain(UNRELATED_CODE);
    });

    it("should preserve getStringFromWasm0 function structure", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("function getStringFromWasm0(ptr, len)");
      expect(code).toContain("ptr = ptr >>> 0;");
    });

    it("should preserve passStringToWasm0 function structure", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).toContain("function passStringToWasm0(arg, malloc, realloc)");
      expect(code).toContain("const ptr = malloc(buf.length, 1) >>> 0;");
    });
  });

  describe("idempotency", () => {
    it("should not modify an already-patched file", () => {
      // #given
      const input = buildFullInput();
      const { code: firstPass } = patchYttriumSource(input);

      // #when
      const { code: secondPass, changed } = patchYttriumSource(firstPass);

      // #then
      expect(changed).toBe(false);
      expect(secondPass).toBe(firstPass);
    });

    it("should report no patterns found on already-patched code", () => {
      // #given
      const input = buildFullInput();
      const { code: patched } = patchYttriumSource(input);

      // #when
      const { results } = patchYttriumSource(patched);

      // #then
      expect(results.textDecoder).toBe(false);
      expect(results.textEncoder).toBe(false);
    });
  });

  describe("partial patching", () => {
    it("should patch only TextDecoder when TextEncoder is absent", () => {
      // #given
      const input = [UNRELATED_CODE, ORIGINAL_TEXT_DECODER, DECODER_USAGE].join("\n\n");

      // #when
      const { code, changed, results } = patchYttriumSource(input);

      // #then
      expect(changed).toBe(true);
      expect(results.textDecoder).toBe(true);
      expect(results.textEncoder).toBe(false);
      expect(code).toContain("function getTextDecoder()");
    });

    it("should patch only TextEncoder when TextDecoder is absent", () => {
      // #given
      const input = [UNRELATED_CODE, ORIGINAL_TEXT_ENCODER, ENCODER_USAGE].join("\n\n");

      // #when
      const { code, changed, results } = patchYttriumSource(input);

      // #then
      expect(changed).toBe(true);
      expect(results.textDecoder).toBe(false);
      expect(results.textEncoder).toBe(true);
      expect(code).toContain("function getTextEncoder()");
    });
  });

  describe("no matching patterns", () => {
    it("should return unchanged code when no patterns match", () => {
      // #given
      const input = UNRELATED_CODE;

      // #when
      const { code, changed, results } = patchYttriumSource(input);

      // #then
      expect(changed).toBe(false);
      expect(code).toBe(input);
      expect(results.textDecoder).toBe(false);
      expect(results.textEncoder).toBe(false);
    });
  });

  describe("patched output validity", () => {
    it("should produce syntactically valid JavaScript", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then — parsing as a function body to avoid strict-mode issues with let re-declarations
      expect(() => new Function(code)).not.toThrow();
    });

    it("should have no remaining direct cachedTextDecoder references outside the getter", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      const matches = code.match(/cachedTextDecoder\.decode\(/g) || [];
      expect(matches).toHaveLength(1);

      const getterBlock = code.match(
        /function getTextDecoder\(\) \{[\s\S]*?return cachedTextDecoder;\s*\}/,
      );
      expect(getterBlock).not.toBeNull();
      expect(getterBlock![0]).toContain("cachedTextDecoder.decode(");
    });

    it("should have no remaining direct cachedTextEncoder.encode references", () => {
      // #given
      const input = buildFullInput();

      // #when
      const { code } = patchYttriumSource(input);

      // #then
      expect(code).not.toMatch(/cachedTextEncoder\.encode\(/);
    });
  });
});
