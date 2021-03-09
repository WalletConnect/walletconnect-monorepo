import { IAppEntry, IAppRegistry, IMobileRegistryEntry } from "@walletconnect/types";

const API_URL = "https://registry.walletconnect.org";

export function getWalletRegistryUrl(): string {
  return API_URL + "/data/wallets.json";
}

export function getDappRegistryUrl(): string {
  return API_URL + "/data/dapps.json";
}

export function getAppLogoUrl(id): string {
  return API_URL + "/logo/sm/" + id + ".jpeg";
}

export function formatMobileRegistryEntry(entry: IAppEntry): IMobileRegistryEntry {
  return {
    color: entry.metadata.colors.primary || "",
    deepLink: entry.mobile.native || "",
    logo: entry.id ? getAppLogoUrl(entry.id) : "",
    name: entry.name || "",
    shortName: entry.metadata.shortName || "",
    universalLink: entry.mobile.universal || "",
  };
}

export function formatMobileRegistry(registry: IAppRegistry): IMobileRegistryEntry[] {
  return Object.values<any>(registry)
    .filter((entry) => !!entry.mobile.universal || !!entry.mobile.native)
    .map(formatMobileRegistryEntry);
}
