import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { IVerify } from "@walletconnect/types";
import { isBrowser, isNode, isReactNative } from "@walletconnect/utils";
import { FIVE_SECONDS, ONE_SECOND, toMiliseconds } from "@walletconnect/time";

import { VERIFY_CONTEXT, VERIFY_SERVER } from "../constants";

export class Verify extends IVerify {
  public name = VERIFY_CONTEXT;
  private verifyUrl: string;
  private iframe?: HTMLIFrameElement;
  private initialized = false;
  private abortController: AbortController;
  private isDevEnv;
  // the queue is only used during the loading phase of the iframe to ensure all attestations are posted
  private queue: string[] = [];

  constructor(public projectId: string, public logger: Logger) {
    super(projectId, logger);
    this.logger = generateChildLogger(logger, this.name);
    this.verifyUrl = VERIFY_SERVER;
    this.abortController = new AbortController();
    this.isDevEnv = isNode() && process.env.IS_VITEST;
  }

  public init: IVerify["init"] = async (params) => {
    // ignore on non browser environments
    if (isReactNative() || !isBrowser()) return;

    const verifyUrl = params?.verifyUrl || VERIFY_SERVER;
    // if init is called again with a different url, remove the iframe and start over
    if (this.verifyUrl !== verifyUrl) {
      this.removeIframe();
    }
    this.verifyUrl = verifyUrl;
    await this.createIframe();
  };

  public register: IVerify["register"] = async (params) => {
    if (!this.initialized) {
      this.addToQueue(params.attestationId);
      await this.init();
    } else {
      this.sendPost(params.attestationId);
    }
  };

  public resolve: IVerify["resolve"] = async (params) => {
    if (this.isDevEnv) return "";

    this.logger.info(`resolving attestation: ${params.attestationId}`);
    // set artificial timeout to prevent hanging
    const timeout = this.startAbortTimer(FIVE_SECONDS);
    const result = await fetch(`${this.verifyUrl}/attestation/${params.attestationId}`, {
      signal: this.abortController.signal,
    });
    clearTimeout(timeout);
    return result.status === 200 ? (await result.json())?.origin : "";
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  private addToQueue = (attestationId: string) => {
    this.queue.push(attestationId);
  };

  private processQueue = () => {
    if (this.queue.length === 0) return;
    this.queue.forEach((attestationId) => this.sendPost(attestationId));
    this.queue = [];
  };

  private sendPost = (attestationId: string) => {
    try {
      if (!this.iframe) return;
      this.iframe.contentWindow?.postMessage(attestationId, "*"); // setting targetOrigin to "*" fixes the `Failed to execute 'postMessage' on 'DOMWindow': The target origin provided...` while the iframe is still loading
      this.logger.info(`postMessage sent: ${attestationId} ${this.verifyUrl}`);
    } catch (e) {}
  };

  private createIframe = async () => {
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const exists = document.getElementById(VERIFY_CONTEXT);
          if (exists) {
            return resolve();
          }

          const iframe = document.createElement("iframe");
          iframe.setAttribute("id", VERIFY_CONTEXT);
          iframe.setAttribute("src", `${this.verifyUrl}/${this.projectId}`);
          iframe.style.display = "none";
          iframe.addEventListener("load", () => {
            this.initialized = true;
            this.processQueue();
            resolve();
          });
          iframe.addEventListener("error", (error) => {
            reject(error);
          });
          document.body.append(iframe);
          this.iframe = iframe;
        }),
        new Promise((_reject) => {
          setTimeout(() => _reject("iframe load timeout"), toMiliseconds(ONE_SECOND));
        }),
      ]);
    } catch (error) {
      this.logger.error(`Verify iframe failed to load: ${this.verifyUrl}`);
      this.logger.error(error);
    }
  };

  private startAbortTimer(timer: number) {
    return setTimeout(() => this.abortController.abort(), toMiliseconds(timer));
  }

  private removeIframe = () => {
    if (!this.iframe) return;
    this.iframe.remove();
    this.iframe = undefined;
    this.initialized = false;
  };
}
