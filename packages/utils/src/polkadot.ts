import { base58 } from "@scure/base";
import { blake2b } from "blakejs";

export function ss58AddressToPublicKey(address: string): Uint8Array {
  const decoded = base58.decode(address);
  if (decoded.length < 33) throw new Error("Too short to contain a public key");
  return decoded.slice(1, 33);
}

export function addSignatureToExtrinsic({
  publicKey,
  signature,
  payload,
}: {
  publicKey: Uint8Array;
  signature: Uint8Array;
  payload: any;
}): Uint8Array {
  const method = hexToBytes(payload.method);
  const version = parseInt(payload.version?.toString() || "4");
  const extrinsicVersion = 0x80 | version;

  const signatureType = guessSignatureTypeFromAddress(payload.address);

  const era = payload.era === "00" ? new Uint8Array([0x00]) : hexToBytes(payload.era);
  if (era.length !== 1 && era.length !== 2) throw new Error("Invalid era length");

  const nonce = parseInt(payload.nonce, 16);
  const nonceBytes = new Uint8Array([nonce & 0xff, (nonce >> 8) & 0xff]);

  const tip = BigInt(`0x${normalizeHex(payload.tip)}`);
  const tipBytes = compactEncodeBigInt(tip);

  const body = new Uint8Array([
    0x00, // MultiAddress::Id
    ...publicKey,
    signatureType,
    ...signature,
    ...era,
    ...nonceBytes,
    ...tipBytes,
    ...method,
  ]);

  const lengthPrefix = compactEncodeInt(body.length + 1);
  return new Uint8Array([...lengthPrefix, extrinsicVersion, ...body]);
}

export function deriveExtrinsicHash(signedExtrinsicHex: string): string {
  const bytes = hexToBytes(signedExtrinsicHex);
  const hash = blake2b(bytes, undefined, 32);
  return "0x" + Buffer.from(hash).toString("hex");
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex
      .replace(/^0x/, "")
      .match(/.{1,2}/g)!
      .map((byte) => parseInt(byte, 16)),
  );
}

function normalizeHex(input: string): string {
  return input.startsWith("0x") ? input.slice(2) : input;
}

function guessSignatureTypeFromAddress(address: string): number {
  const decoded = base58.decode(address);
  const prefix = decoded[0];
  if (prefix === 42) return 0x00; // Ed25519
  if (prefix === 60) return 0x02; // Secp256k1
  return 0x01; // Default Sr25519
}

function compactEncodeInt(value: number): Uint8Array {
  if (value < 1 << 6) {
    return new Uint8Array([value << 2]);
  } else if (value < 1 << 14) {
    const val = (value << 2) | 0x01;
    return new Uint8Array([val & 0xff, (val >> 8) & 0xff]);
  } else if (value < 1 << 30) {
    const val = (value << 2) | 0x02;
    return new Uint8Array([val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff]);
  } else {
    throw new Error("Compact encoding > 2^30 not supported");
  }
}

function compactEncodeBigInt(value: bigint): Uint8Array {
  if (value < 1n << 6n) {
    return new Uint8Array([Number(value << 2n)]);
  } else if (value < 1n << 14n) {
    const val = (value << 2n) | 0x01n;
    return new Uint8Array([Number(val & 0xffn), Number((val >> 8n) & 0xffn)]);
  } else if (value < 1n << 30n) {
    const val = (value << 2n) | 0x02n;
    return new Uint8Array([
      Number(val & 0xffn),
      Number((val >> 8n) & 0xffn),
      Number((val >> 16n) & 0xffn),
      Number((val >> 24n) & 0xffn),
    ]);
  } else {
    throw new Error("BigInt compact encoding not supported > 2^30");
  }
}

export function buildSignedExtrinsicHash(payload: {
  transaction: {
    method: string;
    era: string;
    nonce: string;
    tip: string;
    mode: string;
    address: string;
    version: number;
  };
  signature: string;
}) {
  const signature = Uint8Array.from(Buffer.from(payload.signature, "hex"));

  const publicKey = ss58AddressToPublicKey(payload.transaction.address);
  const signed = addSignatureToExtrinsic({ publicKey, signature, payload: payload.transaction });
  const hexSigned = Buffer.from(signed).toString("hex");
  const hash = deriveExtrinsicHash(hexSigned);

  return hash;
}
