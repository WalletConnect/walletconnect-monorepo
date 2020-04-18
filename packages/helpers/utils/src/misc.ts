import * as encUtils from "enc-utils";

// -- Hex -------------------------------------------------- //

export function sanitizeHex(hex: string): string {
  return encUtils.sanitizeHex(hex);
}

export function addHexPrefix(hex: string): string {
  return encUtils.addHexPrefix(hex);
}

export function removeHexPrefix(hex: string): string {
  return encUtils.removeHexPrefix(hex);
}

export function removeHexLeadingZeros(hex: string): string {
  hex = encUtils.removeHexPrefix(hex);
  hex = hex.startsWith("0") ? hex.substring(1) : hex;
  hex = encUtils.addHexPrefix(hex);
  return hex;
}

// -- JSON -------------------------------------------------- //

export function safeJsonParse(value: any): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function safeJsonStringify(value: any): string {
  return typeof value === "string"
    ? value
    : JSON.stringify(value, (key: string, value: any) =>
        typeof value === "undefined" ? null : value,
      );
}

// -- id -------------------------------------------------- //

export function payloadId(): number {
  const datePart: number = new Date().getTime() * Math.pow(10, 3);
  const extraPart: number = Math.floor(Math.random() * Math.pow(10, 3));
  const id: number = datePart + extraPart;
  return id;
}

export function uuid(): string {
  const result: string = ((a?: any, b?: any) => {
    for (
      b = a = "";
      a++ < 36;
      b += (a * 51) & 52 ? (a ^ 15 ? 8 ^ (Math.random() * (a ^ 20 ? 16 : 4)) : 4).toString(16) : "-"
    ) {
      // empty
    }
    return b;
  })();
  return result;
}

// -- log -------------------------------------------------- //

export function logDeprecationWarning() {
  console.warn(
    "DEPRECATION WARNING: This WalletConnect client library will be deprecated in favor of @walletconnect/client. Please check docs.walletconnect.org to learn more about this migration!",
  );
}
