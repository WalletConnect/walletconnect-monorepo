import { IPromises } from "@walletconnect/types";

export class Promises implements IPromises {
  cache: IPromises["cache"];

  constructor() {
    this.cache = new Map();
  }

  initiate: IPromises["initiate"] = async (id, timeout) => {
    return new Promise((resolve, reject) => {
      setTimeout(reject, timeout);
      this.cache.set(id, { resolve, reject });
    });
  };

  resolve: IPromises["resolve"] = (id, data) => {
    this.cache.get(id)?.resolve(data);
    this.cache.delete(id);
  };

  reject: IPromises["reject"] = (id, data) => {
    this.cache.get(id)?.reject(data);
    this.cache.delete(id);
  };
}
