import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { IVerify } from "@walletconnect/types";
import { isBrowser, isNode, isReactNative } from "@walletconnect/utils";
import { FIVE_SECONDS, ONE_SECOND, toMiliseconds } from "@walletconnect/time";

import { TRUSTED_VERIFY_URLS, VERIFY_CONTEXT, VERIFY_SERVER, VERIFY_SERVER_V2 } from "../constants";

export class Verify extends IVerify {
  public name = VERIFY_CONTEXT;
  private verifyUrl: string;
  private iframe?: HTMLIFrameElement;
  private initialized = false;
  private abortController: AbortController;
  private isDevEnv;
  // the queue is only used during the loading phase of the iframe to ensure all attestations are posted
  private queue: string[] = [];
  // flag to disable verify when the iframe fails to load on main & fallback urls.
  // this means Verify API is not enabled for the current projectId and there's no point in trying to initialize it again.
  private verifyDisabled = false;
  private verifyUrlV2 = VERIFY_SERVER_V2;

  constructor(public projectId: string, public logger: Logger) {
    super(projectId, logger);
    this.logger = generateChildLogger(logger, this.name);
    this.verifyUrl = VERIFY_SERVER;
    this.abortController = new AbortController();
    this.isDevEnv = isNode() && process.env.IS_VITEST;
    console.log("Verify v2 init", this.verifyUrlV2);
  }

  public register: IVerify["register"] = async (params) => {
    console.log("register", params);
    const { id, decryptedId } = params;
    const url = `${this.verifyUrlV2}/attestation?projectId=${this.projectId}`;
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ id, decryptedId }),
      headers: {
        origin: "https://8951-78-130-198-143.ngrok-free.app/",
      },
    });
    const { srcdoc } = { srcdoc: "" };

    console.log("srcdoc", await response.json());
    const attestatiatonJwt = await new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.srcdoc = srcdoc;
      iframe.style.display = "none";
      const listener = (event: MessageEvent) => {
        console.log("message event received", event);
        if (event.origin === "verify.walletconnect.com") {
          const data = JSON.parse(event.data);
          if (data.type === "verify_attestation") {
            // best-practice field
            window.removeEventListener("message", listener);
            document.body.removeChild(iframe);
            console.log("attestation", data.attestation);
            resolve(data.attestation);
          }
        }
      };
      document.body.appendChild(iframe);
      window.addEventListener("message", listener);
    });
    console.log("attestatiatonJwt", attestatiatonJwt);
  };

  public resolve: IVerify["resolve"] = async (params) => {
    if (this.isDevEnv) return "";

    const verifyUrl = this.getVerifyUrl(params?.verifyUrl);
    return this.fetchAttestation(params.attestationId, verifyUrl);
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  private fetchAttestation = async (attestationId: string, url: string) => {
    this.logger.info(`resolving attestation: ${attestationId} from url: ${url}`);
    // set artificial timeout to prevent hanging
    const timeout = this.startAbortTimer(ONE_SECOND * 5);
    const result = await fetch(`${url}/attestation/${attestationId}`, {
      signal: this.abortController.signal,
    });
    clearTimeout(timeout);
    return result.status === 200 ? await result.json() : undefined;
  };

  // private addToQueue = (attestationId: string) => {
  //   this.queue.push(attestationId);
  // };

  // private processQueue = () => {
  //   if (this.queue.length === 0) return;
  //   this.queue.forEach((attestationId) => this.sendPost(attestationId));
  //   this.queue = [];
  // };

  // private sendPost = (attestationId: string) => {
  //   try {
  //     if (!this.iframe) return;
  //     this.iframe.contentWindow?.postMessage(attestationId, "*"); // setting targetOrigin to "*" fixes the `Failed to execute 'postMessage' on 'DOMWindow': The target origin provided...` while the iframe is still loading
  //     this.logger.info(`postMessage sent: ${attestationId} ${this.verifyUrl}`);
  //   } catch (e) {}
  // };

  // private createIframe = async () => {
  //   let iframeOnLoadResolve: () => void;
  //   const onMessage = (event: MessageEvent) => {
  //     if (event.data === "verify_ready") {
  //       this.onInit();
  //       window.removeEventListener("message", onMessage);
  //       iframeOnLoadResolve();
  //     }
  //   };
  //   await Promise.race([
  //     new Promise<void>((resolve) => {
  //       const existingIframe = document.getElementById(VERIFY_CONTEXT);
  //       if (existingIframe) {
  //         this.iframe = existingIframe as HTMLIFrameElement;
  //         this.onInit();
  //         return resolve();
  //       }

  //       window.addEventListener("message", onMessage);
  //       const iframe = document.createElement("iframe");
  //       iframe.id = VERIFY_CONTEXT;
  //       iframe.src = `${this.verifyUrl}/${this.projectId}`;
  //       iframe.style.display = "none";
  //       document.body.append(iframe);
  //       this.iframe = iframe;
  //       iframeOnLoadResolve = resolve;
  //     }),
  //     new Promise((_, reject) =>
  //       setTimeout(() => {
  //         window.removeEventListener("message", onMessage);
  //         reject("verify iframe load timeout");
  //       }, toMiliseconds(FIVE_SECONDS)),
  //     ),
  //   ]);
  // };

  // private onInit = () => {
  //   this.initialized = true;
  //   this.processQueue();
  // };

  private startAbortTimer(timer: number) {
    this.abortController = new AbortController();
    return setTimeout(() => this.abortController.abort(), toMiliseconds(timer));
  }

  private getVerifyUrl = (verifyUrl?: string) => {
    let url = verifyUrl || VERIFY_SERVER;
    if (!TRUSTED_VERIFY_URLS.includes(url)) {
      this.logger.info(
        `verify url: ${url}, not included in trusted list, assigning default: ${VERIFY_SERVER}`,
      );
      url = VERIFY_SERVER;
    }
    return url;
  };
}
