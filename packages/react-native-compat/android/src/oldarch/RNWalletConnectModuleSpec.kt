package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise

abstract class RNWalletConnectModuleSpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun isAppInstalled(packageName: String?, promise: Promise);
  protected abstract fun getTypedExportedConstants(): Map<String, String>

  override fun getConstants(): Map<String, String> {
    val constants: Map<String, String> = getTypedExportedConstants()
    return constants
  }
}
