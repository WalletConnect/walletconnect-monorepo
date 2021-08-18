import { IClient } from "@walletconnect/types";
import { ERROR, mapToObj, objToMap } from "@walletconnect/utils";
import { IKeyValueStorage } from "keyvaluestorage";

export type KeyMap = Record<string, string | Record<string, string>>;

export function validateKey(label: string, map: KeyMap) {
  const names = labe.split(":");
  let key: string | undefined;
}

// refactor storage keys to always include a "scope" and a "name"
// schema:
// key = scope + ":" + name
// example
// key = "crypto" + ":" + "keychain"
export const STORAGE_KEYS = {
  crypto: {
    keychain: "crypto:keychain",
  },
  session: {
    pending: "session:pending",
    settled: "session:settled",
    history: "session:history",
  },
  pairing: {
    pending: "pairing:pending",
    settled: "pairing:settled",
    history: "pairing:history",
  },
  relayer: {
    history: "relayer:history",
    subscription: "relayer:subscription",
  },
};

export class Storage {
  public version = "0.1";

  private keyMap = STORAGE_KEYS;

  constructor(public client: IClient, public keyValueStorage: IKeyValueStorage) {
    this.client = client;
    this.keyValueStorage = keyValueStorage;
  }

  get prefix() {
    return `${this.client.protocol}@${this.client.version}:${this.client.context}:${this.version}`;
  }

  public async setKeyChain(keychain: Map<string, string>) {
    await this.keyValueStorage.setItem<Record<string, string>>(
      this.getStorageKey(STORAGE_KEYS.keychain),
      mapToObj(keychain),
    );
  }

  public async getKeyChain(): Promise<Map<string, string> | undefined> {
    const persisted = await this.keyValueStorage.getItem<Record<string, string>>(
      this.getStorageKey(STORAGE_KEYS.keychain),
    );
    return typeof persisted !== "undefined" ? objToMap(persisted) : undefined;
  }

  public async getSequences(context: string);

  private getStorageKey(label: string): string {
    const names = label.split(":");
    let key: string;
    if (names.length === 1) {
      if (typeof name === "undefined") {
        const error = ERROR.MISSING_OR_INVALID.format({ name: "label" });
        throw new Error(error.message);
      }
    }
    const key = this.prefix + "//" + name;

    return key;
  }
}
