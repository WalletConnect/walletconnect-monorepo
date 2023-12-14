import { AuthTypes } from "@walletconnect/types";
import { hashMessage } from "@ethersproject/hash";
import { recoverAddress } from "@ethersproject/transactions";

export async function verifySignature(
  address: string,
  reconstructedMessage: string,
  cacaoSignature: AuthTypes.CacaoSignature,
): Promise<boolean> {
  // Determine if this signature is from an EOA or a contract.
  switch (cacaoSignature.t) {
    case "eip191":
      return isValidEip191Signature(address, reconstructedMessage, cacaoSignature.s);
    // case "eip1271":
    // return await isValidEip1271Signature(
    //   address,
    //   reconstructedMessage,
    //   cacaoSignature.s,
    //   chainId,
    //   projectId,
    // );
    // break;
    default:
      throw new Error(
        `verifySignature failed: Attempted to verify CacaoSignature with unknown type: ${cacaoSignature.t}`,
      );
  }
}

function isValidEip191Signature(address: string, message: string, signature: string): boolean {
  const recoveredAddress = recoverAddress(hashMessage(message), signature);
  return recoveredAddress.toLowerCase() === address.toLowerCase();
}
