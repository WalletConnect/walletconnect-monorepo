export function unsafeGetFromWindow<T>(name: string): T | undefined {
  let res: T | undefined = undefined;
  if (typeof window !== "undefined" && typeof window[name] !== "undefined") {
    res = window[name];
  }
  return res;
}

export function safeGetFromWindow<T>(name: string): T {
  const res = unsafeGetFromWindow<T>(name);
  if (!res) {
    throw new Error(`${name} is not defined in Window`);
  }
  return res;
}

export function getDocument(): Document {
  return safeGetFromWindow<Document>("document");
}

export function getNavigator(): Navigator {
  return safeGetFromWindow<Navigator>("navigator");
}

export function getLocation(): Location {
  return safeGetFromWindow<Location>("location");
}
