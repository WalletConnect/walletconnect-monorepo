import { BigNumber, BigNumberish, providers, utils } from "ethers";
import * as encoding from "@walletconnect/encoding";
import { TypedDataUtils } from "eth-sig-util";
import * as ethUtil from "ethereumjs-util";
import { fromBase64, fromHex, toHex, toBase64, Bech32 } from "@cosmjs/encoding";
import {
  makeSignBytes,
  makeSignDoc,
  decodePubkey,
  encodePubkey,
  makeAuthInfoBytes,
} from "@cosmjs/proto-signing";
import {
  pubkeyToAddress,
  rawSecp256k1PubkeyToRawAddress,
  encodeSecp256k1Pubkey,
  decodeAminoPubkey,
  pubkeyToRawAddress,
} from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256, ExtendedSecp256k1Signature } from "@cosmjs/crypto";

import { eip1271 } from "./eip1271";

export function capitalize(string: string): string {
  return string
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function ellipseText(text = "", maxLength = 9999): string {
  if (text.length <= maxLength) {
    return text;
  }
  const _maxLength = maxLength - 3;
  let ellipse = false;
  let currentLength = 0;
  const result =
    text
      .split(" ")
      .filter(word => {
        currentLength += word.length;
        if (ellipse || currentLength >= _maxLength) {
          ellipse = true;
          return false;
        } else {
          return true;
        }
      })
      .join(" ") + "...";
  return result;
}

export function ellipseAddress(address = "", width = 10): string {
  return `${address.slice(0, width)}...${address.slice(-width)}`;
}

export function getDataString(func: string, arrVals: any[]): string {
  let val = "";
  for (let i = 0; i < arrVals.length; i++) {
    val += encoding.padLeft(arrVals[i], 64);
  }
  const data = func + val;
  return data;
}

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

export function encodePersonalMessage(msg: string): string {
  const data = encoding.utf8ToBuffer(msg);
  const buf = Buffer.concat([
    Buffer.from("\u0019Ethereum Signed Message:\n" + data.length.toString(), "utf8"),
    data,
  ]);
  return ethUtil.bufferToHex(buf);
}

export function hashPersonalMessage(msg: string): string {
  const data = encodePersonalMessage(msg);
  const buf = ethUtil.toBuffer(data);
  const hash = ethUtil.keccak256(buf);
  return ethUtil.bufferToHex(hash);
}

export function encodeTypedDataMessage(msg: string): string {
  const data = TypedDataUtils.sanitizeData(JSON.parse(msg));
  const buf = Buffer.concat([
    Buffer.from("1901", "hex"),
    TypedDataUtils.hashStruct("EIP712Domain", data.domain, data.types),
    TypedDataUtils.hashStruct(data.primaryType as string, data.message, data.types),
  ]);
  return ethUtil.bufferToHex(buf);
}

export function hashTypedDataMessage(msg: string): string {
  const data = encodeTypedDataMessage(msg);
  const buf = ethUtil.toBuffer(data);
  const hash = ethUtil.keccak256(buf);
  return ethUtil.bufferToHex(hash);
}

export function recoverAddress(sig: string, hash: string): string {
  const params = ethUtil.fromRpcSig(sig);
  const result = ethUtil.ecrecover(ethUtil.toBuffer(hash), params.v, params.r, params.s);
  const signer = ethUtil.bufferToHex(ethUtil.publicToAddress(result));
  return signer;
}

export function recoverPersonalSignature(sig: string, msg: string): string {
  const hash = hashPersonalMessage(msg);
  const signer = recoverAddress(sig, hash);
  return signer;
}

export function recoverTypedMessage(sig: string, msg: string): string {
  const hash = hashTypedDataMessage(msg);
  const signer = recoverAddress(sig, hash);
  return signer;
}

export async function verifySignature(
  address: string,
  sig: string,
  hash: string,
  rpcUrl: string,
): Promise<boolean> {
  const provider = new providers.JsonRpcProvider(rpcUrl);
  const bytecode = await provider.getCode(address);
  if (!bytecode || bytecode === "0x" || bytecode === "0x0" || bytecode === "0x00") {
    const signer = recoverAddress(sig, hash);
    return signer.toLowerCase() === address.toLowerCase();
  } else {
    return eip1271.isValidSignature(address, sig, hash, provider);
  }
}

export async function verifyCosmosSignature(
  address: string,
  signature: string,
  hash: Uint8Array,
): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    const sig = Secp256k1Signature.fromFixedLength(fromBase64(signature));
    const extendedSig = new ExtendedSecp256k1Signature(sig.r(), sig.s(), i);
    try {
      const recoveredPubKey = await Secp256k1.recoverPubkey(extendedSig, hash);
      const recoveredAddress = pubkeyToAddress(
        {
          type: "tendermint/PubKeySecp256k1",
          value: toBase64(Secp256k1.compressPubkey(recoveredPubKey)),
        },
        "cosmos",
      );
      if (recoveredAddress === address) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function convertHexToNumber(hex: string) {
  try {
    return encoding.hexToNumber(hex);
  } catch (e) {
    return hex;
  }
}

export function convertHexToUtf8(hex: string) {
  try {
    return encoding.hexToUtf8(hex);
  } catch (e) {
    return hex;
  }
}

export const sanitizeDecimals = (value: string, decimals = 18): string => {
  const [integer, fractional] = value.split(".");
  const _fractional = fractional
    ? fractional.substring(0, decimals).replace(/0+$/gi, "")
    : undefined;
  return _fractional ? [integer, _fractional].join(".") : integer;
};

export const toWad = (amount: string, decimals = 18): BigNumber => {
  return utils.parseUnits(sanitizeDecimals(amount, decimals), decimals);
};

export const fromWad = (wad: BigNumberish, decimals = 18): string => {
  return sanitizeDecimals(utils.formatUnits(wad, decimals), decimals);
};

export const LOCALSTORAGE_KEY_TESTNET = "TESTNET";
export const INITIAL_STATE_TESTNET_DEFAULT = true;

export function setInitialStateTestnet(value: boolean): void {
  window.localStorage.setItem(LOCALSTORAGE_KEY_TESTNET, `${value}`);
}

export function getInitialStateTestnet(): boolean {
  let value = INITIAL_STATE_TESTNET_DEFAULT;
  const persisted = window.localStorage.getItem(LOCALSTORAGE_KEY_TESTNET);
  if (!persisted) {
    setInitialStateTestnet(value);
  } else {
    value = persisted === "true" ? true : false;
  }
  return value;
}
