import { safeJsonParse, safeJsonStringify } from "./json";
import { getLocalStorage } from "./window";

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
  data = raw ? safeJsonParse(raw) : raw;
  return data;
}

export function removeLocal(key: string): void {
  const local = getLocalStorage();
  if (local) {
    local.removeItem(key);
  }
}
