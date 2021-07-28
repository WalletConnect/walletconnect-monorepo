import { IKeyValueStorage } from "keyvaluestorage";
import { IClient, CryptoTypes, ICrypto, IKeyChain } from "@walletconnect/types";
import * as encoding from "@walletconnect/encoding";
import {
  ERROR,
  mapToObj,
  objToMap,
  generateKeyPair,
  deriveSharedKey,
  encrypt,
  decrypt,
  sha256,
} from "@walletconnect/utils";

import { CRYPTO_CONTEXT, KEYCHAIN_CONTEXT } from "../constants";

export class KeyChain implements IKeyChain {
  public keychain = new Map<string, string>();

  public context = KEYCHAIN_CONTEXT;

  constructor(public client: IClient, public storage: IKeyValueStorage) {
    this.client = client;
    this.storage = storage;
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

  private getStorageKey() {
    const storageKeyPrefix = `${this.client.protocol}@${this.client.version}:${this.client.context}`;
    return `${storageKeyPrefix}//${this.context}`;
  }

  private async restore() {
    const persisted = await this.storage.getItem<Record<string, string>>(this.getStorageKey());
    if (typeof persisted !== "undefined") {
      this.keychain = objToMap(persisted);
    }
  }

  private async persist() {
    await this.storage.setItem<Record<string, string>>(
      this.getStorageKey(),
      mapToObj(this.keychain),
    );
  }
}

export class Crypto implements ICrypto {
  public context: string = CRYPTO_CONTEXT;

  constructor(public client: IClient, public keychain: IKeyChain) {
    this.client = client;
    this.keychain = keychain;
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

  public async generateSharedKey(
    self: CryptoTypes.Participant,
    peer: CryptoTypes.Participant,
    overrideTopic?: string,
  ): Promise<string> {
    const keyPair = await this.getKeyPair(self.publicKey);
    const sharedKey = deriveSharedKey(keyPair.privateKey, peer.publicKey);
    return this.setEncryptionKeys({ sharedKey, publicKey: keyPair.publicKey }, overrideTopic);
  }

  public async encrypt(topic: string, message: string): Promise<string> {
    const { sharedKey, publicKey } = await this.getEncryptionKeys(topic);
    const result = await encrypt({ message, sharedKey, publicKey });
    return result;
  }

  public async decrypt(topic: string, encrypted: string): Promise<string> {
    const { sharedKey } = await this.getEncryptionKeys(topic);
    const result = await decrypt({ encrypted, sharedKey });
    return result;
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
    const topic = overrideTopic || (await sha256(encryptionKeys.sharedKey));
    const keys = this.concatKeys(encryptionKeys.sharedKey, encryptionKeys.publicKey);
    await this.keychain.set(topic, keys);
    return topic;
  }
  private async getEncryptionKeys(topic: string): Promise<CryptoTypes.EncryptionKeys> {
    const [sharedKey, publicKey] = this.splitKeys(await this.keychain.get(topic));
    return { sharedKey, publicKey };
  }
}
