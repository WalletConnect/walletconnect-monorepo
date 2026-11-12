package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import android.content.pm.PackageManager

class RNWalletConnectModuleModule internal constructor(context: ReactApplicationContext) :
  RNWalletConnectModuleSpec(context) {

  override fun getName(): String {
    return NAME
  }

  override protected fun getTypedExportedConstants(): Map<String, String> {
    var appName: String

    try {
      appName = getReactApplicationContext().getApplicationInfo()
        .loadLabel(getReactApplicationContext().getPackageManager()).toString()
    } catch (e: Exception) {
      appName = "unknown"
    }

    val constants: MutableMap<String, String> = HashMap()
    constants.put("applicationId", getReactApplicationContext().getPackageName());
    constants.put("applicationName", appName);
    return constants
  }

  @ReactMethod
  override fun isAppInstalled(packageName: String?, promise: Promise) {
    try {
        val installed = packageName?.let { isPackageInstalled(it) } ?: false
        promise.resolve(installed)
    } catch (e: Exception) {
        promise.resolve(false)
    }
  }

  @ReactMethod
  override fun getInstalledApps(identifiers: ReadableArray, promise: Promise) {
    val installed = Arguments.createArray()
    try {
      for (i in 0 until identifiers.size()) {
        if (identifiers.getType(i) != ReadableType.String) continue
        val packageName = identifiers.getString(i)
        if (packageName.isNullOrBlank()) continue
        if (isPackageInstalled(packageName)) installed.pushString(packageName)
      }
    } catch (e: Exception) {
      // Never reject: return whatever was found before the failure.
    }
    promise.resolve(installed)
  }

  private fun isPackageInstalled(packageName: String): Boolean {
    val manager: PackageManager = getReactApplicationContext().getPackageManager()
    return try {
      @Suppress("DEPRECATION")
      manager.getPackageInfo(packageName, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  companion object {
    const val NAME = "RNWalletConnectModule"
  }
}
