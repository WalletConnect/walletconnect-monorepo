import BigNumber from "bignumber.js";
import { detect, BrowserInfo, BotInfo, NodeInfo } from "detect-browser";
import { isHexString as _isHexString, hexlify, arrayify } from "@ethersproject/bytes";
import { getAddress } from "@ethersproject/address";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";

import {
  ITxData,
  IClientMeta,
  IParseURIResult,
  IRequiredParamsResult,
  IQueryParamsResult,
  IJsonRpcSubscription,
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcErrorMessage,
  IInternalEvent,
  IWalletConnectSession,
} from "@walletconnect/types";

// -- ArrayBuffer ------------------------------------------ //

export function convertArrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  const hex = convertArrayBufferToHex(arrayBuffer);
  const result = convertHexToBuffer(hex);
  return result;
}

export function convertArrayBufferToUtf8(arrayBuffer: ArrayBuffer): string {
  const utf8 = toUtf8String(new Uint8Array(arrayBuffer));
  return utf8;
}

export function convertArrayBufferToHex(arrayBuffer: ArrayBuffer, noPrefix?: boolean): string {
  let hex = hexlify(new Uint8Array(arrayBuffer));
  if (noPrefix) {
    hex = removeHexPrefix(hex);
  }
  return hex;
}

export function convertArrayBufferToNumber(arrayBuffer: ArrayBuffer): number {
  const hex = convertArrayBufferToHex(arrayBuffer);
  const num = convertHexToNumber(hex);
  return num;
}

export function concatArrayBuffers(...args: ArrayBuffer[]): ArrayBuffer {
  const hex: string = args.map(b => convertArrayBufferToHex(b, true)).join("");
  const result: ArrayBuffer = convertHexToArrayBuffer(hex);
  return result;
}

// -- Buffer ----------------------------------------------- //

export function convertBufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const hex = convertBufferToHex(buffer);
  const result = convertHexToArrayBuffer(hex);
  return result;
}

export function convertBufferToUtf8(buffer: Buffer): string {
  const result = buffer.toString("utf8");
  return result;
}

export function convertBufferToHex(buffer: Buffer, noPrefix?: boolean): string {
  let hex = buffer.toString("hex");
  if (!noPrefix) {
    hex = addHexPrefix(hex);
  }
  return hex;
}

export function convertBufferToNumber(buffer: Buffer): number {
  const hex = convertBufferToHex(buffer);
  const num = convertHexToNumber(hex);
  return num;
}

export function concatBuffers(...args: Buffer[]): Buffer {
  const result = Buffer.concat(args);
  return result;
}

// -- Utf8 ------------------------------------------------- //

export function convertUtf8ToArrayBuffer(utf8: string): ArrayBuffer {
  const arrayBuffer = toUtf8Bytes(utf8).buffer;
  return arrayBuffer;
}

export function convertUtf8ToBuffer(utf8: string): Buffer {
  const result = Buffer.from(utf8, "utf8");
  return result;
}

export function convertUtf8ToHex(utf8: string, noPrefix?: boolean): string {
  const arrayBuffer = convertUtf8ToArrayBuffer(utf8);
  const hex = convertArrayBufferToHex(arrayBuffer, noPrefix);
  return hex;
}

export function convertUtf8ToNumber(utf8: string): number {
  const num = new BigNumber(utf8).toNumber();
  return num;
}

// -- Number ----------------------------------------------- //

export function convertNumberToBuffer(num: number): Buffer {
  const hex = convertNumberToHex(num);
  const buffer = convertHexToBuffer(hex);
  return buffer;
}

export function convertNumberToArrayBuffer(num: number): ArrayBuffer {
  const hex = convertNumberToHex(num);
  const arrayBuffer = convertHexToArrayBuffer(hex);
  return arrayBuffer;
}

export function convertNumberToUtf8(num: number): string {
  const utf8 = new BigNumber(num).toString();
  return utf8;
}

export function convertNumberToHex(num: number | string, noPrefix?: boolean): string {
  let hex = new BigNumber(num).toString(16);
  hex = sanitizeHex(hex);
  if (noPrefix) {
    hex = removeHexPrefix(hex);
  }
  return hex;
}

// -- Hex -------------------------------------------------- //

export function convertHexToBuffer(hex: string): Buffer {
  hex = removeHexPrefix(hex);
  const buffer = Buffer.from(hex, "hex");
  return buffer;
}

export function convertHexToArrayBuffer(hex: string): ArrayBuffer {
  hex = addHexPrefix(hex);
  const arrayBuffer = arrayify(hex).buffer;
  return arrayBuffer;
}

