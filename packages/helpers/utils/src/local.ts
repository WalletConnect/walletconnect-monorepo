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

export const setLocal = (key: string, data: any) => {
  const raw = safeJsonStringify(data);
  const local = getLocalStorage();
  if (local) {
    local.setItem(key, raw);
  }
};

export const getLocal = (key: string) => {
  let data = null;
  let raw = null;
  const local = getLocalStorage();
  if (local) {
    raw = local.getItem(key);
  }
  data = safeJsonParse(raw);
  return data;
};

export const removeLocal = (key: string) => {
  const local = getLocalStorage();
  if (local) {
    local.removeItem(key);
  }
};
