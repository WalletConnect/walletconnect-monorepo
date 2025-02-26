package com.walletconnect.reactnativemodule

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import android.content.pm.PackageManager
import uniffi.uniffi_yttrium.ChainAbstractionClient
import kotlinx.coroutines.*
import com.facebook.react.bridge.ReadableMap
import uniffi.uniffi_yttrium.*
import uniffi.yttrium.*
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonElement

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



// ------------------------------ Yttrium Chain Abstraction ------------------------------

  private var availableResponseMap: MutableMap<String, RouteResponseAvailable> = mutableMapOf()


  @ReactMethod
  override fun prepare(params: ReadableMap, promise: Promise){
    System.out.println("checkRoute: Hello from YttriumModule")
    GlobalScope.launch(Dispatchers.Main) {
      try {
        var projectId = params.getString("projectId") as String 
        val transactionMap = params.getMap("transaction")
        var client = ChainAbstractionClient(projectId)
        
        if (transactionMap != null) {
          // Extract values from the nested transaction map
          val chainId = transactionMap.getString("chainId") ?: ""
          val txData = transactionMap.getString("data") ?: ""
          val from = transactionMap.getString("from") ?: ""
          val to = transactionMap.getString("to") ?: ""
          val value = transactionMap.getString("value") ?: "0"
          val tx = InitialTransaction(chainId, from, to, value, txData)
          val result = client.prepare(tx)
          System.out.println("checkRoute: result: ")
          System.out.println(result)
          when (result) {
            is PrepareResponse.Success -> {
              when (result.v1) {
                is RouteResponseSuccess.Available -> {
                  val availableResult = (result.v1 as RouteResponseSuccess.Available).v1
                  availableResponseMap[availableResult.orchestrationId] = availableResult
                  val gson = Gson()
                  val routesJson: JsonElement = gson.toJsonTree(availableResult)
                  val response = JsonObject()
                  response.addProperty("status", "available")
                  response.add("data", routesJson)
                  promise.resolve(gson.toJson(response))
                }
                is RouteResponseSuccess.NotRequired -> {
                  val response = JsonObject()
                  response.addProperty("status", "not_required")
                  val gson = Gson()
                  promise.resolve(gson.toJson(response))
                }
              }
            }
            is PrepareResponse.Error -> {
              System.out.println(result.v1.error.toString())
              when (result.v1.error.toString()) {
                "NO_ROUTES_AVAILABLE" -> {
                  val response = JsonObject()
                  response.addProperty("status", "error")
                  response.addProperty("reason", "noRoutesAvailable")
                  val gson = Gson()
                  promise.resolve(gson.toJson(response))
                }
                "INSUFFICIENT_FUNDS" -> {
                    val response = JsonObject()
                  response.addProperty("status", "error")
                  response.addProperty("reason", "insufficientFunds")
                  val gson = Gson()
                  promise.resolve(gson.toJson(response))
                }
                "INSUFFICIENT_GAS_FUNDS" -> {
                    val response = JsonObject()
                  response.addProperty("status", "error")
                  response.addProperty("reason", "insufficientGasFunds")
                  val gson = Gson()
                  promise.resolve(gson.toJson(response))
                }
              }
            }
          }

        }
        // Resolve the promise with the result
      } catch (e: Exception) {
        // In case of an error, reject the promise
        promise.reject("ERROR", "Yttrium checkRoute Error:" + e.message, e)
      }
    }
  }

  @ReactMethod
  override fun status(params: ReadableMap, promise: Promise){
    System.out.println("checkStatus: Hello from YttriumModule address")

    GlobalScope.launch(Dispatchers.Main) {
      try {

        var projectId = params.getString("projectId") as String
        var orchestrationId = params.getString("orchestrationId") as String
        var client = ChainAbstractionClient(projectId)

        when (val result = client.status(orchestrationId)) {
          is StatusResponse.Completed -> {
            when (result.v1) {
              is StatusResponseCompleted -> {
                val response = JsonObject()
                response.addProperty("status", "completed")
                response.addProperty("createdAt", result.v1.createdAt.toString())
                val gson = Gson()
                promise.resolve(gson.toJson(response))
              }
            }
          }

          is StatusResponse.Error -> {
            when (result.v1) {
              is StatusResponseError -> {
                val response = JsonObject()
                response.addProperty("status", "error")
                response.addProperty("createdAt", result.v1.createdAt.toString())
                response.addProperty("reason", result.v1.error.toString())
                val gson = Gson()
                promise.resolve(gson.toJson(response))
              }
            }
          }

          is StatusResponse.Pending -> {
            when (result.v1) {
              is StatusResponsePending -> {
                val response = JsonObject()
                response.addProperty("status", "pending")
                response.addProperty("createdAt", result.v1.createdAt.toString())
                response.addProperty("checkIn", result.v1.checkIn.toString())
                val gson = Gson()
                promise.resolve(gson.toJson(response))
              }
            }
          }
        }
      } catch (e: Exception) {
        // In case of an error, reject the promise
        promise.reject("ERROR", "Yttrium checkStatus Error:" + e.message, e)
      }
    }
  }

  @ReactMethod
  override fun getBridgeDetails(params: ReadableMap, promise: Promise){
    System.out.println("getFulfilmentDetails: Hello from YttriumModule address")

    GlobalScope.launch(Dispatchers.Main) {
      try {

        val projectId = params.getString("projectId") as String
        val orchestrationId = params.getString("orchestrationId") as String
        val client = ChainAbstractionClient(projectId)

        val availableResult = availableResponseMap[orchestrationId] as RouteResponseAvailable
        val uiFields = client.getUiFields(availableResult, Currency.USD)
        val gson = Gson()
        val resultJson: JsonElement = gson.toJsonTree(uiFields)
        promise.resolve(gson.toJson(resultJson))
      } catch (e: Exception) {
        // In case of an error, reject the promise
        promise.reject("ERROR", "Yttrium getFulfilmentDetails Error:" + e.message, e)
      }
    }
  }

  @ReactMethod
  override fun getERC20Balance(params: ReadableMap, promise: Promise){
    System.out.println("getERC20Balance: Hello from YttriumModule address")

    GlobalScope.launch(Dispatchers.Main) {
      try {

        val projectId = params.getString("projectId") as String
        val tokenAddress = params.getString("tokenAddress") as String
        val ownerAddress = params.getString("ownerAddress") as String
        val chainId = params.getString("chainId") as String
        val client = ChainAbstractionClient(projectId)
        val result = client.erc20TokenBalance(chainId, tokenAddress, ownerAddress)
        val gson = Gson()
        val resultJson: JsonElement = gson.toJsonTree(result)
        promise.resolve(gson.toJson(resultJson))
      } catch (e: Exception) {
        // In case of an error, reject the promise
        promise.reject("ERROR", "Yttrium getERC20Balance Error:" + e.message, e)
      }
    }
  }

  @ReactMethod
  override fun estimateFees(params: ReadableMap, promise: Promise){
    System.out.println("estimateFees: Hello from YttriumModule address")

    GlobalScope.launch(Dispatchers.Main) {
      try {

        val projectId = params.getString("projectId") as String
        val chainId = params.getString("chainId") as String
        val client = ChainAbstractionClient(projectId)
        val result = client.estimateFees(chainId)
        val gson = Gson()
        val resultJson: JsonElement = gson.toJsonTree(result)
        promise.resolve(gson.toJson(resultJson))
      } catch (e: Exception) {
        // In case of an error, reject the promise
        promise.reject("ERROR", "Yttrium estimateFees Error:" + e.message, e)
      }
    }
  }

  companion object {
    const val NAME = "RNWalletConnectModule"
  }
}
