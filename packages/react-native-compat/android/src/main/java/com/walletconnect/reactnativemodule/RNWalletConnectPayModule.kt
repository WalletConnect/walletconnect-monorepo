package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import kotlinx.coroutines.*
import uniffi.yttrium_wcpay.WalletConnectPayJson

/**
 * React Native module for WalletConnect Pay
 * Wraps the uniffi-generated WalletConnectPayJson Rust client
 */
class RNWalletConnectPayModule internal constructor(context: ReactApplicationContext) :
  RNWalletConnectPaySpec(context) {

  private var client: WalletConnectPayJson? = null
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  override fun getName(): String = NAME

  /**
   * Initialize the Pay client with SDK configuration
   * @param configJson JSON string containing SDK config:
   *   {
   *     "baseUrl": string,
   *     "projectId": string,
   *     "apiKey": string,
   *     "sdkName": string,
   *     "sdkVersion": string,
   *     "sdkPlatform": string,
   *     "bundleId": string
   *   }
   */
  @ReactMethod
  override fun initialize(configJson: String) {
    try {
      client = WalletConnectPayJson(configJson)
    } catch (e: Exception) {
      // Log error but don't throw - let subsequent calls fail with "not initialized"
      android.util.Log.e(NAME, "Failed to initialize Pay client: ${e.message}", e)
    }
  }

  /**
   * Get payment options for a payment link
   * @param requestJson JSON string:
   *   { "paymentLink": string, "accounts": string[], "includePaymentInfo"?: boolean }
   * @param promise Resolves with JSON string of PaymentOptionsResponse
   */
  @ReactMethod
  override fun getPaymentOptions(requestJson: String, promise: Promise) {
    val currentClient = client
    if (currentClient == null) {
      promise.reject("PAY_ERROR", "Pay client not initialized. Call initialize() first.")
      return
    }

    scope.launch {
      try {
        val result = currentClient.getPaymentOptions(requestJson)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("PAY_ERROR", e.message ?: "Unknown error", e)
      }
    }
  }

  /**
   * Get required payment actions for a selected option
   * @param requestJson JSON string:
   *   { "paymentId": string, "optionId": string }
   * @param promise Resolves with JSON string array of Action
   */
  @ReactMethod
  override fun getRequiredPaymentActions(requestJson: String, promise: Promise) {
    val currentClient = client
    if (currentClient == null) {
      promise.reject("PAY_ERROR", "Pay client not initialized. Call initialize() first.")
      return
    }

    scope.launch {
      try {
        val result = currentClient.getRequiredPaymentActions(requestJson)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("PAY_ERROR", e.message ?: "Unknown error", e)
      }
    }
  }

  /**
   * Confirm a payment with signatures
   * @param requestJson JSON string:
   *   {
   *     "paymentId": string,
   *     "optionId": string,
   *     "signatures": string[],
   *     "collectedData"?: [{ "id": string, "value": string }]
   *   }
   * @param promise Resolves with JSON string of ConfirmPaymentResponse
   */
  @ReactMethod
  override fun confirmPayment(requestJson: String, promise: Promise) {
    val currentClient = client
    if (currentClient == null) {
      promise.reject("PAY_ERROR", "Pay client not initialized. Call initialize() first.")
      return
    }

    scope.launch {
      try {
        val result = currentClient.confirmPayment(requestJson)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("PAY_ERROR", e.message ?: "Unknown error", e)
      }
    }
  }

  /**
   * Clean up coroutine scope when module is destroyed
   */
  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  companion object {
    const val NAME = "RNWalletConnectPay"
  }
}
