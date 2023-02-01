import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { IVerify } from "@walletconnect/types";
import { isBrowser } from "@walletconnect/utils";
import { delay, FIVE_SECONDS } from "@walletconnect/time";

import { VERIFY_CONTEXT, VERIFY_SERVER } from "../constants";

export class Verify extends IVerify {
  public name = VERIFY_CONTEXT;
  private verifyUrl: string;
  private iframe?: HTMLIFrameElement;
  private initialized = false;
  private abortController: AbortController;

  constructor(public projectId: string, public logger: Logger) {
    super(projectId, logger);
    this.logger = generateChildLogger(logger, this.name);
    this.verifyUrl = VERIFY_SERVER;
    this.abortController = new AbortController();
  }

  public init: IVerify["init"] = async (params) => {
    // ignore on non browser environments
    if (!isBrowser() || !document) return;

    this.verifyUrl = params?.verifyUrl || VERIFY_SERVER;
    await this.createIframe();
  };

  public register: IVerify["register"] = async (params) => {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.iframe) return;

    this.iframe.contentWindow?.postMessage(params.attestationId, this.verifyUrl);
    this.logger.info(`postMessage sent: ${params.attestationId} ${this.verifyUrl}`);
  };

  public resolve: IVerify["resolve"] = async (params) => {
    this.logger.info(`resoving attestation: ${params.attestationId}`);
    // set artificial timeout to prevent hanging
    const timeout = setTimeout(() => this.abortController.abort(), FIVE_SECONDS);
    const result = await fetch(`${this.verifyUrl}/attestation/${params.attestationId}`, {
      signal: this.abortController.signal,
    });
    clearTimeout(timeout);
    return (await result.json())?.origin || "";
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  private createIframe = async () => {
    try {
      // if an invalid verifyUrl is provided, the iframe will never load
      // so we need to timeout and reject
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const iframe = document.createElement("iframe");
          iframe.setAttribute("id", VERIFY_CONTEXT);
          iframe.setAttribute("src", `${this.verifyUrl}/${this.projectId}`);
          iframe.style.display = "none";
          iframe.addEventListener("load", () => {
            this.initialized = true;
            resolve();
          });
          iframe.addEventListener("error", (error) => {
            reject(error);
          });
          document.body.append(iframe);
          this.iframe = iframe;
        }),
        new Promise(async (_reject) => {
          await delay(FIVE_SECONDS);
          _reject("iframe load timeout");
        }),
      ]);
    } catch (error) {
      this.logger.error(`Verify iframe failed to load: ${this.verifyUrl}`);
      this.logger.error(error);
    }
  };
}
