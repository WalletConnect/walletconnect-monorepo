import { Logger } from "pino";
import * as encoding from "@walletconnect/encoding";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { IClient, CryptoTypes, ICrypto, IKeyChain } from "@walletconnect/types";
import {
  ERROR,
  generateKeyPair,
  deriveSharedKey,
  encrypt,
  decrypt,
  hashKey,
  generateRandomBytes32,
  deriveSymmetricKey,
  objToMap,
  mapToObj,
  formatStorageKeyName,
} from "@walletconnect/utils";

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
    return this.setKeyPair(keyPair);
  }

  public async generateSessionKey(
    self: CryptoTypes.Participant,
    peer: CryptoTypes.Participant,
    overrideTopic?: string,
  ): Promise<string> {
    const keyPair = await this.getKeyPair(self.publicKey);
    // eslint-disable-next-line
    console.log(this.client.name, `[generateSessionKey]`, `keyPair`, keyPair);
    const sharedKey = deriveSharedKey(keyPair.privateKey, peer.publicKey);
    // eslint-disable-next-line
    console.log(this.client.name, `[generateSessionKey]`, `sharedKey`, sharedKey);
    const symKey = deriveSymmetricKey(sharedKey);
    // eslint-disable-next-line
    console.log(this.client.name, `[generateSessionKey]`, `symKey`, symKey);
    return this.setEncryptionKeys({ symKey, publicKey: keyPair.publicKey }, overrideTopic);
  }

  public async generatePairingKey(overrideTopic?: string): Promise<string> {
    const symKey = generateRandomBytes32();
    // eslint-disable-next-line
    console.log(this.client.name, `[generatePairingKey]`, `symKey`, symKey);
    return this.setPairingKey(symKey, overrideTopic);
  }

  public async setPairingKey(symKey: string, overrideTopic?: string): Promise<string> {
    // eslint-disable-next-line
    console.log(this.client.name, `[setPairingKey]`, `symKey`, symKey);
    const hash = await hashKey(symKey);
    // eslint-disable-next-line
    console.log(this.client.name, `[setPairingKey]`, `hash`, hash);
    return this.setEncryptionKeys({ symKey, publicKey: hash }, overrideTopic);
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
    const { symKey } = await this.getEncryptionKeys(topic);
    const result = await encrypt({ symKey, message });
    return result;
  }

  public async decrypt(topic: string, encoded: string): Promise<string> {
    const { symKey } = await this.getEncryptionKeys(topic);
    const result = await decrypt({ symKey, encoded });
    return result;
  }

  public async encode(topic: string, payload: JsonRpcPayload): Promise<string> {
    const message = safeJsonStringify(payload);
    const result = await this.encrypt(topic, message);
    return result;
  }

  public async decode(topic: string, encoded: string): Promise<JsonRpcPayload> {
    const message = await this.decrypt(topic, encoded);
    const payload = safeJsonParse(message);
    return payload;
  }

  // ---------- Private ----------------------------------------------- //

  private concatKeys(keyA: string, keyB: string): string {
    return encoding.arrayToHex(
      encoding.concatArrays(encoding.hexToArray(keyA), encoding.hexToArray(keyB)),
    );
  }

  private splitKeys(keys: string): string[] {
    const arr = encoding.hexToArray(keys);
    return [encoding.arrayToHex(arr.slice(0, 32)), encoding.arrayToHex(arr.slice(32, 64))];
  }

  private async setKeyPair(keyPair: CryptoTypes.KeyPair): Promise<string> {
    const keys = this.concatKeys(keyPair.publicKey, keyPair.privateKey);
    await this.keychain.set(keyPair.publicKey, keys);
    return keyPair.publicKey;
  }

  private async getKeyPair(publicKey: string): Promise<CryptoTypes.KeyPair> {
    const [_, privateKey] = this.splitKeys(await this.keychain.get(publicKey));
    return { publicKey, privateKey };
  }

  private async setEncryptionKeys(
    encryptionKeys: CryptoTypes.EncryptionKeys,
    overrideTopic?: string,
  ): Promise<string> {
    // eslint-disable-next-line
    console.log(this.client.name, `[setEncryptionKeys]`, `overrideTopic`, overrideTopic);
    const topic = overrideTopic || (await hashKey(encryptionKeys.symKey));
    // eslint-disable-next-line
    console.log(this.client.name, `[setEncryptionKeys]`, `topic`, topic);

    const keys = this.concatKeys(encryptionKeys.symKey, encryptionKeys.publicKey);
    await this.keychain.set(topic, keys);
    return topic;
  }
  private async getEncryptionKeys(topic: string): Promise<CryptoTypes.EncryptionKeys> {
    const [symKey, publicKey] = this.splitKeys(await this.keychain.get(topic));
    return { symKey, publicKey };
  }
}
