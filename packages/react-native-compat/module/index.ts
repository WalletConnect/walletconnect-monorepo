import { NativeModules } from "react-native";

const LINKING_ERROR =
  `The package to get the RNWalletConnectModule doesn't seem to be linked. Make sure: \n\n` +
  "- You rebuilt the app after installing the package\n" +
  "- If you are using Expo: install expo-application \n";

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const RNWalletConnectModule = isTurboModuleEnabled
  ? require("../module/NativeRNWalletConnectModule").default
  : NativeModules.RNWalletConnectModule;

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
