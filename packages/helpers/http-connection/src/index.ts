import { EventEmitter } from "events";
import { XMLHttpRequest } from "xhr2-cookies";
import { IError } from "@walletconnect/types";
import { getFromWindow } from "@walletconnect/utils";

// -- global -------------------------------------------------------------- //

const XHR = getFromWindow<typeof XMLHttpRequest>("XMLHttpRequest") || XMLHttpRequest;

// -- HttpConnection ------------------------------------------------------ //

class HTTPConnection extends EventEmitter {
  public url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  formatError(payload: any, message: string, code = -1) {
    return {
      error: { message, code },
      id: payload.id,
      jsonrpc: payload.jsonrpc,
    };
  }

  public send(payload: any, internal?: any): Promise<any> {
    return new Promise(resolve => {
      if (payload.method === "eth_subscribe") {
        const error = this.formatError(
          payload,
          "Subscriptions are not supported by this HTTP endpoint",
        );
        this.emit("error", error);
        return resolve(error);
      }
      const xhr = new XHR();

      let responded = false;

      const res = (err: IError, result?: any) => {
        if (!responded) {
          xhr.abort();
          responded = true;
          if (internal) {
            internal(err, result);
          } else {
            const { id, jsonrpc } = payload;
            const response = err
              ? { id, jsonrpc, error: { message: err.message, code: err.code } }
              : { id, jsonrpc, result };
            this.emit("payload", response);
            resolve(response);
          }
        }
      };

      xhr.open("POST", this.url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.timeout = 60 * 1000;
      xhr.onerror = res as any;
      xhr.ontimeout = res as any;
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          try {
            const response = JSON.parse(xhr.responseText);
            res(response.error, response.result);
          } catch (e) {
            res(e);
          }
        }
      };
      xhr.send(JSON.stringify(payload));
    });
  }
}

export default HTTPConnection;
