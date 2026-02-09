let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) {
  return heap[idx];
}

const cachedTextDecoder =
  typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true })
    : {
        decode: () => {
          throw Error("TextDecoder not available");
        },
      };

if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let heap_next = heap.length;

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_export_0(addHeapObject(e));
  }
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

function dropObject(idx) {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder =
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
      };

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8ArrayMemory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

const CLOSURE_DTORS =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((state) => {
        wasm.__wbindgen_export_3.get(state.dtor)(state.a, state.b);
      });

function makeMutClosure(arg0, arg1, dtor, f) {
  const state = { a: arg0, b: arg1, cnt: 1, dtor };
  const real = (...args) => {
    // First up with a closure we increment the internal reference
    // count. This ensures that the Rust closure environment won't
    // be deallocated while we're invoking it.
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      if (--state.cnt === 0) {
        wasm.__wbindgen_export_3.get(state.dtor)(a, state.b);
        CLOSURE_DTORS.unregister(state);
      } else {
        state.a = a;
      }
    }
  };
  real.original = state;
  CLOSURE_DTORS.register(real, state, state);
  return real;
}
function __wbg_adapter_26(arg0, arg1) {
  wasm.__wbindgen_export_4(arg0, arg1);
}

function __wbg_adapter_29(arg0, arg1) {
  wasm.__wbindgen_export_5(arg0, arg1);
}

function __wbg_adapter_32(arg0, arg1, arg2) {
  wasm.__wbindgen_export_6(arg0, arg1, addHeapObject(arg2));
}

function __wbg_adapter_155(arg0, arg1, arg2, arg3) {
  wasm.__wbindgen_export_7(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}

const __wbindgen_enum_ReadableStreamType = ["bytes"];

const __wbindgen_enum_RequestCache = [
  "default",
  "no-store",
  "reload",
  "no-cache",
  "force-cache",
  "only-if-cached",
];

const __wbindgen_enum_RequestCredentials = ["omit", "same-origin", "include"];

const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];

const IntoUnderlyingByteSourceFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_intounderlyingbytesource_free(ptr >>> 0, 1));

export class IntoUnderlyingByteSource {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    IntoUnderlyingByteSourceFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  get autoAllocateChunkSize() {
    const ret = wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {ReadableByteStreamController} controller
   * @returns {Promise<any>}
   */
  pull(controller) {
    const ret = wasm.intounderlyingbytesource_pull(this.__wbg_ptr, addHeapObject(controller));
    return takeObject(ret);
  }
  /**
   * @param {ReadableByteStreamController} controller
   */
  start(controller) {
    wasm.intounderlyingbytesource_start(this.__wbg_ptr, addHeapObject(controller));
  }
  /**
   * @returns {ReadableStreamType}
   */
  get type() {
    const ret = wasm.intounderlyingbytesource_type(this.__wbg_ptr);
    return __wbindgen_enum_ReadableStreamType[ret];
  }
  cancel() {
    const ptr = this.__destroy_into_raw();
    wasm.intounderlyingbytesource_cancel(ptr);
  }
}

const IntoUnderlyingSinkFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));

export class IntoUnderlyingSink {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    IntoUnderlyingSinkFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_intounderlyingsink_free(ptr, 0);
  }
  /**
   * @param {any} reason
   * @returns {Promise<any>}
   */
  abort(reason) {
    const ptr = this.__destroy_into_raw();
    const ret = wasm.intounderlyingsink_abort(ptr, addHeapObject(reason));
    return takeObject(ret);
  }
  /**
   * @returns {Promise<any>}
   */
  close() {
    const ptr = this.__destroy_into_raw();
    const ret = wasm.intounderlyingsink_close(ptr);
    return takeObject(ret);
  }
  /**
   * @param {any} chunk
   * @returns {Promise<any>}
   */
  write(chunk) {
    const ret = wasm.intounderlyingsink_write(this.__wbg_ptr, addHeapObject(chunk));
    return takeObject(ret);
  }
}

const IntoUnderlyingSourceFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));

export class IntoUnderlyingSource {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    IntoUnderlyingSourceFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_intounderlyingsource_free(ptr, 0);
  }
  /**
   * @param {ReadableStreamDefaultController} controller
   * @returns {Promise<any>}
   */
  pull(controller) {
    const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, addHeapObject(controller));
    return takeObject(ret);
  }
  cancel() {
    const ptr = this.__destroy_into_raw();
    wasm.intounderlyingsource_cancel(ptr);
  }
}

const PayJsonFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_payjson_free(ptr >>> 0, 1));

export class PayJson {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PayJsonFinalization.unregister(this);
    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_payjson_free(ptr, 0);
  }
  /**
   * @param {string} request_json
   * @returns {Promise<string>}
   */
  confirm_payment(request_json) {
    const ptr0 = passStringToWasm0(
      request_json,
      wasm.__wbindgen_export_1,
      wasm.__wbindgen_export_2,
    );
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.payjson_confirm_payment(this.__wbg_ptr, ptr0, len0);
    return takeObject(ret);
  }
  /**
   * @param {string} request_json
   * @returns {Promise<string>}
   */
  get_payment_options(request_json) {
    const ptr0 = passStringToWasm0(
      request_json,
      wasm.__wbindgen_export_1,
      wasm.__wbindgen_export_2,
    );
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.payjson_get_payment_options(this.__wbg_ptr, ptr0, len0);
    return takeObject(ret);
  }
  /**
   * @param {string} request_json
   * @returns {Promise<string>}
   */
  get_required_payment_actions(request_json) {
    const ptr0 = passStringToWasm0(
      request_json,
      wasm.__wbindgen_export_1,
      wasm.__wbindgen_export_2,
    );
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.payjson_get_required_payment_actions(this.__wbg_ptr, ptr0, len0);
    return takeObject(ret);
  }
  /**
   * @param {string} sdk_config_json
   */
  constructor(sdk_config_json) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(
        sdk_config_json,
        wasm.__wbindgen_export_1,
        wasm.__wbindgen_export_2,
      );
      const len0 = WASM_VECTOR_LEN;
      wasm.payjson_new(retptr, ptr0, len0);
      var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
      var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
      var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
      if (r2) {
        throw takeObject(r1);
      }
      this.__wbg_ptr = r0 >>> 0;
      PayJsonFinalization.register(this, this.__wbg_ptr, this);
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e,
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_abort_410ec47a64ac6117 = function (arg0, arg1) {
    getObject(arg0).abort(getObject(arg1));
  };
  imports.wbg.__wbg_abort_775ef1d17fc65868 = function (arg0) {
    getObject(arg0).abort();
  };
  imports.wbg.__wbg_append_8c7dd8d641a5f01b = function () {
    return handleError(function (arg0, arg1, arg2, arg3, arg4) {
      getObject(arg0).append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    }, arguments);
  };
  imports.wbg.__wbg_arrayBuffer_d1b44c4390db422f = function () {
    return handleError(function (arg0) {
      const ret = getObject(arg0).arrayBuffer();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_buffer_09165b52af8c5237 = function (arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_609cc3eee51ed158 = function (arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_byobRequest_77d9adf63337edfb = function (arg0) {
    const ret = getObject(arg0).byobRequest;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbg_byteLength_e674b853d9c77e1d = function (arg0) {
    const ret = getObject(arg0).byteLength;
    return ret;
  };
  imports.wbg.__wbg_byteOffset_fd862df290ef848d = function (arg0) {
    const ret = getObject(arg0).byteOffset;
    return ret;
  };
  imports.wbg.__wbg_call_672a4d21634d4a24 = function () {
    return handleError(function (arg0, arg1) {
      const ret = getObject(arg0).call(getObject(arg1));
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_call_7cccdd69e0791ae2 = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_clearTimeout_3b6a9a13d4bde075 = function (arg0) {
    const ret = clearTimeout(takeObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_close_304cc1fef3466669 = function () {
    return handleError(function (arg0) {
      getObject(arg0).close();
    }, arguments);
  };
  imports.wbg.__wbg_close_5ce03e29be453811 = function () {
    return handleError(function (arg0) {
      getObject(arg0).close();
    }, arguments);
  };
  imports.wbg.__wbg_crypto_574e78ad8b13b65f = function (arg0) {
    const ret = getObject(arg0).crypto;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_done_769e5ede4b31c67b = function (arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_enqueue_bb16ba72f537dc9e = function () {
    return handleError(function (arg0, arg1) {
      getObject(arg0).enqueue(getObject(arg1));
    }, arguments);
  };
  imports.wbg.__wbg_fetch_509096533071c657 = function (arg0, arg1) {
    const ret = getObject(arg0).fetch(getObject(arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_fetch_df3fa17a5772dafb = function (arg0) {
    const ret = fetch(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_getRandomValues_3c9c0d586e575a16 = function () {
    return handleError(function (arg0, arg1) {
      globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
    }, arguments);
  };
  imports.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function () {
    return handleError(function (arg0, arg1) {
      getObject(arg0).getRandomValues(getObject(arg1));
    }, arguments);
  };
  imports.wbg.__wbg_get_67b2ba62fc30de12 = function () {
    return handleError(function (arg0, arg1) {
      const ret = Reflect.get(getObject(arg0), getObject(arg1));
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_has_a5ea9117f258a0ec = function () {
    return handleError(function (arg0, arg1) {
      const ret = Reflect.has(getObject(arg0), getObject(arg1));
      return ret;
    }, arguments);
  };
  imports.wbg.__wbg_headers_9cb51cfd2ac780a4 = function (arg0) {
    const ret = getObject(arg0).headers;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Response_f2cc20d9f7dfd644 = function (arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Response;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbg_iterator_9a24c88df860dc65 = function () {
    const ret = Symbol.iterator;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_length_a446193dc22c12f8 = function (arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function (arg0) {
    const ret = getObject(arg0).msCrypto;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_018dcc2d6c8c2f6a = function () {
    return handleError(function () {
      const ret = new Headers();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_new_23a2665fac83c611 = function (arg0, arg1) {
    try {
      var state0 = { a: arg0, b: arg1 };
      var cb0 = (arg0, arg1) => {
        const a = state0.a;
        state0.a = 0;
        try {
          return __wbg_adapter_155(a, state0.b, arg0, arg1);
        } finally {
          state0.a = a;
        }
      };
      const ret = new Promise(cb0);
      return addHeapObject(ret);
    } finally {
      state0.a = state0.b = 0;
    }
  };
  imports.wbg.__wbg_new_405e22f390576ce2 = function () {
    const ret = new Object();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_a12002a7f91c75be = function (arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_c68d7209be747379 = function (arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_new_e25e5aab09ff45db = function () {
    return handleError(function () {
      const ret = new AbortController();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function (arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function (arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function (arg0) {
    const ret = new Uint8Array(arg0 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithstrandinit_06c535e0a867c635 = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = new Request(getStringFromWasm0(arg0, arg1), getObject(arg2));
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_next_25feadfc0913fea9 = function (arg0) {
    const ret = getObject(arg0).next;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_6574e1a8a62d1055 = function () {
    return handleError(function (arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_node_905d3e251edff8a2 = function (arg0) {
    const ret = getObject(arg0).node;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_now_807e54c39636c349 = function () {
    const ret = Date.now();
    return ret;
  };
  imports.wbg.__wbg_now_e1163c67115ff874 = function (arg0) {
    const ret = getObject(arg0).now();
    return ret;
  };
  imports.wbg.__wbg_performance_7fe0928f3ab059e5 = function (arg0) {
    const ret = getObject(arg0).performance;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_process_dc0fbacc7c1c06f7 = function (arg0) {
    const ret = getObject(arg0).process;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function (arg0) {
    queueMicrotask(getObject(arg0));
  };
  imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function (arg0) {
    const ret = getObject(arg0).queueMicrotask;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_randomFillSync_ac0988aba3254290 = function () {
    return handleError(function (arg0, arg1) {
      getObject(arg0).randomFillSync(takeObject(arg1));
    }, arguments);
  };
  imports.wbg.__wbg_require_60cc747a6bc5215a = function () {
    return handleError(function () {
      const ret = module.require;
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_resolve_4851785c9c5f573d = function (arg0) {
    const ret = Promise.resolve(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_respond_1f279fa9f8edcb1c = function () {
    return handleError(function (arg0, arg1) {
      getObject(arg0).respond(arg1 >>> 0);
    }, arguments);
  };
  imports.wbg.__wbg_setTimeout_35a07631c669fbee = function (arg0, arg1) {
    const ret = setTimeout(getObject(arg0), arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_setTimeout_42370cb3051b8c2c = function () {
    return handleError(function (arg0, arg1, arg2) {
      const ret = getObject(arg0).setTimeout(getObject(arg1), arg2);
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_set_65595bdd868b3009 = function (arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbg_setbody_5923b78a95eedf29 = function (arg0, arg1) {
    getObject(arg0).body = getObject(arg1);
  };
  imports.wbg.__wbg_setcache_12f17c3a980650e4 = function (arg0, arg1) {
    getObject(arg0).cache = __wbindgen_enum_RequestCache[arg1];
  };
  imports.wbg.__wbg_setcredentials_c3a22f1cd105a2c6 = function (arg0, arg1) {
    getObject(arg0).credentials = __wbindgen_enum_RequestCredentials[arg1];
  };
  imports.wbg.__wbg_setheaders_834c0bdb6a8949ad = function (arg0, arg1) {
    getObject(arg0).headers = getObject(arg1);
  };
  imports.wbg.__wbg_setmethod_3c5280fe5d890842 = function (arg0, arg1, arg2) {
    getObject(arg0).method = getStringFromWasm0(arg1, arg2);
  };
  imports.wbg.__wbg_setmode_5dc300b865044b65 = function (arg0, arg1) {
    getObject(arg0).mode = __wbindgen_enum_RequestMode[arg1];
  };
  imports.wbg.__wbg_setsignal_75b21ef3a81de905 = function (arg0, arg1) {
    getObject(arg0).signal = getObject(arg1);
  };
  imports.wbg.__wbg_signal_aaf9ad74119f20a4 = function (arg0) {
    const ret = getObject(arg0).signal;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function () {
    const ret = typeof global === "undefined" ? null : global;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function () {
    const ret = typeof globalThis === "undefined" ? null : globalThis;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function () {
    const ret = typeof self === "undefined" ? null : self;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function () {
    const ret = typeof window === "undefined" ? null : window;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbg_status_f6360336ca686bf0 = function (arg0) {
    const ret = getObject(arg0).status;
    return ret;
  };
  imports.wbg.__wbg_stringify_f7ed6987935b4a24 = function () {
    return handleError(function (arg0) {
      const ret = JSON.stringify(getObject(arg0));
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function (arg0, arg1, arg2) {
    const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_text_7805bea50de2af49 = function () {
    return handleError(function (arg0) {
      const ret = getObject(arg0).text();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_then_44b73946d2fb3e7d = function (arg0, arg1) {
    const ret = getObject(arg0).then(getObject(arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_then_48b406749878a531 = function (arg0, arg1, arg2) {
    const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_url_ae10c34ca209681d = function (arg0, arg1) {
    const ret = getObject(arg1).url;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbg_value_cd1ffa7b1ab794f1 = function (arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_versions_c01dfd4722a88165 = function (arg0) {
    const ret = getObject(arg0).versions;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_view_fd8a56e8983f448d = function (arg0) {
    const ret = getObject(arg0).view;
    return isLikeNone(ret) ? 0 : addHeapObject(ret);
  };
  imports.wbg.__wbindgen_cb_drop = function (arg0) {
    const obj = takeObject(arg0).original;
    if (obj.cnt-- == 1) {
      obj.a = 0;
      return true;
    }
    const ret = false;
    return ret;
  };
  imports.wbg.__wbindgen_closure_wrapper1265 = function (arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 145, __wbg_adapter_26);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_closure_wrapper1473 = function (arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 168, __wbg_adapter_29);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_closure_wrapper1754 = function (arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 226, __wbg_adapter_32);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_error_new = function (arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_is_function = function (arg0) {
    const ret = typeof getObject(arg0) === "function";
    return ret;
  };
  imports.wbg.__wbindgen_is_object = function (arg0) {
    const val = getObject(arg0);
    const ret = typeof val === "object" && val !== null;
    return ret;
  };
  imports.wbg.__wbindgen_is_string = function (arg0) {
    const ret = typeof getObject(arg0) === "string";
    return ret;
  };
  imports.wbg.__wbindgen_is_undefined = function (arg0) {
    const ret = getObject(arg0) === undefined;
    return ret;
  };
  imports.wbg.__wbindgen_memory = function () {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_clone_ref = function (arg0) {
    const ret = getObject(arg0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function (arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbindgen_string_get = function (arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : undefined;
    var ptr1 = isLikeNone(ret)
      ? 0
      : passStringToWasm0(ret, wasm.__wbindgen_export_1, wasm.__wbindgen_export_2);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
  };
  imports.wbg.__wbindgen_string_new = function (arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_throw = function (arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };

  return imports;
}

function __wbg_init_memory(imports, memory) {}

function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;

  return wasm;
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (typeof module !== "undefined") {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();

  __wbg_init_memory(imports);

  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }

  const instance = new WebAssembly.Instance(module, imports);

  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (typeof module_or_path !== "undefined") {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (typeof module_or_path === "undefined") {
    module_or_path = new URL("yttrium_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  __wbg_init_memory(imports);

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
