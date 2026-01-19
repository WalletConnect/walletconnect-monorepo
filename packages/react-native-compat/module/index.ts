/* eslint-disable @typescript-eslint/no-require-imports */
import { NativeModules } from "react-native";

const LINKING_ERROR =
  `The package to get the RNWalletConnectModule doesn't seem to be linked. Make sure: \n\n` +
  "- You rebuilt the app after installing the package\n" +
  "- If you are using Expo: install expo-application \n";

const PAY_LINKING_ERROR =
  `The RNWalletConnectPay module doesn't seem to be linked. Make sure: \n\n` +
  "- You rebuilt the app after installing the package\n" +
  "- The Yttrium native dependency is properly installed\n";

const isTurboModuleEnabled = global.__turboModuleProxy != null;

const RNWalletConnectModule = isTurboModuleEnabled
  ? require("../module/NativeRNWalletConnectModule.ts").default
  : NativeModules.RNWalletConnectModule;

const RNWalletConnectPay = isTurboModuleEnabled
  ? require("../module/NativeRNWalletConnectPay.ts").default
  : NativeModules.RNWalletConnectPay;

function getExpoModule(): any | undefined {
  try {
    const ExpoApplication = require("expo-application");

    if (!ExpoApplication) throw new Error();

    return ExpoApplication;
  } catch {
    throw new Error();
  }
}

function getRNModule(): any | undefined {
  try {
    if (!RNWalletConnectModule) throw new Error();
    return RNWalletConnectModule;
  } catch {
    throw new Error();
  }
}

// Public
export function getApplicationModule(): any | undefined {
  try {
    return getRNModule();
  } catch (error) {
    try {
      return getExpoModule();
    } catch (error) {
      throw new Error(LINKING_ERROR);
    }
  }
}

/**
 * Get the WalletConnect Pay native module
 * @returns The RNWalletConnectPay native module or undefined if not available
 */
export function getPayModule(): any | undefined {
  try {
    if (!RNWalletConnectPay) throw new Error();
    return RNWalletConnectPay;
  } catch {
    return undefined;
  }
}

/**
 * Check if the Pay native module is available
 * @returns true if the Pay module is linked and available
 */
export function isPayModuleAvailable(): boolean {
  return RNWalletConnectPay != null;
}

/**
 * Get the WalletConnect Pay native module or throw if not available
 * @throws Error if the Pay module is not linked
 * @returns The RNWalletConnectPay native module
 */
export function requirePayModule(): any {
  if (!RNWalletConnectPay) {
    throw new Error(PAY_LINKING_ERROR);
  }
  return RNWalletConnectPay;
}
