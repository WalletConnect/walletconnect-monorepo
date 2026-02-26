import { expect, describe, it } from "vitest";
import { toString, fromString } from "uint8arrays";
import { safeJsonStringify } from "@walletconnect/safe-json";
import * as x25519 from "@stablelib/x25519";
import Sinon from "sinon";

import {
  BASE16,
  encrypt,
  decrypt,
  encodeTypeTwoEnvelope,
  decodeTypeTwoEnvelope,
  deriveSymKey,
  deserialize,
  generateKeyPair,
  hashKey,
  hashMessage,
  validateDecoding,
  isTypeOneEnvelope,
  generateRandomBytes32,
  BASE64URL,
  verifyP256Jwt,
} from "../src";

import { TEST_KEY_PAIRS, TEST_SHARED_KEY, TEST_HASHED_KEY, TEST_SYM_KEY } from "./shared";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});

const TEST_SELF = TEST_KEY_PAIRS.A;
const TEST_PEER = TEST_KEY_PAIRS.B;

const TEST_IV = "717765636661617364616473";

const TEST_SEALED =
  "7a5a1e843debf98b01d6a75718b5ee27115eafa3caba9703ca1c5601a6af2419045320faec2073cc8b6b8dc439e63e21612ff3883c867e0bdcd72c833eb7f7bb2034a9ec35c2fb03d93732";

const TEST_ENCODED_TYPE_0 =
  "AHF3ZWNmYWFzZGFkc3paHoQ96/mLAdanVxi17icRXq+jyrqXA8ocVgGmryQZBFMg+uwgc8yLa43EOeY+IWEv84g8hn4L3Ncsgz6397sgNKnsNcL7A9k3Mg==";

const TEST_ENCODED_TYPE_0_BASE64URL =
  "AHF3ZWNmYWFzZGFkc3paHoQ96_mLAdanVxi17icRXq-jyrqXA8ocVgGmryQZBFMg-uwgc8yLa43EOeY-IWEv84g8hn4L3Ncsgz6397sgNKnsNcL7A9k3Mg";

const TEST_ENCODED_TYPE_1 =
  "Af96fVdnw2KwoXrZIpnr23gx3L2aVpWcATaMdARUOzNCcXdlY2ZhYXNkYWRzeloehD3r+YsB1qdXGLXuJxFer6PKupcDyhxWAaavJBkEUyD67CBzzItrjcQ55j4hYS/ziDyGfgvc1yyDPrf3uyA0qew1wvsD2Tcy";

const TEST_ENCODED_TYPE_1_BASE64URL =
  "Af96fVdnw2KwoXrZIpnr23gx3L2aVpWcATaMdARUOzNCcXdlY2ZhYXNkYWRzeloehD3r-YsB1qdXGLXuJxFer6PKupcDyhxWAaavJBkEUyD67CBzzItrjcQ55j4hYS_ziDyGfgvc1yyDPrf3uyA0qew1wvsD2Tcy";

const TEST_ENCODED_TYPE_2 =
  "AnsiaWQiOjEsImpzb25ycGMiOiIyLjAiLCJtZXRob2QiOiJ0ZXN0X21ldGhvZCIsInBhcmFtcyI6e319";

const TEST_HASHED_MESSAGE = "15112289b5b794e68d1ea3cd91330db55582a37d0596f7b99ea8becdf9d10496";

