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
    /**
     * The domain the Relay verified the app's signature for, e.g. "app.uniswap.org". Always the
     * ASCII form (punycode for an internationalised name, e.g. "app.xn--uniswp-7nf.org"), never
     * Unicode, so look-alike characters can't pass for another domain.
     *
     * Display rule: show this ASCII form, never a Unicode rendering of it. Never truncate
     * `registrableDomain`, and emphasise it (e.g. bold) within `domain`: it's the part that says
     * who controls the domain. Truncate only the labels to its left, if anything.
     */
    domain?: string;
    /**
     * `domain`'s registrable domain (eTLD+1) per the Public Suffix List, private suffixes
     * included, e.g. "uniswap.org" for "app.uniswap.org", or "alice.github.io". ASCII, like
     * `domain`. Absent when `domain` is or has no registrable domain (an IP address, a bare
     * public suffix).
     */
    registrableDomain?: string;
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
   * What the app's App Signature callback signs: one outgoing message. On Sign v3, the proposal
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
     * Sign v3 only: the connection the message is for, to put verbatim in the JWT's `cnx` claim.
     * The Relay refuses a Sign v3 App Signature whose `cnx` is missing or names another connection,
     * so a signature can't be replayed on another connection. A message on a connection: its
     * connectionId (a decimal string). The proposal, signed before any connectionId exists: the
     * request's `bindingPub` (base64url, no padding), a key the wallet derives from the URI's
     * `symKey`. Absent on Sign v2, whose signatures carry no `cnx`.
     */
    cnx?: string;
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
