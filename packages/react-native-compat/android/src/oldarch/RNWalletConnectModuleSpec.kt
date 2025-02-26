package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap

abstract class RNWalletConnectModuleSpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun isAppInstalled(packageName: String?, promise: Promise);
  abstract fun prepare(params: ReadableMap, promise: Promise);
  abstract fun status(params: ReadableMap, promise: Promise);
  abstract fun getBridgeDetails(params: ReadableMap, promise: Promise);
  abstract fun estimateFees(params: ReadableMap, promise: Promise);
  abstract fun getERC20Balance(params: ReadableMap, promise: Promise);

  protected abstract fun getTypedExportedConstants(): Map<String, String>

  override fun getConstants(): Map<String, String> {
    val constants: Map<String, String> = getTypedExportedConstants()
    return constants
  }
}