describe("Crypto", () => {
  it("generateRandomBytes32", () => {
    const bytes = generateRandomBytes32();
    expect(bytes).to.not.be.undefined;
    expect(bytes.length).to.eql(64); // hex
  });
  it("generateKeyPair", () => {
    const keyPair = generateKeyPair();
    expect(keyPair).to.not.be.undefined;
    expect(keyPair.privateKey).to.not.be.undefined;
    expect(keyPair.publicKey).to.not.be.undefined;
    expect(keyPair.privateKey.length).to.eql(64);
    expect(keyPair.publicKey.length).to.eql(64);
  });
  it("generateKeyPair (cross-test)", () => {
    // Since pairs generated randomly, we cannot test them, only reasonable thing to test is
    // interoperability between old library and new.
    const keyPair = generateKeyPair();
    const stableKeyPair = x25519.generateKeyPair();
    const stablePrivateKey = toString(stableKeyPair.secretKey, BASE16);
    const stablePublicKey = toString(stableKeyPair.publicKey, BASE16);
    const sharedKeyA = x25519.sharedKey(
      fromString(keyPair.privateKey, BASE16),
      fromString(stablePublicKey, BASE16),
      true,
    );
    const sharedKeyB = x25519.sharedKey(
      fromString(stablePrivateKey, BASE16),
      fromString(keyPair.publicKey, BASE16),
      true,
    );
    expect(sharedKeyA).to.eql(sharedKeyB);
  });
  it("generateKeyPair (same random)", () => {
    // Check if returns same key if random is same
    const random = new Uint8Array(32).fill(1);
    const randomValuesStub = Sinon.stub(crypto, "getRandomValues").returns(random);
    const stableKeyPair = x25519.generateKeyPair({
      isAvailable: true,
      randomBytes(length: number) {
        return new Uint8Array(length).fill(1);
      },
    });
    const stablePrivateKey = toString(stableKeyPair.secretKey, BASE16);
    const stablePublicKey = toString(stableKeyPair.publicKey, BASE16);
    const keyPair = generateKeyPair();
    expect(keyPair.privateKey).to.eql(stablePrivateKey);
    expect(keyPair.publicKey).to.eql(stablePublicKey);
    expect(randomValuesStub.calledOnce).toBe(true);
    randomValuesStub.restore();
  });
  it("deriveSymKey", () => {
    const symKeyA = deriveSymKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    expect(symKeyA).to.eql(TEST_SYM_KEY);
    const symKeyB = deriveSymKey(TEST_PEER.privateKey, TEST_SELF.publicKey);
    expect(symKeyB).to.eql(TEST_SYM_KEY);
  });
  it("hashKey", () => {
    const hashedKey = hashKey(TEST_SHARED_KEY);
    expect(hashedKey).to.eql(TEST_HASHED_KEY);
  });
  it("hashMessage", () => {
    const hashedMessage = hashMessage(TEST_MESSAGE);
    expect(hashedMessage).to.eql(TEST_HASHED_MESSAGE);
  });
  it("encrypt (type 0)", () => {
    const encoded = encrypt({ symKey: TEST_SYM_KEY, message: TEST_MESSAGE, iv: TEST_IV });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_0);
    const deserialized = deserialize({ encoded });
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 0)", () => {
    const decrypted = decrypt({ symKey: TEST_SYM_KEY, encoded: TEST_ENCODED_TYPE_0 });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("encrypt (type 0) for link-mode", () => {
    const encoding = BASE64URL;
    const encoded = encrypt({ symKey: TEST_SYM_KEY, message: TEST_MESSAGE, iv: TEST_IV, encoding });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_0_BASE64URL);
    const deserialized = deserialize({ encoded, encoding });
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 0) for link-mode", () => {
    const encoding = BASE64URL;
    const decrypted = decrypt({
      symKey: TEST_SYM_KEY,
      encoded: TEST_ENCODED_TYPE_0_BASE64URL,
      encoding,
    });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("encrypt (type 1)", () => {
    const encoded = encrypt({
      type: 1,
      symKey: TEST_SYM_KEY,
      senderPublicKey: TEST_SELF.publicKey,
      message: TEST_MESSAGE,
      iv: TEST_IV,
    });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_1);
    const deserialized = deserialize({ encoded });
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 1)", () => {
    const encoded = TEST_ENCODED_TYPE_1;
    const params = validateDecoding(encoded, {
      receiverPublicKey: TEST_PEER.publicKey,
    });
    expect(isTypeOneEnvelope(params)).to.eql(true);
    if (!isTypeOneEnvelope(params)) return;
    expect(params.type).to.eql(1);
    expect(params.senderPublicKey).to.eql(TEST_SELF.publicKey);
    expect(params.receiverPublicKey).to.eql(TEST_PEER.publicKey);
    const symKey = deriveSymKey(TEST_PEER.privateKey, params.senderPublicKey);
    expect(symKey).to.eql(TEST_SYM_KEY);
    const decrypted = decrypt({ symKey, encoded });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("encrypt (type 1) for link-mode", () => {
    const encoding = BASE64URL;
    const encoded = encrypt({
      type: 1,
      symKey: TEST_SYM_KEY,
      senderPublicKey: TEST_SELF.publicKey,
      message: TEST_MESSAGE,
      iv: TEST_IV,
      encoding,
    });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_1_BASE64URL);
    const deserialized = deserialize({ encoded, encoding });
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 1) for link-mode", () => {
    const encoding = BASE64URL;
    const encoded = TEST_ENCODED_TYPE_1_BASE64URL;
    const params = validateDecoding(encoded, {
      receiverPublicKey: TEST_PEER.publicKey,
      encoding,
    });
    expect(isTypeOneEnvelope(params)).to.eql(true);
    if (!isTypeOneEnvelope(params)) return;
    expect(params.type).to.eql(1);
    expect(params.senderPublicKey).to.eql(TEST_SELF.publicKey);
    expect(params.receiverPublicKey).to.eql(TEST_PEER.publicKey);
    const symKey = deriveSymKey(TEST_PEER.privateKey, params.senderPublicKey);
    expect(symKey).to.eql(TEST_SYM_KEY);
    const decrypted = decrypt({ symKey, encoded, encoding });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("encode (type 2) for link-mode", () => {
    const encoded = encodeTypeTwoEnvelope(TEST_MESSAGE, BASE64URL);
    expect(encoded).to.eql(TEST_ENCODED_TYPE_2);
  });
  it("decode (type 2) for link-mode", () => {
    const decoded = decodeTypeTwoEnvelope(TEST_ENCODED_TYPE_2, BASE64URL);
    expect(decoded).to.eql(TEST_MESSAGE);
  });
  it("calls generateRandomBytes32", () => {
    expect(generateRandomBytes32()).toBeTruthy();
  });
  it("should validate verify v2 jwt", async () => {
    const token =
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjM2MzI1MDQsImlkIjoiMDkxN2YzMzk0YTdmMzkyZTg3ZTM1ZjM4OTg2OWU2NDEzZjkyNTBlMGIxZTE4YjUzMDhkNzBhM2VjOTJjZDQ3OCIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImlzU2NhbSI6bnVsbCwiaXNWZXJpZmllZCI6ZmFsc2V9.RehA28c0Ae8D_ixvGS8uG9J9eTJtpGfaC_7kNE9ZNAVFREWBY6Dl_SXc0_E0RSvYkHpupfmXlmjenuDqNcyoeg";

    const publicKey = {
      publicKey: {
        crv: "P-256",
        ext: true,
        key_ops: ["verify"],
        kty: "EC",
        x: "CbL4DOYOb1ntd-8OmExO-oS0DWCMC00DntrymJoB8tk",
        y: "KTFwjHtQxGTDR91VsOypcdBfvbo6sAMj5p4Wb-9hRA0",
      },
      expiresAt: 1726209328,
    };

    const result = verifyP256Jwt<{
      exp: number;
      id: string;
      origin: string;
      isScam: boolean;
      isVerified: true;
    }>(token, publicKey.publicKey);
    expect(result).to.exist;
    expect(result).to.exist;
    expect(result.isVerified).to.be.false;
    expect(result.exp).to.exist;
    expect(result.origin).to.exist;
    expect(result.isScam).to.be.null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });
  it("should fail to validate invalid jwt with public key", async () => {
    const token =
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.oiMDkxN2YzMzk0YTdmMzkyZTg3ZTM1ZjM4OTg2OWU2NDEzZjkyNTBlMGIxZTE4YjUzMDhkNzBhM2VjOTJjZDQ3OCIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImlzU2NhbSI6bnVsbCwiaXNWZXJpZmllZCI6ZmFsc2V9.RehA28c0Ae8D_ixvGS8uG9J9eTJtpGfaC_7kNE9ZNAVFREWBY6Dl_SXc0_E0RSvYkHpupfmXlmjenuDqNcyoeg";

    const publicKey = {
      publicKey: {
        crv: "P-256",
        ext: true,
        key_ops: ["verify"],
        kty: "EC",
        x: "CbL4DOYOb1ntd-8OmExO-oS0DWCMC00DntrymJoB8tk",
        y: "KTFwjHtQxGTDR91VsOypcdBfvbo6sAMj5p4Wb-9hRA0",
      },
      expiresAt: 1726209328,
    };

    expect(() =>
      verifyP256Jwt<{
        exp: number;
        id: string;
        origin: string;
        isScam: boolean;
        isVerified: true;
      }>(token, publicKey.publicKey),
    ).to.throw();
  });
  it("should fail to validate validate verify v2 jwt with invalid public key", async () => {
    const token =
      "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjM2MzI1MDQsImlkIjoiMDkxN2YzMzk0YTdmMzkyZTg3ZTM1ZjM4OTg2OWU2NDEzZjkyNTBlMGIxZTE4YjUzMDhkNzBhM2VjOTJjZDQ3OCIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImlzU2NhbSI6bnVsbCwiaXNWZXJpZmllZCI6ZmFsc2V9.RehA28c0Ae8D_ixvGS8uG9J9eTJtpGfaC_7kNE9ZNAVFREWBY6Dl_SXc0_E0RSvYkHpupfmXlmjenuDqNcyoeg";

    const publicKey = {
      publicKey: {
        crv: "P-256",
        ext: true,
        key_ops: ["verify"],
        kty: "EC",
        x: "CbL4DOYOb1ntd-8OmExO-oS0DWCMC00Dn",
        y: "KTFwjHtQxGTDR91VsOypcdBfvbo6sAMj5p4Wb-9hRA0",
      },
      expiresAt: 1726209328,
    };

    expect(() =>
      verifyP256Jwt<{
        exp: number;
        id: string;
        origin: string;
        isScam: boolean;
        isVerified: true;
      }>(token, publicKey.publicKey),
    ).to.throw();
  });
});
