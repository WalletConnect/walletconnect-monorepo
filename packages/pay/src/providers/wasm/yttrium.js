/* @ts-self-types="./yttrium.d.ts" */

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
  cancel() {
    const ptr = this.__destroy_into_raw();
    wasm.intounderlyingbytesource_cancel(ptr);
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
}
if (Symbol.dispose)
  IntoUnderlyingByteSource.prototype[Symbol.dispose] = IntoUnderlyingByteSource.prototype.free;

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
if (Symbol.dispose)
  IntoUnderlyingSink.prototype[Symbol.dispose] = IntoUnderlyingSink.prototype.free;

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
  cancel() {
    const ptr = this.__destroy_into_raw();
    wasm.intounderlyingsource_cancel(ptr);
  }
  /**
   * @param {ReadableStreamDefaultController} controller
   * @returns {Promise<any>}
   */
  pull(controller) {
    const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, addHeapObject(controller));
    return takeObject(ret);
  }
}
if (Symbol.dispose)
  IntoUnderlyingSource.prototype[Symbol.dispose] = IntoUnderlyingSource.prototype.free;

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
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.payjson_confirm_payment(this.__wbg_ptr, ptr0, len0);
    return takeObject(ret);
  }
  /**
   * @param {string} request_json
   * @returns {Promise<string>}
   */
  get_payment_options(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.payjson_get_payment_options(this.__wbg_ptr, ptr0, len0);
    return takeObject(ret);
  }
  /**
   * @param {string} request_json
   * @returns {Promise<string>}
   */
  get_required_payment_actions(request_json) {
    const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
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
        wasm.__wbindgen_export,
        wasm.__wbindgen_export2,
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
if (Symbol.dispose) PayJson.prototype[Symbol.dispose] = PayJson.prototype.free;

function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_83742b46f01ce22d: function (arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbg___wbindgen_is_function_3c846841762788c1: function (arg0) {
      const ret = typeof getObject(arg0) === "function";
      return ret;
    },
    __wbg___wbindgen_is_object_781bc9f159099513: function (arg0) {
      const val = getObject(arg0);
      const ret = typeof val === "object" && val !== null;
      return ret;
    },
    __wbg___wbindgen_is_string_7ef6b97b02428fae: function (arg0) {
      const ret = typeof getObject(arg0) === "string";
      return ret;
    },
    __wbg___wbindgen_is_undefined_52709e72fb9f179c: function (arg0) {
      const ret = getObject(arg0) === undefined;
      return ret;
    },
    __wbg___wbindgen_string_get_395e606bd0ee4427: function (arg0, arg1) {
      const obj = getObject(arg1);
      const ret = typeof obj === "string" ? obj : undefined;
      var ptr1 = isLikeNone(ret)
        ? 0
        : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
      var len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_6ddd609b62940d55: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg__wbg_cb_unref_6b5b6b8576d35cb1: function (arg0) {
      getObject(arg0)._wbg_cb_unref();
    },
    __wbg_abort_5ef96933660780b7: function (arg0) {
      getObject(arg0).abort();
    },
    __wbg_abort_6479c2d794ebf2ee: function (arg0, arg1) {
      getObject(arg0).abort(getObject(arg1));
    },
    __wbg_append_608dfb635ee8998f: function () {
      return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        getObject(arg0).append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
      }, arguments);
    },
    __wbg_arrayBuffer_eb8e9ca620af2a19: function () {
      return handleError(function (arg0) {
        const ret = getObject(arg0).arrayBuffer();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_buffer_60b8043cd926067d: function (arg0) {
      const ret = getObject(arg0).buffer;
      return addHeapObject(ret);
    },
    __wbg_byobRequest_6342e5f2b232c0f9: function (arg0) {
      const ret = getObject(arg0).byobRequest;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbg_byteLength_607b856aa6c5a508: function (arg0) {
      const ret = getObject(arg0).byteLength;
      return ret;
    },
    __wbg_byteOffset_b26b63681c83856c: function (arg0) {
      const ret = getObject(arg0).byteOffset;
      return ret;
    },
    __wbg_call_2d781c1f4d5c0ef8: function () {
      return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_call_e133b57c9155d22c: function () {
      return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_clearTimeout_6b8d9a38b9263d65: function (arg0) {
      const ret = clearTimeout(takeObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_close_690d36108c557337: function () {
      return handleError(function (arg0) {
        getObject(arg0).close();
      }, arguments);
    },
    __wbg_close_737b4b1fbc658540: function () {
      return handleError(function (arg0) {
        getObject(arg0).close();
      }, arguments);
    },
    __wbg_crypto_38df2bab126b63dc: function (arg0) {
      const ret = getObject(arg0).crypto;
      return addHeapObject(ret);
    },
    __wbg_done_08ce71ee07e3bd17: function (arg0) {
      const ret = getObject(arg0).done;
      return ret;
    },
    __wbg_enqueue_ec3552838b4b7fbf: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).enqueue(getObject(arg1));
      }, arguments);
    },
    __wbg_fetch_5550a88cf343aaa9: function (arg0, arg1) {
      const ret = getObject(arg0).fetch(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_fetch_9dad4fe911207b37: function (arg0) {
      const ret = fetch(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_getRandomValues_76dfc69825c9c552: function () {
      return handleError(function (arg0, arg1) {
        globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
      }, arguments);
    },
    __wbg_getRandomValues_c44a50d8cfdaebeb: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).getRandomValues(getObject(arg1));
      }, arguments);
    },
    __wbg_get_326e41e095fb2575: function () {
      return handleError(function (arg0, arg1) {
        const ret = Reflect.get(getObject(arg0), getObject(arg1));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_has_926ef2ff40b308cf: function () {
      return handleError(function (arg0, arg1) {
        const ret = Reflect.has(getObject(arg0), getObject(arg1));
        return ret;
      }, arguments);
    },
    __wbg_headers_eb2234545f9ff993: function (arg0) {
      const ret = getObject(arg0).headers;
      return addHeapObject(ret);
    },
    __wbg_instanceof_Response_9b4d9fd451e051b1: function (arg0) {
      let result;
      try {
        result = getObject(arg0) instanceof Response;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_iterator_d8f549ec8fb061b1: function () {
      const ret = Symbol.iterator;
      return addHeapObject(ret);
    },
    __wbg_length_ea16607d7b61445b: function (arg0) {
      const ret = getObject(arg0).length;
      return ret;
    },
    __wbg_msCrypto_bd5a034af96bcba6: function (arg0) {
      const ret = getObject(arg0).msCrypto;
      return addHeapObject(ret);
    },
    __wbg_new_0837727332ac86ba: function () {
      return handleError(function () {
        const ret = new Headers();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_new_5f486cdf45a04d78: function (arg0) {
      const ret = new Uint8Array(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_new_ab79df5bd7c26067: function () {
      const ret = new Object();
      return addHeapObject(ret);
    },
    __wbg_new_c518c60af666645b: function () {
      return handleError(function () {
        const ret = new AbortController();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_new_d15cb560a6a0e5f0: function (arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbg_new_from_slice_22da9388ac046e50: function (arg0, arg1) {
      const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbg_new_typed_aaaeaf29cf802876: function (arg0, arg1) {
      try {
        var state0 = { a: arg0, b: arg1 };
        var cb0 = (arg0, arg1) => {
          const a = state0.a;
          state0.a = 0;
          try {
            return __wasm_bindgen_func_elem_2733(a, state0.b, arg0, arg1);
          } finally {
            state0.a = a;
          }
        };
        const ret = new Promise(cb0);
        return addHeapObject(ret);
      } finally {
        state0.a = state0.b = 0;
      }
    },
    __wbg_new_with_byte_offset_and_length_b2ec5bf7b2f35743: function (arg0, arg1, arg2) {
      const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
      return addHeapObject(ret);
    },
    __wbg_new_with_length_825018a1616e9e55: function (arg0) {
      const ret = new Uint8Array(arg0 >>> 0);
      return addHeapObject(ret);
    },
    __wbg_new_with_str_and_init_b4b54d1a819bc724: function () {
      return handleError(function (arg0, arg1, arg2) {
        const ret = new Request(getStringFromWasm0(arg0, arg1), getObject(arg2));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_next_11b99ee6237339e3: function () {
      return handleError(function (arg0) {
        const ret = getObject(arg0).next();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_next_e01a967809d1aa68: function (arg0) {
      const ret = getObject(arg0).next;
      return addHeapObject(ret);
    },
    __wbg_node_84ea875411254db1: function (arg0) {
      const ret = getObject(arg0).node;
      return addHeapObject(ret);
    },
    __wbg_now_16f0c993d5dd6c27: function () {
      const ret = Date.now();
      return ret;
    },
    __wbg_now_55c5352b4b61d145: function (arg0) {
      const ret = getObject(arg0).now();
      return ret;
    },
    __wbg_performance_aa4d78060a5b8a2f: function (arg0) {
      const ret = getObject(arg0).performance;
      return addHeapObject(ret);
    },
    __wbg_process_44c7a14e11e9f69e: function (arg0) {
      const ret = getObject(arg0).process;
      return addHeapObject(ret);
    },
    __wbg_prototypesetcall_d62e5099504357e6: function (arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
    },
    __wbg_queueMicrotask_0c399741342fb10f: function (arg0) {
      const ret = getObject(arg0).queueMicrotask;
      return addHeapObject(ret);
    },
    __wbg_queueMicrotask_a082d78ce798393e: function (arg0) {
      queueMicrotask(getObject(arg0));
    },
    __wbg_randomFillSync_6c25eac9869eb53c: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).randomFillSync(takeObject(arg1));
      }, arguments);
    },
    __wbg_require_b4edbdcf3e2a1ef0: function () {
      return handleError(function () {
        const ret = module.require;
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_resolve_ae8d83246e5bcc12: function (arg0) {
      const ret = Promise.resolve(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_respond_e286ee502e7cf7e4: function () {
      return handleError(function (arg0, arg1) {
        getObject(arg0).respond(arg1 >>> 0);
      }, arguments);
    },
    __wbg_setTimeout_05a790c35d76ff25: function () {
      return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).setTimeout(getObject(arg1), arg2);
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_setTimeout_f757f00851f76c42: function (arg0, arg1) {
      const ret = setTimeout(getObject(arg0), arg1);
      return addHeapObject(ret);
    },
    __wbg_set_8c0b3ffcf05d61c2: function (arg0, arg1, arg2) {
      getObject(arg0).set(getArrayU8FromWasm0(arg1, arg2));
    },
    __wbg_set_body_a3d856b097dfda04: function (arg0, arg1) {
      getObject(arg0).body = getObject(arg1);
    },
    __wbg_set_cache_ec7e430c6056ebda: function (arg0, arg1) {
      getObject(arg0).cache = __wbindgen_enum_RequestCache[arg1];
    },
    __wbg_set_credentials_ed63183445882c65: function (arg0, arg1) {
      getObject(arg0).credentials = __wbindgen_enum_RequestCredentials[arg1];
    },
    __wbg_set_headers_3c8fecc693b75327: function (arg0, arg1) {
      getObject(arg0).headers = getObject(arg1);
    },
    __wbg_set_method_8c015e8bcafd7be1: function (arg0, arg1, arg2) {
      getObject(arg0).method = getStringFromWasm0(arg1, arg2);
    },
    __wbg_set_mode_5a87f2c809cf37c2: function (arg0, arg1) {
      getObject(arg0).mode = __wbindgen_enum_RequestMode[arg1];
    },
    __wbg_set_signal_0cebecb698f25d21: function (arg0, arg1) {
      getObject(arg0).signal = getObject(arg1);
    },
    __wbg_signal_166e1da31adcac18: function (arg0) {
      const ret = getObject(arg0).signal;
      return addHeapObject(ret);
    },
    __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function () {
      const ret = typeof global === "undefined" ? null : global;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function () {
      const ret = typeof globalThis === "undefined" ? null : globalThis;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbg_static_accessor_SELF_f207c857566db248: function () {
      const ret = typeof self === "undefined" ? null : self;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function () {
      const ret = typeof window === "undefined" ? null : window;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbg_status_318629ab93a22955: function (arg0) {
      const ret = getObject(arg0).status;
      return ret;
    },
    __wbg_stringify_5ae93966a84901ac: function () {
      return handleError(function (arg0) {
        const ret = JSON.stringify(getObject(arg0));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_subarray_a068d24e39478a8a: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0);
      return addHeapObject(ret);
    },
    __wbg_text_372f5b91442c50f9: function () {
      return handleError(function (arg0) {
        const ret = getObject(arg0).text();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_then_098abe61755d12f6: function (arg0, arg1) {
      const ret = getObject(arg0).then(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_then_9e335f6dd892bc11: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    },
    __wbg_url_7fefc1820fba4e0c: function (arg0, arg1) {
      const ret = getObject(arg1).url;
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg_value_21fc78aab0322612: function (arg0) {
      const ret = getObject(arg0).value;
      return addHeapObject(ret);
    },
    __wbg_versions_276b2795b1c6a219: function (arg0) {
      const ret = getObject(arg0).versions;
      return addHeapObject(ret);
    },
    __wbg_view_f68a712e7315f8b2: function (arg0) {
      const ret = getObject(arg0).view;
      return isLikeNone(ret) ? 0 : addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000001: function (arg0, arg1) {
      // Cast intrinsic for `Closure(Closure { dtor_idx: 150, function: Function { arguments: [], shim_idx: 151, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
      const ret = makeMutClosure(
        arg0,
        arg1,
        wasm.__wasm_bindgen_func_elem_1335,
        __wasm_bindgen_func_elem_1338,
      );
      return addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000002: function (arg0, arg1) {
      // Cast intrinsic for `Closure(Closure { dtor_idx: 172, function: Function { arguments: [], shim_idx: 173, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
      const ret = makeMutClosure(
        arg0,
        arg1,
        wasm.__wasm_bindgen_func_elem_1565,
        __wasm_bindgen_func_elem_1572,
      );
      return addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000003: function (arg0, arg1) {
      // Cast intrinsic for `Closure(Closure { dtor_idx: 239, function: Function { arguments: [Externref], shim_idx: 259, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
      const ret = makeMutClosure(
        arg0,
        arg1,
        wasm.__wasm_bindgen_func_elem_1897,
        __wasm_bindgen_func_elem_2731,
      );
      return addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000004: function (arg0, arg1) {
      // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
      const ret = getArrayU8FromWasm0(arg0, arg1);
      return addHeapObject(ret);
    },
    __wbindgen_cast_0000000000000005: function (arg0, arg1) {
      // Cast intrinsic for `Ref(String) -> Externref`.
      const ret = getStringFromWasm0(arg0, arg1);
      return addHeapObject(ret);
    },
    __wbindgen_object_clone_ref: function (arg0) {
      const ret = getObject(arg0);
      return addHeapObject(ret);
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0);
    },
  };
  return {
    __proto__: null,
    "./yttrium_bg.js": import0,
  };
}

function __wasm_bindgen_func_elem_1338(arg0, arg1) {
  wasm.__wasm_bindgen_func_elem_1338(arg0, arg1);
}

function __wasm_bindgen_func_elem_1572(arg0, arg1) {
  wasm.__wasm_bindgen_func_elem_1572(arg0, arg1);
}

function __wasm_bindgen_func_elem_2731(arg0, arg1, arg2) {
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.__wasm_bindgen_func_elem_2731(retptr, arg0, arg1, addHeapObject(arg2));
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    if (r1) {
      throw takeObject(r0);
    }
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}

function __wasm_bindgen_func_elem_2733(arg0, arg1, arg2, arg3) {
  wasm.__wasm_bindgen_func_elem_2733(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
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
const IntoUnderlyingSinkFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));
const IntoUnderlyingSourceFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));
const PayJsonFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_payjson_free(ptr >>> 0, 1));

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

const CLOSURE_DTORS =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((state) => state.dtor(state.a, state.b));

function dropObject(idx) {
  if (idx < 1028) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
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

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getObject(idx) {
  return heap[idx];
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_export3(addHeapObject(e));
  }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
  return x === undefined || x === null;
}

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
      state.a = a;
      real._wbg_cb_unref();
    }
  };
  real._wbg_cb_unref = () => {
    if (--state.cnt === 0) {
      state.dtor(state.a, state.b);
      state.a = 0;
      CLOSURE_DTORS.unregister(state);
    }
  };
  CLOSURE_DTORS.register(real, state, state);
  return real;
}

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
    const ret = cachedTextEncoder.encodeInto(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length,
    };
  };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
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

  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (module_or_path === undefined) {
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

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
