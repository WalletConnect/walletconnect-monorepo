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
} from "@walletconnect/utils";
import { Logger } from "pino";
import { CRYPTO_CONTEXT } from "../constants";
import { KeyChain } from "./keychain";

export class Crypto implements ICrypto {
  public name = CRYPTO_CONTEXT;

  public keychain: ICrypto["keychain"];

  constructor(public core: ICore, public logger: Logger, keychain?: IKeyChain) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
    this.keychain = keychain || new KeyChain(this.core, this.logger);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  public init: ICrypto["init"] = async () => {
    await this.keychain.init();
  };

  public hasKeys: ICrypto["hasKeys"] = async tag => {
    return this.keychain.has(tag);
  };

  public generateKeyPair: ICrypto["generateKeyPair"] = async () => {
    const keyPair = generateKeyPair();
    return this.setPrivateKey(keyPair.publicKey, keyPair.privateKey);
  };

  public generateSharedKey: ICrypto["generateSharedKey"] = async (
    selfPublicKey,
    peerPublicKey,
    overrideTopic,
  ) => {
    const privateKey = await this.getPrivateKey(selfPublicKey);
    const sharedKey = deriveSharedKey(privateKey, peerPublicKey);
    const symKey = deriveSymmetricKey(sharedKey);
    return this.setSymKey(symKey, overrideTopic);
  };

  public setSymKey: ICrypto["setSymKey"] = async (symKey, overrideTopic) => {
    const topic = overrideTopic || (await hashKey(symKey));
    await this.keychain.set(topic, symKey);
    return topic;
  };

  public deleteKeyPair: ICrypto["deleteKeyPair"] = async (publicKey: string) => {
    await this.keychain.del(publicKey);
  };

  public deleteSymKey: ICrypto["deleteSymKey"] = async (topic: string) => {
    await this.keychain.del(topic);
  };

  public encrypt: ICrypto["encrypt"] = async (topic, message) => {
    const symKey = await this.getSymKey(topic);
    const result = await encrypt({ symKey, message });
    return result;
  };

  public decrypt: ICrypto["decrypt"] = async (topic, encoded) => {
    const symKey = await this.getSymKey(topic);
    const result = await decrypt({ symKey, encoded });
    return result;
  };

  public encode: ICrypto["encode"] = async (topic, payload) => {
    const hasKeys = await this.hasKeys(topic);
    const message = safeJsonStringify(payload);
    const result = hasKeys ? await this.encrypt(topic, message) : encoding.utf8ToHex(message);
    return result;
  };

  public decode: ICrypto["decode"] = async (topic, encoded) => {
    const hasKeys = await this.hasKeys(topic);
    const message = hasKeys ? await this.decrypt(topic, encoded) : encoding.hexToUtf8(encoded);
    const payload = safeJsonParse(message);
    return payload;
  };

  // ---------- Private ----------------------------------------------- //

  private async setPrivateKey(publicKey: string, privateKey: string): Promise<string> {
    await this.keychain.set(publicKey, privateKey);
    return publicKey;
  }

  private async getPrivateKey(publicKey: string): Promise<string> {
    const privateKey = await this.keychain.get(publicKey);
    return privateKey;
  }

  private async getSymKey(topic: string): Promise<string> {
    const symKey = await this.keychain.get(topic);
    return symKey;
  }
}
