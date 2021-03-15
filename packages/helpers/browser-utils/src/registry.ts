import { IMobileRegistryEntry, IAppRegistry, IAppEntry } from "@walletconnect/types";

const API_URL = "https://registry.walletconnect.org/api/";

export function getWalletRegistryUrl(): string {
  return API_URL + "/registry/wallets";
}

export function getAppRegistryUrl(): string {
  return API_URL + "/registry/dapps";
}

export function getAppLogoUrl(id): string {
  return API_URL + "/logo/" + id;
}

export function formatMobileRegistryEntry(entry: IAppEntry): IMobileRegistryEntry {
  return {
    name: entry.name || "",
    shortName: entry.metadata.shortName || "",
    color: entry.metadata.colors.primary || "",
    logo: entry.id ? getAppLogoUrl(entry.id) : "",
    universalLink: entry.mobile.universal || "",
    deepLink: entry.mobile.native || "",
  };
}

export function formatMobileRegistry(registry: IAppRegistry): IMobileRegistryEntry[] {
  return Object.values<any>(registry)
    .filter(entry => !!entry.mobile.universal || !!entry.mobile.native)
    .map(formatMobileRegistryEntry);
}
