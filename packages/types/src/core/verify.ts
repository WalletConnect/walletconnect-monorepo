import { Logger } from "@walletconnect/logger";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import { ICore } from "./core.js";

export declare namespace Verify {
  export interface Context {
    verified: {
      origin: string;
      validation: "UNKNOWN" | "VALID" | "INVALID";
      verifyUrl: string;
      isScam?: boolean;
    };
    /** Sign v3 only: Verify v4, from the app's signature and the Relay's `appMetadata`. */
    v4?: V4Context;
  }

  /**
   * Verify v4 tiers. `default`: unsigned. `domain_validated`: signed with a key the domain
   * published. `business_name`: and the Relay knows the business's name. `verified`: and the
   * business is verified. `invalid`: signed, but not for this request.
   */
  export type V4State = "default" | "domain_validated" | "business_name" | "verified" | "invalid";

  /** What the Relay vouches for about the app. Never taken from the app's own metadata. */
  export interface V4Context {
    state: V4State;
    origin?: string;
    name?: string;
    icon?: string;
    isScam?: boolean;
    isSimilarTo?: string;
  }

  /** What the dApp's App Signature callback signs: one outgoing Sign v3 message. */
  export interface AppSignatureParams {
    /** The plaintext JSON-RPC request (or response) object. */
    request: Record<string, unknown>;
    /**
     * `request` exactly as sent, as JSON text. The JWT's `sub` is base64url (no padding) of
     * SHA-256 over its UTF-8 bytes. Hash this string; re-serializing `request` may differ.
     */
    requestJson: string;
    /** The JWT's `cth` for a sealed message, else null. */
    ciphertextHash: string | null;
  }

  export interface AppSignatureOptions {
    /** Returns the `appSignature` JWT, usually from the app's backend. Throwing fails the call. */
    callback: (params: AppSignatureParams) => Promise<{ appSignature: string }>;
  }
}

export abstract class IVerify {
  public abstract readonly context: string;

  constructor(
    public core: ICore,
    public logger: Logger,
    public store: IKeyValueStorage,
  ) {}

  public abstract register(params: {
    id: string;
    decryptedId: string;
  }): Promise<string | undefined>;

  public abstract resolve(params: {
    attestationId?: string;
    hash?: string;
    encryptedId?: string;
    verifyUrl?: string;
  }): Promise<{ origin: string; isScam?: boolean }>;
}
