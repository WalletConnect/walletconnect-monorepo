import { IMobileRegistryEntry, IAppRegistry, IAppEntry } from "@walletconnect/types";

const API_URL = "https://registry.walletconnect.com";

export function getWalletRegistryUrl(): string {
  return API_URL + "/api/v2/wallets";
}

export function getDappRegistryUrl(): string {
  return API_URL + "/api/v2/dapps";
}

export function formatMobileRegistryEntry(entry: IAppEntry, platform: "mobile" | "desktop" = "mobile"): IMobileRegistryEntry {
  return {
    name: entry.name || "",
    shortName: entry.metadata.shortName || "",
    color: entry.metadata.colors.primary || "",
    logo: entry.image_url.sm ? entry.image_url.sm : "",
    universalLink: entry[platform].universal || "",
    deepLink: entry[platform].native || "",
  };
}

export function formatMobileRegistry(registry: IAppRegistry, platform: "mobile" | "desktop" = "mobile"): IMobileRegistryEntry[] {
  return Object.values<any>(registry)
    .filter(entry => !!entry[platform].universal || !!entry[platform].native)
    .map((entry) => formatMobileRegistryEntry(entry, platform));
}
