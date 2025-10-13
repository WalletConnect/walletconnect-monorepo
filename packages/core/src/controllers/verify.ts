import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { ICore, IVerify } from "@walletconnect/types";
import { isBrowser, isTestRun, P256KeyDataType, verifyP256Jwt } from "@walletconnect/utils";
import { FIVE_SECONDS, ONE_SECOND, toMiliseconds } from "@walletconnect/time";
import { getDocument } from "@walletconnect/window-getters";
import { decodeJWT } from "@walletconnect/relay-auth";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";

import {
  CORE_STORAGE_PREFIX,
  CORE_VERSION,
  TRUSTED_VERIFY_URLS,
  VERIFY_CONTEXT,
  VERIFY_SERVER,
  VERIFY_SERVER_V3,
} from "../constants/index.js";

type Jwk = {
  publicKey: P256KeyDataType;
  expiresAt: number;
};
type JwkPayload = {
  exp: number;
  id: string;
  origin: string;
  isScam: boolean;
  isVerified: boolean;
};
export class Verify extends IVerify {
  public name = VERIFY_CONTEXT;
  private abortController: AbortController;
  private isDevEnv;
  private verifyUrlV3 = VERIFY_SERVER_V3;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private version = CORE_VERSION;
  private publicKey?: Jwk;
  private fetchPromise?: Promise<Jwk>;

  constructor(
    public core: ICore,
    public logger: Logger,
    public store: IKeyValueStorage,
  ) {
    super(core, logger, store);
    this.logger = generateChildLogger(logger, this.name);
    this.abortController = new AbortController();
    this.isDevEnv = isTestRun();
    this.init();
  }

  get storeKey(): string {
    return (
      this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + `verify:public:key`
    );
  }

  public init = async () => {
    if (this.isDevEnv) return;
    this.publicKey = await this.store.getItem(this.storeKey);
    if (this.publicKey && toMiliseconds(this.publicKey?.expiresAt) < Date.now()) {
      this.logger.debug("verify v2 public key expired");
      await this.removePublicKey();
    }
  };