export function convertHexToUtf8(hex: string): string {
  const arrayBuffer = convertHexToArrayBuffer(hex);
  const utf8 = convertArrayBufferToUtf8(arrayBuffer);
  return utf8;
}

export function convertHexToNumber(hex: string): number {
  const num = new BigNumber(hex).toNumber();
  return num;
}

// -- Misc ------------------------------------------------- //

export function isMobile(): boolean {
  let mobile = false;

  function hasTouchEvent(): boolean {
    try {
      document.createEvent("TouchEvent");
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasMobileUserAgent(): boolean {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
        navigator.userAgent,
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(
        navigator.userAgent.substr(0, 4),
      )
    ) {
      return true;
    } else if (hasTouchEvent()) {
      return true;
    }
    return false;
  }

  mobile = hasMobileUserAgent();

  return mobile;
}

export function getQueryString(url: string): string {
  const pathEnd: number | undefined = url.indexOf("?") !== -1 ? url.indexOf("?") : undefined;

  const queryString: string = typeof pathEnd !== "undefined" ? url.substr(pathEnd) : "";

  return queryString;
}

export function appendToQueryString(queryString: string, newQueryParams: any): string {
  let queryParams = parseQueryString(queryString);

  queryParams = { ...queryParams, ...newQueryParams };

  queryString = formatQueryString(queryParams);

  return queryString;
}

export function formatQueryString(queryParams: any): string {
  let result = "";

  const keys = Object.keys(queryParams);

  if (keys) {
    keys.forEach((key: string, idx: number) => {
      const value = queryParams[key];
      if (idx === 0) {
        result = `?${key}=${value}`;
      } else {
        result = result + `&${key}=${value}`;
      }
    });
  }

  return result;
}

export function detectEnv(userAgent?: string): BrowserInfo | BotInfo | NodeInfo | null {
  return detect(userAgent);
}

export function sanitizeHex(hex: string): string {
  hex = removeHexPrefix(hex);
  hex = hex.length % 2 !== 0 ? "0" + hex : hex;
  if (hex) {
    hex = addHexPrefix(hex);
  }
  return hex;
}

export function addHexPrefix(hex: string): string {
  if (hex.toLowerCase().substring(0, 2) === "0x") {
    return hex;
  }
  return "0x" + hex;
}

export function removeHexPrefix(hex: string): string {
  if (hex.toLowerCase().substring(0, 2) === "0x") {
    return hex.substring(2);
  }
  return hex;
}

export function removeHexLeadingZeros(hex: string): string {
  hex = removeHexPrefix(hex);
  hex = hex.startsWith("0") ? hex.substring(1) : hex;
  hex = addHexPrefix(hex);
  return hex;
}

export function isHexString(value: any): boolean {
  return _isHexString(value);
}

export function isEmptyString(value: string): boolean {
  return value === "" || (typeof value === "string" && value.trim() === "");
}

export function payloadId(): number {
  const datePart: number = new Date().getTime() * Math.pow(10, 3);
  const extraPart: number = Math.floor(Math.random() * Math.pow(10, 3));
  const id: number = datePart + extraPart;
  return id;
}

export function uuid(): string {
  const result: string = ((a?: any, b?: any) => {
    for (
      b = a = "";
      a++ < 36;
      b += (a * 51) & 52 ? (a ^ 15 ? 8 ^ (Math.random() * (a ^ 20 ? 16 : 4)) : 4).toString(16) : "-"
    ) {
      // empty
    }
    return b;
  })();
  return result;
}

export const toChecksumAddress = (address: string) => {
  return getAddress(address);
};

export const isValidAddress = (address?: string) => {
  function isAddressAllLowercase(str: string) {
    return /^(0x)?[0-9a-f]{40}$/i.test(str);
  }
  if (!address) {
    return false;
  } else if (address.toLowerCase().substring(0, 2) !== "0x") {
    return false;
  } else if (!isAddressAllLowercase(address)) {
    return false;
  } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
    return true;
  } else {
    return address === toChecksumAddress(address);
  }
};

