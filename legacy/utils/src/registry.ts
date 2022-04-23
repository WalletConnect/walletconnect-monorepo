import { IMobileRegistryEntry, IAppRegistry, IAppEntry } from "@walletconnect/legacy-types";

const API_URL = "https://registry.walletconnect.org";

export function getWalletRegistryUrl(): string {
  return API_URL + "/data/wallets.json";
}

export function getDappRegistryUrl(): string {
  return API_URL + "/data/dapps.json";
}

export function getAppLogoUrl(id: string): string {
  return API_URL + "/logo/sm/" + id + ".jpeg";
}

export function formatMobileRegistryEntry(
  entry: IAppEntry,
  platform: "mobile" | "desktop" = "mobile",
): IMobileRegistryEntry {
  return {
    name: entry.name || "",
    shortName: entry.metadata.shortName || "",
    color: entry.metadata.colors.primary || "",
    logo: entry.id ? getAppLogoUrl(entry.id) : "",
    universalLink: entry[platform].universal || "",
    deepLink: entry[platform].native || "",
  };
}

export function formatMobileRegistry(
  registry: IAppRegistry,
  platform: "mobile" | "desktop" = "mobile",
): IMobileRegistryEntry[] {
  return Object.values<any>(registry)
    .filter(entry => !!entry[platform].universal || !!entry[platform].native)
    .map(entry => formatMobileRegistryEntry(entry, platform));
}