  public register: IVerify["register"] = async (params) => {
    if (!isBrowser() || this.isDevEnv) return;
    const origin = window.location.origin;
    const { id, decryptedId } = params;
    const src = `${this.verifyUrlV3}/attestation?projectId=${this.core.projectId}&origin=${origin}&id=${id}&decryptedId=${decryptedId}`;
    try {
      const document = getDocument() as Document;
      const abortTimeout = this.startAbortTimer(ONE_SECOND * 5);
      const attestationJwt = await new Promise((resolve, reject) => {
        const abortListener = () => {
          window.removeEventListener("message", listener);
          document.body.removeChild(iframe);
          reject("attestation aborted");
        };
        this.abortController.signal.addEventListener("abort", abortListener);
        const iframe = document.createElement("iframe");
        iframe.src = src;
        iframe.style.display = "none";
        iframe.addEventListener("error", abortListener, { signal: this.abortController.signal });
        const listener = (event: MessageEvent) => {
          if (!event.data) return;
          if (typeof event.data !== "string") return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "verify_attestation") {
              const decoded = decodeJWT(data.attestation) as unknown as { payload: JwkPayload };
              if (decoded.payload.id !== id) return;

              clearInterval(abortTimeout);
              document.body.removeChild(iframe);
              this.abortController.signal.removeEventListener("abort", abortListener);
              window.removeEventListener("message", listener);
              resolve(data.attestation === null ? "" : data.attestation);
            }
          } catch (e) {
            this.logger.warn(e);
          }
        };
        document.body.appendChild(iframe);
        window.addEventListener("message", listener, { signal: this.abortController.signal });
      });
      this.logger.debug(attestationJwt, "jwt attestation");
      return attestationJwt as string;
    } catch (e) {
      this.logger.warn(e);
    }
    return "";
  };

  public resolve: IVerify["resolve"] = async (params) => {
    if (this.isDevEnv) return "";
    const { attestationId, hash, encryptedId } = params;
    if (attestationId === "") {
      this.logger.debug("resolve: attestationId is empty, skipping");
      return;
    }

    if (attestationId) {
      const decoded = decodeJWT(attestationId) as unknown as { payload: JwkPayload };
      if (decoded.payload.id !== encryptedId) return;
      const validation = await this.isValidJwtAttestation(attestationId);
      if (validation) {
        if (!validation.isVerified) {
          this.logger.warn("resolve: jwt attestation: origin url not verified");
          return;
        }
        return validation;
      }
    }
    if (!hash) return;
    const verifyUrl = this.getVerifyUrl(params?.verifyUrl);
    return this.fetchAttestation(hash, verifyUrl);
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  private fetchAttestation = async (attestationId: string, url: string) => {
    this.logger.debug(`resolving attestation: ${attestationId} from url: ${url}`);
    // set artificial timeout to prevent hanging
    const timeout = this.startAbortTimer(ONE_SECOND * 5);
    const result = await fetch(`${url}/attestation/${attestationId}?v2Supported=true`, {
      signal: this.abortController.signal,
    });
    clearTimeout(timeout);
    return result.status === 200 ? await result.json() : undefined;
  };

  private startAbortTimer(timer: number) {
    this.abortController = new AbortController();
    return setTimeout(() => this.abortController.abort(), toMiliseconds(timer));
  }

  private getVerifyUrl = (verifyUrl?: string) => {
    let url = verifyUrl || VERIFY_SERVER;
    if (!TRUSTED_VERIFY_URLS.includes(url)) {
      this.logger.info(
        `verify url: ${url}, not included in trusted list, assigning default: ${VERIFY_SERVER}`,
      );
      url = VERIFY_SERVER;
    }
    return url;
  };

  private fetchPublicKey = async () => {
    try {
      this.logger.debug(`fetching public key from: ${this.verifyUrlV3}`);
      const timeout = this.startAbortTimer(FIVE_SECONDS);
      const result = await fetch(`${this.verifyUrlV3}/public-key`, {
        signal: this.abortController.signal,
      });
      clearTimeout(timeout);
      return (await result.json()) as Jwk;
    } catch (e) {
      this.logger.warn(e);
    }
    return undefined;
  };

  private persistPublicKey = async (publicKey: Jwk) => {
    this.logger.debug(publicKey, `persisting public key to local storage`);
    await this.store.setItem(this.storeKey, publicKey);
    this.publicKey = publicKey;
  };

  private removePublicKey = async () => {
    this.logger.debug(`removing verify v2 public key from storage`);
    await this.store.removeItem(this.storeKey);
    this.publicKey = undefined;
  };

  private isValidJwtAttestation = async (attestation: string) => {
    const key = await this.getPublicKey();
    try {
      if (key) {
        const validation = this.validateAttestation(attestation, key);
        return validation;
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.warn("error validating attestation");
    }
    const newKey = await this.fetchAndPersistPublicKey();
    try {
      if (newKey) {
        const validation = this.validateAttestation(attestation, newKey);
        return validation;
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.warn("error validating attestation");
    }
    return undefined;
  };

  private getPublicKey = async () => {
    if (this.publicKey) return this.publicKey;
    return await this.fetchAndPersistPublicKey();
  };

  private fetchAndPersistPublicKey = async () => {
    if (this.fetchPromise) {
      await this.fetchPromise;
      return this.publicKey;
    }
    this.fetchPromise = new Promise(async (resolve) => {
      const key = await this.fetchPublicKey();
      if (!key) return;
      await this.persistPublicKey(key);
      resolve(key);
    });
    const key = await this.fetchPromise;
    this.fetchPromise = undefined;
    return key;
  };

  private validateAttestation = (attestation: string, key: Jwk) => {
    const result = verifyP256Jwt<JwkPayload>(attestation, key.publicKey);
    const validation = {
      hasExpired: toMiliseconds(result.exp) < Date.now(),
      payload: result,
    };

    if (validation.hasExpired) {
      this.logger.warn("resolve: jwt attestation expired");
      throw new Error("JWT attestation expired");
    }

    return {
      origin: validation.payload.origin,
      isScam: validation.payload.isScam,
      isVerified: validation.payload.isVerified,
    };
  };
}
