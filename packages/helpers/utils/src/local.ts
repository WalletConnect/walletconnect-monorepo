import { safeJsonParse, safeJsonStringify } from "./misc";
import { getLocalStorageUnsafe } from "./browser";

export function setLocal(key: string, data: any): void {
  const raw = safeJsonStringify(data);
  const local = getLocalStorageUnsafe();
  if (local) {
    local.setItem(key, raw);
  }
}

export function getLocal(key: string): any {
  let data: any = null;
  let raw: string | null = null;
  const local = getLocalStorageUnsafe();
  if (local) {
    raw = local.getItem(key);
  }
  data = safeJsonParse(raw);
  return data;
}

export function removeLocal(key: string): void {
  const local = getLocalStorageUnsafe();
  if (local) {
    local.removeItem(key);
  }
}
