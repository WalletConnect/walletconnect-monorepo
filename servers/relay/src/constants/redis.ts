import { THIRTY_DAYS } from "@walletconnect/time";

export const REDIS_CONTEXT = "redis";
export const EMPTY_STREAM = "empty_stream";
// For more info about "$" read: https://redis.io/commands/xread/#the-special--id
export const SPECIAL_ID = "$";
export const REDIS_DEFAULT_MAXTTL = THIRTY_DAYS;
