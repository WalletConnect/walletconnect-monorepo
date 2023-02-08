import {
  IMobileRegistryEntry,
  IMobileRegistry,
  IMobileLinkInfo,
  MOBILE_LINK_CHOICE_KEY,
} from "@walletconnect/legacy-types";

import { setLocal } from "./local";

export function formatIOSMobile(uri: string, entry: IMobileRegistryEntry) {
  const encodedUri: string = encodeURIComponent(uri);
  return entry.universalLink
    ? `${entry.universalLink}/wc?uri=${encodedUri}`
    : entry.deepLink
    ? `${entry.deepLink}${entry.deepLink.endsWith(":") ? "//" : "/"}wc?uri=${encodedUri}`
    : "";
}

export function saveMobileLinkInfo(data: IMobileLinkInfo) {
  const focusUri = data.href.split("?")[0];
  setLocal(MOBILE_LINK_CHOICE_KEY, { ...data, href: focusUri });
}

export function getMobileRegistryEntry(
  registry: IMobileRegistry,
  name: string,
): IMobileRegistryEntry {
  return registry.filter((entry: IMobileRegistryEntry) =>
    entry.name.toLowerCase().includes(name.toLowerCase()),
  )[0];
}

export function getMobileLinkRegistry(registry: IMobileRegistry, whitelist?: string[]) {
  let links = registry;
  if (whitelist) {
    links = whitelist.map((name: string) => getMobileRegistryEntry(registry, name)).filter(Boolean);
  }
  return links;
}
