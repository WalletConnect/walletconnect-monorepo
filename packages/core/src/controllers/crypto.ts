import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { ICore, ICrypto, IKeyChain } from "@walletconnect/types";
import * as relayAuth from "@walletconnect/relay-auth";
import { fromString } from "uint8arrays";
import {
  decrypt,
  deriveSymKey,
  encrypt,
  generateKeyPair as generateKeyPairUtil,
  hashKey,
  getInternalError,
  generateRandomBytes32,
  validateEncoding,
  validateDecoding,
  isTypeOneEnvelope,
} from "@walletconnect/utils";
import { Logger } from "pino";
import { CRYPTO_CONTEXT, CRYPTO_CLIENT_SEED } from "../constants";
import { KeyChain } from "./keychain";

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

  public hasKeys: ICrypto["hasKeys"] = (tag) => {
    this.isInitialized();
    return this.keychain.has(tag);
  };

  public getClientId: ICrypto["getClientId"] = async () => {
    this.isInitialized();
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed);
    const clientId = relayAuth.encodeIss(keyPair.publicKey);
    return clientId;
  };

  public generateKeyPair: ICrypto["generateKeyPair"] = () => {
    this.isInitialized();
    const keyPair = generateKeyPairUtil();
    return this.setPrivateKey(keyPair.publicKey, keyPair.privateKey);
  };

  public signJWT: ICrypto["signJWT"] = async (subject) => {
    this.isInitialized();
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed);
    const jwt = await relayAuth.signJWT(subject, keyPair);
    return jwt;
  };

  public generateSharedKey: ICrypto["generateSharedKey"] = (
    selfPublicKey,
    peerPublicKey,
    overrideTopic,
  ) => {
    this.isInitialized();
    const selfPrivateKey = this.getPrivateKey(selfPublicKey);
    const symKey = deriveSymKey(selfPrivateKey, peerPublicKey);
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

  public encode: ICrypto["encode"] = async (topic, payload, opts) => {
    this.isInitialized();
    const params = validateEncoding(opts);
    const message = safeJsonStringify(payload);
    if (isTypeOneEnvelope(params)) {
      topic = await this.generateSharedKey(params.senderPublicKey, params.receiverPublicKey);
    }
    const symKey = this.getSymKey(topic);
    const { type, senderPublicKey } = params;
    const result = encrypt({ type, symKey, message, senderPublicKey });
    return result;
  };

  public decode: ICrypto["decode"] = async (topic, encoded, opts) => {
    this.isInitialized();
    const params = validateDecoding(encoded, opts);
    if (isTypeOneEnvelope(params)) {
      topic = await this.generateSharedKey(params.senderPublicKey, params.receiverPublicKey);
    }
    const symKey = this.getSymKey(topic);
    const message = decrypt({ symKey, encoded });
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

  private async getClientSeed(): Promise<Uint8Array> {
    let seed = "";
    try {
      seed = this.keychain.get(CRYPTO_CLIENT_SEED);
    } catch {
      seed = generateRandomBytes32();
      await this.keychain.set(CRYPTO_CLIENT_SEED, seed);
    }
    return fromString(seed, "base16");
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
