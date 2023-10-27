import { NativeModules, Platform, Linking } from "react-native";

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

function isAppInstalledIos(bundleId?: string): Promise<boolean> {
  try {
    let formattedBundleId = bundleId;
    if (!bundleId?.endsWith("://")) {
      formattedBundleId = `${bundleId}://`;
    }
    return formattedBundleId ? Linking.canOpenURL(formattedBundleId) : Promise.resolve(false);
  } catch (error) {
    return Promise.resolve(false);
  }
}

function isAppInstalledAndroid(packageName?: string): Promise<boolean> {
  try {
    return packageName ? getRNModule()?.isAppInstalled(packageName) : Promise.resolve(false);
  } catch (error) {
    return Promise.resolve(false);
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

export function isAppInstalled(iosScheme?: string, androidPackageName?: string): Promise<boolean> {
  try {
    return Platform.select({
      ios: isAppInstalledIos(iosScheme),
      android: isAppInstalledAndroid(androidPackageName),
      default: Promise.resolve(false),
    });
  } catch (error) {
    Promise.resolve(false);
  }

  return Promise.resolve(false);
}
