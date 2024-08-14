import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { IVerify } from "@walletconnect/types";
import { isBrowser, isNode, P256KeyDataType, verifyP256Jwt } from "@walletconnect/utils";
import { FIVE_SECONDS, ONE_SECOND, toMiliseconds } from "@walletconnect/time";
import { getDocument } from "@walletconnect/window-getters";

import { TRUSTED_VERIFY_URLS, VERIFY_CONTEXT, VERIFY_SERVER, VERIFY_SERVER_V2 } from "../constants";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";

type jwk = {
  publicKey: P256KeyDataType;
  expiresAt: number;
};
export class Verify extends IVerify {
  public name = VERIFY_CONTEXT;
  private abortController: AbortController;
  private isDevEnv;
  private verifyUrlV2 = VERIFY_SERVER_V2;
  private publicKey?: jwk;

  constructor(public projectId: string, public logger: Logger, public store: IKeyValueStorage) {
    super(projectId, logger, store);
    this.logger = generateChildLogger(logger, this.name);
    this.abortController = new AbortController();
    this.isDevEnv = isNode() && process.env.IS_VITEST;
    this.init();
  }

  get storeKey(): string {
    return `verify:public:key`;
  }

  public init = async () => {
    this.publicKey = await this.store.getItem(this.storeKey);
    if (this.publicKey && toMiliseconds(this.publicKey?.expiresAt) < Date.now()) {
      this.logger.debug("verify v2 public key expired");
      await this.removePublicKey();
    }
    if (!this.publicKey) {
      await this.fetchAndPersistPublicKey();
    }
  };

  public register: IVerify["register"] = async (params) => {
    if (!isBrowser()) return;
    const { id, decryptedId } = params;
    const url = `${this.verifyUrlV2}/attestation?projectId=${this.projectId}`;
    let src = "";
    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ id, decryptedId }),
      });
      const { srcdoc } = await response.json();
      src = srcdoc;
      this.logger.debug("srcdoc fetched", src);
    } catch (e) {
      this.logger.warn(e);
      return;
    }
    try {
      const document = getDocument() as Document;
      const abortTimeout = this.startAbortTimer(ONE_SECOND * 3);
      const attestationJwt = await new Promise((resolve) => {
        const abortListener = () => {
          window.removeEventListener("message", listener);
          document.body.removeChild(iframe);
          throw new Error("attestation aborted");
        };
        this.abortController.signal.addEventListener("abort", abortListener, {
          signal: this.abortController.signal,
        });
        const iframe = document.createElement("iframe");
        iframe.srcdoc = src;
        iframe.style.display = "none";
        const listener = (event: MessageEvent) => {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          if (data.type === "verify_attestation") {
            clearInterval(abortTimeout);
            document.body.removeChild(iframe);
            this.abortController.signal.removeEventListener("abort", abortListener);
            window.removeEventListener("message", listener);
            resolve(data.attestation === null ? "" : data.attestation);
          }
        };
        document.body.appendChild(iframe);
        window.addEventListener("message", listener, { signal: this.abortController.signal });
      });
      this.logger.debug("jwt attestation", attestationJwt);
      return attestationJwt as string;
    } catch (e) {
      this.logger.warn(e);
    }
    return "";
  };

  public resolve: IVerify["resolve"] = async (params) => {
    if (this.isDevEnv) return "";
    const { attestationId, hash } = params;

    if (attestationId === "") {
      this.logger.debug("resolve: attestationId is empty, skipping");
      return;
    }

    if (attestationId) {
      const validation = await this.isValidJwtAttestation(attestationId);
      if (validation) return validation;
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
    const result = await fetch(`${url}/attestation/${attestationId}`, {
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
      this.logger.debug(`fetching public key from: ${this.verifyUrlV2}`);
      const timeout = this.startAbortTimer(FIVE_SECONDS);
      const result = await fetch(`${this.verifyUrlV2}/public-key`, {
        signal: this.abortController.signal,
      });
      clearTimeout(timeout);
      return (await result.json()) as jwk;
    } catch (e) {
      this.logger.warn(e);
    }
    return undefined;
  };

  private persistPublicKey = async (publicKey: jwk) => {
    this.logger.debug(`persisting public key to local storage`, publicKey);
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
        const validation = await this.validateAttestation(attestation, key);
        return validation;
      }
    } catch (e) {
      console.error(e);
      this.logger.warn("error validating attestation");
    }
    const newKey = await this.fetchAndPersistPublicKey();
    try {
      if (newKey) {
        const validation = await this.validateAttestation(attestation, newKey);
        return validation;
      }
    } catch (e) {
      this.logger.warn(e);
      this.logger.warn("error validating attestation");
    }
    return undefined;
  };

  private getPublicKey = async () => {
    if (this.publicKey) return this.publicKey;
    return await this.fetchAndPersistPublicKey();
  };

  private fetchAndPersistPublicKey = async () => {
    const key = await this.fetchPublicKey();
    if (!key) return;
    await this.persistPublicKey(key);
    return key;
  };

  private validateAttestation = async (attestation: string, key: jwk) => {
    console.log("cryptoKey", key);
    const result = await verifyP256Jwt<{
      exp: number;
      id: string;
      origin: string;
      isScam: boolean;
      isVerified: boolean;
    }>(attestation, key.publicKey);
    console.log("decoded result", result);
    const validation = {
      valid: true,
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
    };
  };
}
