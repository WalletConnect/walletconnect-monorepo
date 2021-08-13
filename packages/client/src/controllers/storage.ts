import { IClient } from "@walletconnect/types";

export const keys = {
  crypto: "crypto",
};

export class Storage {
  public version = "1";

  constructor(public client: IClient) {}

  get prefix() {
    return `${this.client.protocol}@${this.client.version}:${this.client.context}:${this.version}`;
  }

  public async setKeyChain(keychain: Record<string, string>) {
    const key = this.prefix + "//" + keys.cr;
    await this.client.storage.setItem<Record<string, string>>(key, mapToObj(keychain));
  }
}
