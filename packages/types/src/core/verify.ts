import { Logger } from "@walletconnect/logger";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import { ICore } from "./core";

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

  constructor(public core: ICore, public logger: Logger, public store: IKeyValueStorage) {}

  public abstract register(params: {
    id: string;
    decryptedId: string;
  }): Promise<string | undefined>;

  public abstract resolve(params: {
    attestationId?: string;
    hash?: string;
    encryptedId?: string;
    verifyUrl?: string;
  }): Promise<{ origin: string; isScam?: boolean }>;
}
