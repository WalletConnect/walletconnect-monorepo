import { safeJsonParse, safeJsonStringify } from "./misc";

function getLocalStorage(): Storage | undefined {
  let local: Storage | undefined;
  try {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      local = window.localStorage;
    }
  } catch (e) {
    // do nothing
  }
  return local;
}

export function setLocal(key: string, data: any): void {
  const raw = safeJsonStringify(data);
  const local = getLocalStorage();
  if (local) {
    local.setItem(key, raw);
  }
}

export function getLocal(key: string): any {
  let data: any = null;
  let raw: string | null = null;
  const local = getLocalStorage();
  if (local) {
    raw = local.getItem(key);
  }
  data = safeJsonParse(raw);
  return data;
}

export function removeLocal(key: string): void {
  const local = getLocalStorage();
  if (local) {
    local.removeItem(key);
  }
}
