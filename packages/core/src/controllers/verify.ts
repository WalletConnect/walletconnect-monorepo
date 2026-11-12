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
  private readonly requests = new Set<AbortController>();
  private readonly initialization: Promise<void>;
  private disposed = false;
  private isDevEnv;
  private verifyUrlV3 = VERIFY_SERVER_V3;
  private storagePrefix = CORE_STORAGE_PREFIX;
  private version = CORE_VERSION;
  private publicKey?: Jwk;
  private fetchPromise?: Promise<Jwk | undefined>;

  constructor(
    public core: ICore,
    public logger: Logger,
    public store: IKeyValueStorage,
  ) {
    super(core, logger, store);
    this.logger = generateChildLogger(logger, this.name);
    this.isDevEnv = isTestRun();
    this.initialization = this.init().catch((error) => {
      if (!this.core.signal.aborted) this.logger.warn(error);
    });
  }

  get storeKey(): string {
    return (
      this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + `verify:public:key`
    );
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
    for (const request of this.requests) request.abort();
    await Promise.allSettled([this.initialization, this.fetchPromise]);
    this.publicKey = undefined;
  }

  private assertActive() {
    this.core.assertActive();
    if (this.disposed) throw new Error("WalletConnect Verify is disposed");
  }

  public init = async () => {
    this.assertActive();
    if (this.isDevEnv) return;
    this.publicKey = await this.core.run(() => this.store.getItem(this.storeKey));
    if (this.publicKey && toMiliseconds(this.publicKey?.expiresAt) < Date.now()) {
      this.logger.debug("verify v2 public key expired");
      await this.removePublicKey();
    }
  };

  public register: IVerify["register"] = async (params) => {
    this.assertActive();
    if (!isBrowser() || this.isDevEnv) return;
    const origin = window.location.origin;
    const { id, decryptedId } = params;
    const src = `${this.verifyUrlV3}/attestation?projectId=${this.core.projectId}&origin=${origin}&id=${id}&decryptedId=${decryptedId}`;
    const request = this.startRequest(ONE_SECOND * 5);
    try {
      const document = getDocument() as Document;
      return await this.core.run(
        () =>
          new Promise<string>((resolve, reject) => {
            const iframe = document.createElement("iframe");
            const cleanup = () => {
              window.removeEventListener("message", listener);
              request.signal.removeEventListener("abort", aborted);
              iframe.remove();
            };
            const aborted = () => {
              cleanup();
              reject(new Error("attestation aborted"));
            };
            const listener = (event: MessageEvent) => {
              if (typeof event.data !== "string") return;
              try {
                const data = JSON.parse(event.data);
                if (data.type !== "verify_attestation") return;
                const decoded = decodeJWT(data.attestation) as unknown as { payload: JwkPayload };
                if (decoded.payload.id !== id) return;
                cleanup();
                resolve(data.attestation === null ? "" : data.attestation);
              } catch (error) {
                this.logger.warn(error);
              }
            };
            request.signal.addEventListener("abort", aborted, { once: true });
            iframe.addEventListener("error", aborted, { signal: request.signal });
            iframe.src = src;
            iframe.style.display = "none";
            document.body.appendChild(iframe);
            window.addEventListener("message", listener, { signal: request.signal });
            if (request.signal.aborted) aborted();
          }),
      );
    } catch (error) {
      this.assertActive();
      this.logger.warn(error);
      return "";
    } finally {
      request.finish();
    }
  };

  public resolve: IVerify["resolve"] = async (params) => {
    this.assertActive();
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
    const request = this.startRequest(ONE_SECOND * 5);
    try {
      return await this.core.run(async () => {
        const result = await fetch(`${url}/attestation/${attestationId}?v2Supported=true`, {
          signal: request.signal,
        });
        this.assertActive();
        return result.status === 200 ? await result.json() : undefined;
      });
    } finally {
      request.finish();
    }
  };

  private startRequest(timer: number) {
    this.assertActive();
    const controller = new AbortController();
    const abort = () => controller.abort();
    this.requests.add(controller);
    this.core.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, toMiliseconds(timer));
    return {
      signal: controller.signal,
      finish: () => {
        clearTimeout(timeout);
        this.core.signal.removeEventListener("abort", abort);
        this.requests.delete(controller);
      },
    };
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
    const request = this.startRequest(FIVE_SECONDS);
    try {
      return await this.core.run(async () => {
        const result = await fetch(`${this.verifyUrlV3}/public-key`, { signal: request.signal });
        this.assertActive();
        return (await result.json()) as Jwk;
      });
    } catch (error) {
      this.assertActive();
      this.logger.warn(error);
      return undefined;
    } finally {
      request.finish();
    }
  };

  private persistPublicKey = async (publicKey: Jwk) => {
    this.logger.debug(publicKey, `persisting public key to local storage`);
    await this.core.run(() => this.store.setItem(this.storeKey, publicKey));
    this.publicKey = publicKey;
  };

  private removePublicKey = async () => {
    this.logger.debug(`removing verify v2 public key from storage`);
    await this.core.run(() => this.store.removeItem(this.storeKey));
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
    this.assertActive();
    this.fetchPromise ??= (async () => {
      const key = await this.fetchPublicKey();
      this.assertActive();
      if (key) await this.persistPublicKey(key);
      return key;
    })();
    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = undefined;
    }
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
