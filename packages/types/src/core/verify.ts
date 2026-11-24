import { Logger } from "@walletconnect/logger";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import { ICore } from "./core.js";

export declare namespace Verify {
  /** The legacy (Verify v2/v3) attestation's result. Internal: wallets get `AppVerification`. */
  export interface Context {
    verified: {
      origin: string;
      validation: "UNKNOWN" | "VALID" | "INVALID";
      verifyUrl: string;
      isScam?: boolean;
    };
  }

  /**
   * Who the app is, as the Relay vouches for it (Verify v4). Every field comes from the Relay,
   * once the SDK checked that the app's signature is for this message: never from the app's own
   * metadata. Show what's present. An unsigned request, or one on Sign v2, has no domain, name or
   * icon; on Sign v2, `isScam` comes from a legacy attestation.
   */
  export interface AppVerification {
    /** The domain the Relay verified the app's signature for, e.g. "app.uniswap.org". */
    domain?: string;
    /** Only when WalletConnect reviewed the app. */
    name?: string;
    /** Only when WalletConnect reviewed the app; hosted by WalletConnect. */
    icon?: string;
    isVerified: boolean;
    isScam: boolean;
    /** A domain this app looks like. */
    isSimilarTo?: string;
  }

  /**
   * What the dApp's App Signature callback signs: one outgoing message. On Sign v3, the proposal
   * and every message; on Sign v2, session proposals, session requests and authenticate requests.
   */
  export interface AppSignatureParams {
    /** The plaintext JSON-RPC request (or response) object. */
    request: Record<string, unknown>;
    /**
     * `request` exactly as sent, as JSON text. The JWT's `sub` is base64url (no padding) of
     * SHA-256 over its UTF-8 bytes. Hash this string; re-serializing `request` may differ.
     */
    requestJson: string;
    /**
     * The JWT's `cth`, base64url (no padding) SHA-256 of the bytes as sent: a sealed Sign v3
     * message's ciphertext, or a Sign v2 message's envelope (the base64-decoded `message`). Null
     * for monitored Sign v3 messages and proposals. Sign it as given.
     */
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
