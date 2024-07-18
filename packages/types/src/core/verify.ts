import { Logger } from "@walletconnect/logger";

export declare namespace Verify {
  export interface Context {
    verified: {
      origin: string;
      validation: "UNKNOWN" | "VALID" | "INVALID";
      verifyUrl: string;
      isScam?: boolean;
    };
  }
}

export abstract class IVerify {
  public abstract readonly context: string;

  constructor(public projectId: string, public logger: Logger) {}

  public abstract init(params?: { verifyUrl?: string }): Promise<void>;

  public abstract register(params: { attestationId: string }): Promise<void>;

  public abstract resolve(params: {
    attestationId: string;
    verifyUrl?: string;
  }): Promise<{ origin: string; isScam?: boolean }>;
}