export function getMeta(): IClientMeta | null {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.location === "undefined"
  ) {
    return null;
  }

  function getIcons(): string[] {
    const links: HTMLCollectionOf<HTMLLinkElement> = document.getElementsByTagName("link");
    const icons: string[] = [];

    for (let i = 0; i < links.length; i++) {
      const link: HTMLLinkElement = links[i];

      const rel: string | null = link.getAttribute("rel");
      if (rel) {
        if (rel.toLowerCase().indexOf("icon") > -1) {
          const href: string | null = link.getAttribute("href");

          if (href) {
            if (
              href.toLowerCase().indexOf("https:") === -1 &&
              href.toLowerCase().indexOf("http:") === -1 &&
              href.indexOf("//") !== 0
            ) {
              let absoluteHref: string = window.location.protocol + "//" + window.location.host;

              if (href.indexOf("/") === 0) {
                absoluteHref += href;
              } else {
                const path: string[] = window.location.pathname.split("/");
                path.pop();
                const finalPath: string = path.join("/");
                absoluteHref += finalPath + "/" + href;
              }

              icons.push(absoluteHref);
            } else if (href.indexOf("//") === 0) {
              const absoluteUrl: string = window.location.protocol + href;

              icons.push(absoluteUrl);
            } else {
              icons.push(href);
            }
          }
        }
      }
    }

    return icons;
  }

  function getMetaOfAny(...args: string[]): string {
    const metaTags: HTMLCollectionOf<HTMLMetaElement> = document.getElementsByTagName("meta");

    for (let i = 0; i < metaTags.length; i++) {
      const tag: HTMLMetaElement = metaTags[i];
      const attributes: Array<string | null> = ["itemprop", "property", "name"]
        .map(target => tag.getAttribute(target))
        .filter(attr => {
          if (attr) {
            args.includes(attr);
          }
        });

      if (attributes.length && attributes) {
        const content: string | null = tag.getAttribute("content");
        if (content) {
          return content;
        }
      }
    }

    return "";
  }

  function getName(): string {
    let name: string = getMetaOfAny("name", "og:site_name", "og:title", "twitter:title");

    if (!name) {
      name = document.title;
    }

    return name;
  }

  function getDescription(): string {
    const description: string = getMetaOfAny(
      "description",
      "og:description",
      "twitter:description",
      "keywords",
    );

    return description;
  }

  const name: string = getName();
  const description: string = getDescription();
  const url: string = window.location.origin;
  const icons: string[] = getIcons();

  const meta: IClientMeta = {
    description,
    url,
    icons,
    name,
  };

  return meta;
}

export function parseQueryString(queryString: string): any {
  const result: any = {};

  const pairs = (queryString[0] === "?" ? queryString.substr(1) : queryString).split("&");

  for (let i = 0; i < pairs.length; i++) {
    const keyArr: string[] = pairs[i].match(/\w+(?==)/i) || [];
    const valueArr: string[] = pairs[i].match(/=.+/i) || [];
    if (keyArr[0]) {
      result[decodeURIComponent(keyArr[0])] = decodeURIComponent(valueArr[0].substr(1));
    }
  }

  return result;
}

export function parseWalletConnectUri(str: string): IParseURIResult {
  const pathStart: number = str.indexOf(":");

  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;

  const protocol: string = str.substring(0, pathStart);

  const path: string = str.substring(pathStart + 1, pathEnd);

  function parseRequiredParams(path: string): IRequiredParamsResult {
    const separator = "@";

    const values = path.split(separator);

    const requiredParams = {
      handshakeTopic: values[0],
      version: parseInt(values[1], 10),
    };

    return requiredParams;
  }

  const requiredParams: IRequiredParamsResult = parseRequiredParams(path);

  const queryString: string = typeof pathEnd !== "undefined" ? str.substr(pathEnd) : "";

  function parseQueryParams(queryString: string): IQueryParamsResult {
    const result = parseQueryString(queryString);

    const parameters: IQueryParamsResult = {
      key: result.key || "",
      bridge: result.bridge || "",
    };

    return parameters;
  }

  const queryParams: IQueryParamsResult = parseQueryParams(queryString);

  const result: IParseURIResult = {
    protocol,
    ...requiredParams,
    ...queryParams,
  };

  return result;
}

export function promisify(
  originalFn: (...args: any[]) => void,
  thisArg?: any,
): (...callArgs: any[]) => Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> {
  const promisifiedFunction = async (
    ...callArgs: any[]
  ): Promise<IJsonRpcResponseSuccess | IJsonRpcResponseError> => {
    return new Promise((resolve, reject) => {
      const callback = (
        err: Error | null,
        data: IJsonRpcResponseSuccess | IJsonRpcResponseError,
      ) => {
        if (err === null || typeof err === "undefined") {
          reject(err);
        }
        resolve(data);
      };
      originalFn.apply(thisArg, [...callArgs, callback]);
    });
  };
  return promisifiedFunction;
}

export function isEmptyArray(array: any[]): boolean {
  return !(array && array.length);
}

export function parsePersonalSign(params: string[]): string[] {
  if (!isEmptyArray(params) && !isHexString(params[0])) {
    params[0] = convertUtf8ToHex(params[0]);
  }
  return params;
}

