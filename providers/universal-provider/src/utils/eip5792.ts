import { calcExpiry, isExpired, parseChainId } from "@walletconnect/utils";
import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import JsonRpcProvider from "@walletconnect/jsonrpc-provider";

import { StoredSendCalls, StoreSendCallsParams } from "../types/index.js";
import { CALL_STATUS_RESULT_EXPIRY, CALL_STATUS_STORAGE_KEY } from "../constants/index.js";
import { Storage } from "./storage.js";

export async function prepareCallStatusFromStoredSendCalls(
  storedSendCalls: StoredSendCalls,
  getHttpProvider: (chainId: number) => JsonRpcProvider,
) {
  const chainId = parseChainId(storedSendCalls.result.capabilities.caip345.caip2);
  const hashes = storedSendCalls.result.capabilities.caip345.transactionHashes;
  const allPromises = await Promise.allSettled(
    hashes.map((hash) => getTransactionReceipt(chainId.reference, hash, getHttpProvider)),
  );
  const receipts = allPromises
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r) => r);

  // log failed transactions
  allPromises
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.warn("Failed to fetch transaction receipt:", r.reason));

  const someReceiptsPending = !receipts.length || receipts.some((r) => !r);
  const allReceiptsSuccessful = receipts.every((r) => r?.status === "0x1");
  const allReceiptsFailed = receipts.every((r) => r?.status === "0x0");
  const someReceiptsFailed = receipts.some((r) => r?.status === "0x0");

  let status;
  if (someReceiptsPending) {
    //100 = some pending
    status = 100;
  } else if (allReceiptsSuccessful) {
    // 200 = all successful
    status = 200;
  } else if (allReceiptsFailed) {
    // 500 = all failed
    status = 500;
  } else if (someReceiptsFailed) {
    // 600 = some failures
    status = 600;
  }

  return {
    id: storedSendCalls.result.id,
    version: storedSendCalls.request.version,
    atomic: storedSendCalls.request.atomicRequired,
    chainId: storedSendCalls.request.chainId,
    capabilities: storedSendCalls.result.capabilities,
    receipts,
    status,
  };
}

export async function getTransactionReceipt(
  chainId: string,
  transactionHash: string,
  getHttpProvider: (chainId: number) => JsonRpcProvider,
) {
  return await getHttpProvider(parseInt(chainId)).request(
    formatJsonRpcRequest("eth_getTransactionReceipt", [transactionHash]),
  );
}

export async function storeSendCalls({
  sendCalls,
  storage,
}: {
  sendCalls: StoreSendCallsParams;
  storage: Storage;
}) {
  const sendCallsStatusResults =
    await storage.getItem<Record<string, StoredSendCalls>>(CALL_STATUS_STORAGE_KEY);

  await storage.setItem(CALL_STATUS_STORAGE_KEY, {
    ...sendCallsStatusResults,
    [sendCalls.result.id]: {
      request: sendCalls.request,
      result: sendCalls.result,
      expiry: calcExpiry(CALL_STATUS_RESULT_EXPIRY),
    },
  });
}

export async function deleteSendCallsResult({
  resultId,
  storage,
}: {
  resultId: string;
  storage: Storage;
}) {
  const sendCallsStatusResults =
    await storage.getItem<Record<string, StoredSendCalls>>(CALL_STATUS_STORAGE_KEY);
  if (!sendCallsStatusResults) return;

  delete sendCallsStatusResults[resultId];
  await storage.setItem(CALL_STATUS_STORAGE_KEY, sendCallsStatusResults);

  // delete old expired results
  for (const resultId in sendCallsStatusResults) {
    if (isExpired(sendCallsStatusResults[resultId].expiry)) {
      delete sendCallsStatusResults[resultId];
    }
  }
  await storage.setItem(CALL_STATUS_STORAGE_KEY, sendCallsStatusResults);
}

export async function getStoredSendCalls({
  resultId,
  storage,
}: {
  resultId: string;
  storage: Storage;
}): Promise<StoredSendCalls | undefined> {
  const storedSendCalls =
    await storage.getItem<Record<string, StoredSendCalls>>(CALL_STATUS_STORAGE_KEY);

  const result = storedSendCalls?.[resultId];
  if (result && !isExpired(result.expiry)) {
    return result;
  } else {
    await deleteSendCallsResult({ resultId, storage });
  }

  return undefined;
}
