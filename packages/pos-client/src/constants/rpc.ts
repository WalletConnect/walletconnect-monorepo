import { POS_CLIENT_VERSION } from "./client.js";

export const RPC_URL = ({ projectId, deviceId }: { projectId: string; deviceId: string }) => {
  return `https://rpc.walletconnect.org/v1/json-rpc?projectId=${projectId}&st=node&sv=js-pos-${POS_CLIENT_VERSION}&deviceId=${deviceId}`;
};

export const RPC_ERROR_CODES = {
  "-18901": "ValidationError.InvalidAsset",
  "-18902": "ValidationError.InvalidRecipient",
  "-18903": "ValidationError.InvalidSender",
  "-18904": "ValidationError.InvalidAmount",
  "-18905": "ValidationError.InvalidAddress",
  "-18906": "ValidationError.InvalidWalletResponse",
  "-18907": "ValidationError.InvalidTransactionId",
  "-18920": "ExecutionError.GasEstimation",
  "-18940": "InternalError.InvalidProviderUrl",
  "-18941": "InternalError.RpcError",
  "-18942": "InternalError.Internal",
  "-18970": "TransactionIdError.InvalidFormat",
  "-18971": "TransactionIdError.InvalidChainId",
};
