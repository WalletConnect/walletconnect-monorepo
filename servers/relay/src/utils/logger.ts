import { Logger, LoggerOptions } from "pino";

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
