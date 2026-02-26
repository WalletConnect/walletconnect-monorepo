import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";

let storage: Storage;

export class Storage {
  private storage: IKeyValueStorage;
  constructor(storage: IKeyValueStorage) {
    this.storage = storage;
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    return await this.storage.getItem<T>(key);
  }

  async setItem<T>(key: string, value: T) {
    return await this.storage.setItem(key, value);
  }

  async removeItem(key: string) {
    return await this.storage.removeItem(key);
  }

  static getStorage(kvStorage: IKeyValueStorage) {
    if (!storage) {
      storage = new Storage(kvStorage);
    }
    return storage;
  }
}
