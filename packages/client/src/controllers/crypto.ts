import * as encoding from "@walletconnect/encoding";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { CryptoTypes, IClient, ICrypto, IKeyChain } from "@walletconnect/types";
import {
  decrypt,
  deriveSharedKey,
  deriveSymmetricKey,
  encrypt,
  ERROR,
  formatStorageKeyName,
  generateKeyPair,
  generateRandomBytes32,
  hashKey,
  mapToObj,
  objToMap,
} from "@walletconnect/utils";
import { Logger } from "pino";
import { CRYPTO_CONTEXT, KEYCHAIN_CONTEXT, KEYCHAIN_STORAGE_VERSION } from "../constants";

export class KeyChain implements IKeyChain {
  public keychain = new Map<string, string>();

  public name: string = KEYCHAIN_CONTEXT;

  public version: string = KEYCHAIN_STORAGE_VERSION;

  constructor(public client: IClient, public logger: Logger) {
    this.client = client;
    this.logger = generateChildLogger(logger, this.name);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.client.storagePrefix + this.version + "//" + formatStorageKeyName(this.context);
  }

  public async init(): Promise<void> {
    await this.restore();
  }

  public async has(tag: string, opts?: any): Promise<boolean> {
    return this.keychain.has(tag);
  }

  public async set(tag: string, key: string, opts?: any): Promise<void> {
    this.keychain.set(tag, key);
    await this.persist();
  }

  public async get(tag: string, opts?: any): Promise<string> {
    const key = this.keychain.get(tag);
    if (typeof key === "undefined") {
      throw new Error(ERROR.NO_MATCHING_KEY.format({ tag }).message);
    }
    return key;
  }

  public async del(tag: string, opts?: any): Promise<void> {
    this.keychain.delete(tag);
    await this.persist();
  }

  // ---------- Private ----------------------------------------------- //

  private async setKeyChain(keychain: Map<string, string>): Promise<void> {
    await this.client.storage.setItem<Record<string, string>>(this.storageKey, mapToObj(keychain));
  }

  private async getKeyChain(): Promise<Map<string, string> | undefined> {
    const keychain = await this.client.storage.getItem<Record<string, string>>(this.storageKey);
    return typeof keychain !== "undefined" ? objToMap(keychain) : undefined;
  }

  private async restore() {
    const keychain = await this.getKeyChain();
    if (typeof keychain !== "undefined") {
      this.keychain = keychain;
    }
  }

  private async persist() {
    await this.setKeyChain(this.keychain);
  }
}

export class Crypto implements ICrypto {
  public name: string = CRYPTO_CONTEXT;

  public keychain: IKeyChain;

  constructor(public client: IClient, public logger: Logger, keychain?: IKeyChain) {
    this.client = client;
    this.logger = generateChildLogger(logger, this.name);
    this.keychain = keychain || new KeyChain(this.client, this.logger);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    await this.keychain.init();
  }

  public async hasKeys(tag: string): Promise<boolean> {
    return this.keychain.has(tag);
  }

  public async generateKeyPair(): Promise<string> {
    const keyPair = generateKeyPair();
    return this.setPrivateKey(keyPair.privateKey, keyPair.publicKey);
  }

  public async generateSessionKey(
    self: CryptoTypes.Participant,
    peer: CryptoTypes.Participant,
    overrideTopic?: string,
  ): Promise<string> {
    const privateKey = await this.getPrivateKey(self.publicKey);
    const sharedKey = deriveSharedKey(privateKey, peer.publicKey);
    const symKey = deriveSymmetricKey(sharedKey);
    return this.setSymKey(symKey, overrideTopic);
  }

  public async generatePairingKey(overrideTopic?: string): Promise<string> {
    const symKey = generateRandomBytes32();
    return this.setPairingKey(symKey, overrideTopic);
  }

  public async setPairingKey(symKey: string, overrideTopic?: string): Promise<string> {
    const hash = await hashKey(symKey);
    return this.setSymKey(symKey, overrideTopic);
  }

  public async deleteKeyPair(publicKey: string): Promise<void> {
    await this.keychain.del(publicKey);
  }

  public async deleteSessionKey(topic: string): Promise<void> {
    await this.keychain.del(topic);
  }

  public async deletePairingKey(topic: string): Promise<void> {
    await this.keychain.del(topic);
  }

  public async encrypt(topic: string, message: string): Promise<string> {
    const symKey = await this.getSymKey(topic);
    const result = await encrypt({ symKey, message });
    return result;
  }

  public async decrypt(topic: string, encoded: string): Promise<string> {
    const symKey = await this.getSymKey(topic);
    const result = await decrypt({ symKey, encoded });
    return result;
  }

  public async encode(topic: string, payload: JsonRpcPayload): Promise<string> {
    const hasKeys = await this.hasKeys(topic);
    const message = safeJsonStringify(payload);
    const result = hasKeys ? await this.encrypt(topic, message) : encoding.utf8ToHex(message);
    return result;
  }

  public async decode(topic: string, encoded: string): Promise<JsonRpcPayload> {
    const hasKeys = await this.hasKeys(topic);
    const message = hasKeys ? await this.decrypt(topic, encoded) : encoding.hexToUtf8(encoded);
    const payload = safeJsonParse(message);
    return payload;
  }

  // ---------- Private ----------------------------------------------- //

  private async setPrivateKey(privateKey: string, publicKey: string): Promise<string> {
    await this.keychain.set(publicKey, privateKey);
    return publicKey;
  }

  private async getPrivateKey(publicKey: string): Promise<string> {
    const privateKey = await this.keychain.get(publicKey);
    return privateKey;
  }

  private async setSymKey(symKey: string, overrideTopic?: string): Promise<string> {
    const topic = overrideTopic || (await hashKey(symKey));
    await this.keychain.set(topic, symKey);
    return topic;
  }
  private async getSymKey(topic: string): Promise<string> {
    const symKey = await this.keychain.get(topic);
    return symKey;
  }
}
