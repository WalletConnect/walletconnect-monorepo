import * as encoding from "@walletconnect/encoding";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { ICore, ICrypto, IKeyChain } from "@walletconnect/types";
import {
  decrypt,
  deriveSharedKey,
  deriveSymmetricKey,
  encrypt,
  generateKeyPair,
  hashKey,
  getInternalError,
  generateRandomBytes32,
} from "@walletconnect/utils";
import { Logger } from "pino";
import { CRYPTO_CONTEXT, CRYPTO_CLIENT_SEED } from "../constants";
import { KeyChain } from "./keychain";
import * as relayAuth from "@walletconnect/relay-auth";

export class Crypto implements ICrypto {
  public name = CRYPTO_CONTEXT;
  public keychain: ICrypto["keychain"];

  private initialized = false;

  constructor(public core: ICore, public logger: Logger, keychain?: IKeyChain) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
    this.keychain = keychain || new KeyChain(this.core, this.logger);
  }

  public init: ICrypto["init"] = async () => {
    if (!this.initialized) {
      await this.keychain.init();
      this.initialized = true;
    }
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  public hasKeys: ICrypto["hasKeys"] = tag => {
    this.isInitialized();
    return this.keychain.has(tag);
  };

  public getClientId: ICrypto["getClientId"] = async () => {
    this.isInitialized();
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed as any);
    const clientId = relayAuth.encodeIss(keyPair.publicKey);
    return clientId;
  };

  public generateKeyPair: ICrypto["generateKeyPair"] = () => {
    this.isInitialized();
    const keyPair = generateKeyPair();
    return this.setPrivateKey(keyPair.publicKey, keyPair.privateKey);
  };

  public signJWT: ICrypto["signJWT"] = async subject => {
    this.isInitialized();
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed as any);
    const jwt = await relayAuth.signJWT(subject, keyPair);
    return jwt;
  };

  public generateSharedKey: ICrypto["generateSharedKey"] = (
    selfPublicKey,
    peerPublicKey,
    overrideTopic,
  ) => {
    this.isInitialized();
    const privateKey = this.getPrivateKey(selfPublicKey);
    const sharedKey = deriveSharedKey(privateKey, peerPublicKey);
    const symKey = deriveSymmetricKey(sharedKey);
    return this.setSymKey(symKey, overrideTopic);
  };

  public setSymKey: ICrypto["setSymKey"] = async (symKey, overrideTopic) => {
    this.isInitialized();
    const topic = overrideTopic || hashKey(symKey);
    await this.keychain.set(topic, symKey);
    return topic;
  };

  public deleteKeyPair: ICrypto["deleteKeyPair"] = async (publicKey: string) => {
    this.isInitialized();
    await this.keychain.del(publicKey);
  };

  public deleteSymKey: ICrypto["deleteSymKey"] = async (topic: string) => {
    this.isInitialized();
    await this.keychain.del(topic);
  };

  public encrypt: ICrypto["encrypt"] = (topic, message) => {
    this.isInitialized();
    const symKey = this.getSymKey(topic);
    const result = encrypt({ symKey, message });
    return result;
  };

  public decrypt: ICrypto["decrypt"] = (topic, encoded) => {
    this.isInitialized();
    const symKey = this.getSymKey(topic);
    const result = decrypt({ symKey, encoded });
    return result;
  };

  public encode: ICrypto["encode"] = (topic, payload) => {
    this.isInitialized();
    const hasKeys = this.hasKeys(topic);
    const message = safeJsonStringify(payload);
    const result = hasKeys ? this.encrypt(topic, message) : encoding.utf8ToHex(message);
    return result;
  };

  public decode: ICrypto["decode"] = (topic, encoded) => {
    this.isInitialized();
    const hasKeys = this.hasKeys(topic);
    const message = hasKeys ? this.decrypt(topic, encoded) : encoding.hexToUtf8(encoded);
    const payload = safeJsonParse(message);
    return payload;
  };

  // ---------- Private ----------------------------------------------- //

  private async setPrivateKey(publicKey: string, privateKey: string): Promise<string> {
    await this.keychain.set(publicKey, privateKey);
    return publicKey;
  }

  private getPrivateKey(publicKey: string) {
    const privateKey = this.keychain.get(publicKey);
    return privateKey;
  }

  private async setClientSeed(seed: string): Promise<void> {
    if (this.keychain.get(CRYPTO_CLIENT_SEED)) {
      throw new Error("Client seed already set");
    }
    await this.keychain.set(CRYPTO_CLIENT_SEED, seed);
  }

  private async getClientSeed(): Promise<string> {
    let seed = this.keychain.get(CRYPTO_CLIENT_SEED);
    if (typeof seed === "undefined") {
      seed = generateRandomBytes32();
      await this.setClientSeed(seed);
    }
    return seed;
  }

  private getSymKey(topic: string) {
    const symKey = this.keychain.get(topic);
    return symKey;
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
