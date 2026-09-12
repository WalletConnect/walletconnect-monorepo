/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

type ReadableStreamType = "bytes";
export type Hex = `0x${string}`;
export type Address = Hex;
export type Bytes = Hex;
export type U64 = Hex;
export type U128 = Hex;
export type U256 = Hex;
export type B256 = Hex;
export type Url = string;
export type TransactionReceipt = {};

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

export class PayJson {
  free(): void;
  [Symbol.dispose](): void;
  confirm_payment(request_json: string): Promise<string>;
  get_payment_options(request_json: string): Promise<string>;
  get_required_payment_actions(request_json: string): Promise<string>;
  constructor(sdk_config_json: string);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_payjson_free: (a: number, b: number) => void;
  readonly payjson_confirm_payment: (a: number, b: number, c: number) => number;
  readonly payjson_get_payment_options: (a: number, b: number, c: number) => number;
  readonly payjson_get_required_payment_actions: (a: number, b: number, c: number) => number;
  readonly payjson_new: (a: number, b: number, c: number) => void;
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
  readonly __wasm_bindgen_func_elem_1378: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_1617: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_1946: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_2790: (a: number, b: number, c: number, d: number) => void;
  readonly __wasm_bindgen_func_elem_2792: (a: number, b: number, c: number, d: number) => void;
  readonly __wasm_bindgen_func_elem_1387: (a: number, b: number) => void;
  readonly __wasm_bindgen_func_elem_1622: (a: number, b: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
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
