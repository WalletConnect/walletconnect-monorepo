import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  isAppInstalled(bundleId?: string): Promise<boolean>;
  /**
   * Returns the subset of `identifiers` that are installed, in a single native call.
   * iOS: URL schemes (must be declared in LSApplicationQueriesSchemes). Android: package names.
   */
  getInstalledApps(identifiers: string[]): Promise<string[]>;
  getConstants(): {
    applicationName: string;
    applicationId: string;
  };
}

export default TurboModuleRegistry.get<Spec>("RNWalletConnectModule");
