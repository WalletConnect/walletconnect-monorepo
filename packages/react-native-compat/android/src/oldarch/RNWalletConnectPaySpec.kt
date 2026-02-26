package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.Promise

abstract class RNWalletConnectPaySpec internal constructor(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  abstract fun initialize(configJson: String)
  abstract fun getPaymentOptions(requestJson: String, promise: Promise)
  abstract fun getRequiredPaymentActions(requestJson: String, promise: Promise)
  abstract fun confirmPayment(requestJson: String, promise: Promise)
}
