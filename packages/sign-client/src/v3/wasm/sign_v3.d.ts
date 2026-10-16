/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

type ReadableStreamType = "bytes";

export class IntoUnderlyingByteSource {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  cancel(): void;
  pull(controller: ReadableByteStreamController): Promise<any>;
  start(controller: ReadableByteStreamController): void;
  readonly autoAllocateChunkSize: number;
  readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  abort(reason: any): Promise<any>;
  close(): Promise<any>;
  write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  cancel(): void;
  pull(controller: ReadableStreamDefaultController): Promise<any>;
}

export class WasmSignClient {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * The JSON facade: resolves with the result JSON, rejects with `{ code, message }` JSON.
   */
  call(method: string, params_json: string): Promise<any>;
  clientId(): string;
  /**
   * `storage`: `{ get(k), set(k, v), remove(k), keys(prefix) }`, each may return a Promise.
   * `onEvent`: called with each event as a JSON string.
   */
  static create(config_json: string, storage: any, on_event: Function): Promise<WasmSignClient>;
  foreground(): void;
  start(): void;
  stop(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmsignclient_free: (a: number, b: number) => void;
  readonly wasmsignclient_call: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly wasmsignclient_clientId: (a: number, b: number) => void;
  readonly wasmsignclient_create: (a: number, b: number, c: number, d: number) => number;
  readonly wasmsignclient_foreground: (a: number) => void;
  readonly wasmsignclient_start: (a: number) => void;
  readonly wasmsignclient_stop: (a: number) => void;
  readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
  readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
  readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
  readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
  readonly intounderlyingbytesource_cancel: (a: number) => void;
  readonly intounderlyingbytesource_pull: (a: number, b: number) => number;
  readonly intounderlyingbytesource_start: (a: number, b: number) => void;
  readonly intounderlyingbytesource_type: (a: number) => number;
  readonly intounderlyingsink_abort: (a: number, b: number) => number;
  readonly intounderlyingsink_close: (a: number) => number;
  readonly intounderlyingsink_write: (a: number, b: number) => number;
  readonly intounderlyingsource_cancel: (a: number) => void;
  readonly intounderlyingsource_pull: (a: number, b: number) => number;
  readonly __wasm_bindgen_func_elem_2000: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2552: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2802: (a: number, b: number, c: number, d: number) => void;
  readonly __wasm_bindgen_func_elem_2812: (a: number, b: number, c: number, d: number) => void;
  readonly __wasm_bindgen_func_elem_2074: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
