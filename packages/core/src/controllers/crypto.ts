import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { ICore, ICrypto, IKeyChain } from "@walletconnect/types";
import * as relayAuth from "@walletconnect/relay-auth";
import { fromString } from "uint8arrays/from-string";
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
  isTypeTwoEnvelope,
  encodeTypeTwoEnvelope,
  decodeTypeTwoEnvelope,
  deserialize,
  decodeTypeByte,
  BASE16,
  BASE64,
} from "@walletconnect/utils";
import { toString } from "uint8arrays";

import { CRYPTO_CONTEXT, CRYPTO_CLIENT_SEED, CRYPTO_JWT_TTL } from "../constants/index.js";
import { KeyChain } from "./keychain.js";

export class Crypto implements ICrypto {
  public name = CRYPTO_CONTEXT;
  public keychain: ICrypto["keychain"];
  public readonly randomSessionIdentifier = generateRandomBytes32();

  private initialized = false;
  private clientId: string | undefined;
  constructor(
    public core: ICore,
    public logger: Logger,
    keychain?: IKeyChain,
  ) {
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
    if (this.clientId) {
      return this.clientId;
    }
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed);
    const clientId = relayAuth.encodeIss(keyPair.publicKey);
    this.clientId = clientId;
    return clientId;
  };

  public generateKeyPair: ICrypto["generateKeyPair"] = () => {
    this.isInitialized();
    const keyPair = generateKeyPairUtil();
    return this.setPrivateKey(keyPair.publicKey, keyPair.privateKey);
  };

  public signJWT: ICrypto["signJWT"] = async (aud) => {
    this.isInitialized();
    const seed = await this.getClientSeed();
    const keyPair = relayAuth.generateKeyPair(seed);
    const sub = this.randomSessionIdentifier;
    const ttl = CRYPTO_JWT_TTL;
    const jwt = await relayAuth.signJWT(sub, aud, ttl, keyPair);
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

    if (isTypeTwoEnvelope(params)) {
      return encodeTypeTwoEnvelope(message, opts?.encoding);
    }

    if (isTypeOneEnvelope(params)) {
      const selfPublicKey = params.senderPublicKey;
      const peerPublicKey = params.receiverPublicKey;
      topic = await this.generateSharedKey(selfPublicKey, peerPublicKey);
    }
    const symKey = this.getSymKey(topic);
    const { type, senderPublicKey } = params;
    const result = encrypt({ type, symKey, message, senderPublicKey, encoding: opts?.encoding });
    return result;
  };

  public decode: ICrypto["decode"] = async (topic, encoded, opts) => {
    this.isInitialized();
    const params = validateDecoding(encoded, opts);
    if (isTypeTwoEnvelope(params)) {
      const message = decodeTypeTwoEnvelope(encoded, opts?.encoding);
      return safeJsonParse(message);
    }
    if (isTypeOneEnvelope(params)) {
      const selfPublicKey = params.receiverPublicKey;
      const peerPublicKey = params.senderPublicKey;
      topic = await this.generateSharedKey(selfPublicKey, peerPublicKey);
    }
    try {
      const symKey = this.getSymKey(topic);
      const message = decrypt({ symKey, encoded, encoding: opts?.encoding });
      const payload = safeJsonParse(message);
      return payload;
    } catch (error) {
      this.logger.error(
        `Failed to decode message from topic: '${topic}', clientId: '${await this.getClientId()}'`,
      );
      this.logger.error(error);
    }
  };

  public getPayloadType: ICrypto["getPayloadType"] = (encoded, encoding = BASE64) => {
    const deserialized = deserialize({ encoded, encoding });
    return decodeTypeByte(deserialized.type);
  };

  public getPayloadSenderPublicKey: ICrypto["getPayloadSenderPublicKey"] = (
    encoded,
    encoding = BASE64,
  ) => {
    const deserialized = deserialize({ encoded, encoding });
    return deserialized.senderPublicKey
      ? toString(deserialized.senderPublicKey, BASE16)
      : undefined;
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
