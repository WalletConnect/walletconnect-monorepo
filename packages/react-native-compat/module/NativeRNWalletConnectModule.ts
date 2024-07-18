import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  isAppInstalled(bundleId?: string): Promise<boolean>;
  getConstants(): {
    applicationName: string;
    applicationId: string;
  };
}

export default TurboModuleRegistry.getEnforcing<Spec>("RNWalletConnectModule");
