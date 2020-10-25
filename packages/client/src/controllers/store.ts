import { IStore } from "@walletconnect/types";

export class Store implements IStore {
  public async init(): Promise<any> {
    return;
  }

  public async set<T = any>(key: string, value: T): Promise<void> {
    return;
  }

  public async get<T = any>(key: string): Promise<T | undefined> {
    return {} as any;
  }

  public async delete(key: string): Promise<void> {
    return;
  }
}
