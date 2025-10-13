import { generatePlatformLogger, Logger } from "@walletconnect/logger";

export function createLogger({ logger, name }: { logger: Logger | string; name: string }) {
  const loggerInstance =
    typeof logger === "string"
      ? generatePlatformLogger({
          opts: {
            level: logger,
            name,
          },
        }).logger
      : logger;
  loggerInstance.level = typeof logger === "string" ? logger : logger.level;
  return loggerInstance as Logger;
}
