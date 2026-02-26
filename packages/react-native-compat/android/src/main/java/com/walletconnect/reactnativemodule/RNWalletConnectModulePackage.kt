package com.walletconnect.reactnativemodule

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.NativeModule
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.module.model.ReactModuleInfo
import java.util.HashMap

class RNWalletConnectModulePackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      RNWalletConnectModuleModule.NAME -> RNWalletConnectModuleModule(reactContext)
      RNWalletConnectPayModule.NAME -> RNWalletConnectPayModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
      val isTurboModule: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      
      // Existing WalletConnect module
      moduleInfos[RNWalletConnectModuleModule.NAME] = ReactModuleInfo(
        RNWalletConnectModuleModule.NAME,
        RNWalletConnectModuleModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        true,   // hasConstants
        false,  // isCxxModule
        isTurboModule // isTurboModule
      )
      
      // WalletConnect Pay module
      moduleInfos[RNWalletConnectPayModule.NAME] = ReactModuleInfo(
        RNWalletConnectPayModule.NAME,
        RNWalletConnectPayModule.NAME,
        false,  // canOverrideExistingModule
        false,  // needsEagerInit
        false,  // hasConstants
        false,  // isCxxModule
        isTurboModule // isTurboModule
      )
      
      moduleInfos
    }
  }
}
