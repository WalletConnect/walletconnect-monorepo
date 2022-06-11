import {
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IJsonRpcErrorMessage,
} from "@walletconnect/types";

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

export function formatRpcError(
  error: Partial<IJsonRpcErrorMessage>,
): { code: number; message: string; data?: string } {
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
  const result: { code: number; message: string; data?: string } = {
    code,
    message,
  };
  if (error.data) {
    result.data = error.data;
  }
  return result;
}
