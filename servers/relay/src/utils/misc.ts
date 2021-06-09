import * as crypto from "crypto";
import * as encUtils from "enc-utils";

export function assertType(obj: any, key: string, type = "string") {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

export function generateRandomBytes32(): string {
  return encUtils.bufferToHex(crypto.randomBytes(32));
}

export function sha256(data: string): string {
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");
}

export function isFloat(num: number): boolean {
  return num % 1 != 0;
}