export function parseTransactionData(txData: Partial<ITxData>): Partial<ITxData> {
  if (typeof txData.from === "undefined" || !isValidAddress(txData.from)) {
    throw new Error(`Transaction object must include a valid 'from' value.`);
  }

  function parseHexValues(value: number | string) {
    let result = value;
    if (typeof value === "number" || (typeof value === "string" && !isEmptyString(value))) {
      if (!isHexString(value)) {
        result = convertNumberToHex(value);
      } else if (typeof value === "string") {
        result = sanitizeHex(value);
      }
    }
    if (typeof result === "string") {
      result = removeHexLeadingZeros(result);
    }
    return result;
  }

  const txDataRPC = {
    from: sanitizeHex(txData.from),
    to: typeof txData.to === "undefined" ? "" : sanitizeHex(txData.to),
    gasPrice: typeof txData.gasPrice === "undefined" ? "" : parseHexValues(txData.gasPrice),
    gas:
      typeof txData.gas === "undefined"
        ? typeof txData.gasLimit === "undefined"
          ? ""
          : parseHexValues(txData.gasLimit)
        : parseHexValues(txData.gas),
    value: typeof txData.value === "undefined" ? "" : parseHexValues(txData.value),
    nonce: typeof txData.nonce === "undefined" ? "" : parseHexValues(txData.nonce),
    data: typeof txData.data === "undefined" ? "" : sanitizeHex(txData.data) || "0x",
  };

  const prunable = ["gasPrice", "gas", "value", "nonce"];
  Object.keys(txDataRPC).forEach((key: string) => {
    if (!txDataRPC[key].trim().length && prunable.includes(key)) {
      delete txDataRPC[key];
    }
  });

  return txDataRPC;
}

export function formatRpcError(
  error: Partial<IJsonRpcErrorMessage>,
): { code: number; message: string } {
  const message = error.message || "Failed or Rejected Request";
  let code = -32000;
  if (error && !error.code) {
    switch (message) {
      case "Parse error":
        code = -32700;
        break;
      case "Invalid request":
        code = -32600;
        break;
      case "Method not found":
        code = -32601;
        break;
      case "Invalid params":
        code = -32602;
        break;
      case "Internal error":
        code = -32603;
        break;
      default:
        code = -32000;
        break;
    }
  }
  const result = {
    code,
    message,
  };
  return result;
}

// -- typeGuards ----------------------------------------------------------- //

export function isJsonRpcSubscription(object: any): object is IJsonRpcSubscription {
  return typeof object.params === "object";
}

export function isJsonRpcRequest(object: any): object is IJsonRpcRequest {
  return typeof object.method !== "undefined";
}

export function isJsonRpcResponseSuccess(object: any): object is IJsonRpcResponseSuccess {
  return typeof object.result !== "undefined";
}

export function isJsonRpcResponseError(object: any): object is IJsonRpcResponseError {
  return typeof object.error !== "undefined";
}

export function isInternalEvent(object: any): object is IInternalEvent {
  return typeof object.event !== "undefined";
}

export function isWalletConnectSession(object: any): object is IWalletConnectSession {
  return typeof object.bridge !== "undefined";
}

export function isReservedEvent(event: string) {
  const reservedEvents = [
    "session_request",
    "session_update",
    "exchange_key",
    "connect",
    "disconnect",
    "display_uri",
    "transport_open",
    "transport_close",
  ];
  return reservedEvents.includes(event) || event.startsWith("wc_");
}

export const signingMethods = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v1",
  "eth_signTypedData_v3",
  "personal_sign",
];

export const stateMethods = ["eth_accounts", "eth_chainId", "net_version"];

export function isSilentPayload(request: IJsonRpcRequest): boolean {
  if (request.method.startsWith("wc_")) {
    return true;
  }
  if (signingMethods.includes(request.method)) {
    return false;
  }
  return true;
}

export function logDeprecationWarning() {
  console.warn(
    "DEPRECATION WARNING: This WalletConnect client library will be deprecated in favor of @walletconnect/client. Please check docs.walletconnect.org to learn more about this migration!",
  );
}

export function isIOS(): boolean {
  const env = detectEnv();
  const result = env && env.os ? env.os.toLowerCase() === "ios" : false;
  return result;
}

export function isAndroid(): boolean {
  const env = detectEnv();
  const result = env && env.os ? env.os.toLowerCase() === "android" : false;
  return result;
}

export function isNode(): boolean {
  const env = detectEnv();
  const result = env && env.name ? env.name.toLowerCase() === "node" : false;
  return result;
}
