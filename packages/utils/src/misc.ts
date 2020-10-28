import { Logger, LoggerOptions } from "pino";

// -- logger ------------------------------------------------- //

export function getLoggerOptions(level?: string): LoggerOptions {
  return {
    level: level || "warn",
    prettyPrint: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

export function formatLoggerContext(logger: Logger, childContext: string): string {
  const bindings = logger.bindings();
  return `${bindings.context ? `${bindings.context}/` : ""}${childContext}`;
}

// -- assert ------------------------------------------------- //

export function assertType(obj: any, key: string, type: string) {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

// -- map ------------------------------------------------- //

export function mapToObj<T = any>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

export function objToMap<T = any>(obj: Record<string, T>): Map<string, T> {
  return new Map<string, T>(Object.entries<T>(obj));
}

export function mapEntries<A = any, B = any>(
  obj: Record<string, A>,
  cb: (x: A) => B,
): Record<string, B> {
  const res = {};
  Object.keys(obj).forEach(key => {
    res[key] = cb(obj[key]);
  });
  return res;
}
