import redis from "redis";
import config from "./config";
import { ClientDetails } from "./types";

const redisClient = redis.createClient({
  url: config.redis.url,
  prefix: `${config.redis.prefix}:`,
});

export function getHashValue(key: string, field: string): Promise<ClientDetails | null> {
  return new Promise((resolve, reject) => {
    redisClient.hget(key, field, (error, result) => {
      if (error) {
        reject(error);
      }
      if (result) {
        return JSON.parse(result);
      }
      return null;
    });
  });
}

export function setHashValue(key: string, field: string, data: ClientDetails): Promise<boolean> {
  const value = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    redisClient.hset(key, field, value, (error, result) => {
      if (error) {
        reject(error);
      }
      return result;
    });
  });
}

export function setClientDetails(topic: string, data: ClientDetails) {
  const field = "details";
  return setHashValue(topic, field, data);
}

export function getClientDetails(topic: string) {
  const field = "details";
  return getHashValue(topic, field);
}
