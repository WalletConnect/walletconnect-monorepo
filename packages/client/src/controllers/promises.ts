import { IPromises } from "@walletconnect/types";

export class Promises implements IPromises {
  cache: IPromises["cache"];

  constructor() {
    this.cache = new Map();
  }

  initiate: IPromises["initiate"] = async (id, expiry) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(reject, expiry);
      this.cache.set(id, { resolve, reject, timeout });
    });
  };

  resolve: IPromises["resolve"] = (id, data) => {
    const promise = this.cache.get(id);

    if (promise) {
      promise.resolve(data);
      clearTimeout(promise.timeout);
      this.cache.delete(id);
    }
  };

  reject: IPromises["reject"] = (id, data) => {
    const promise = this.cache.get(id);

    if (promise) {
      promise.reject(data);
      clearTimeout(promise.timeout);
      this.cache.delete(id);
    }
  };
}
