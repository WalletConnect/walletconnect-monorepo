import redis from "redis";
import { Subscription, Notification, BridgePublishParams } from "./types";
import bluebird from "bluebird";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const redisConfig = {
  url: process.env.REDIS_URL || "redis://localhost:6379/0",
  prefix: process.env.REDIS_PREFIX || "walletconnect-bridge",
};

const redisClient: any = redis.createClient();

const subs: Subscription[] = [];

export const setSub = (subscriber: Subscription) => subs.push(subscriber);
export const getSub = (topic: string) =>
  subs.filter(subscriber => subscriber.topic === topic && subscriber.socket.readyState === 1);

export const setPub = async (params: BridgePublishParams) => {
  await redisClient.lpushAsync(`request:${params.topic}`, params.message);
  // TODO: need to handle ttl
  // await redisClient.expireAsync(`request:${params.topic}`, params.ttl);
};

export const getPub = (topic: string): string[] => {
  return redisClient.lrangeAsync(`request:${topic}`, 0, -1).then((data: any) => {
    if (data) {
      const localData: string[] = data.map((message: string) => message);
      redisClient.del(`request:${topic}`);
      return localData;
    }
    return;
  });
};

export const setNotification = (notification: Notification) =>
  redisClient.lpushAsync(`notification:${notification.topic}`, JSON.stringify(notification));

export const getNotification = (topic: string) => {
  return redisClient.lrangeAsync(`notification:${topic}`, 0, -1).then((data: any) => {
    if (data) {
      return data.map((item: string) => JSON.parse(item));
    }
    return;
  });
};
