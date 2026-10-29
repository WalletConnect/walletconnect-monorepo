import { RELAYER_SDK_VERSION } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";
import { parseAccountId } from "@walletconnect/utils";

import { WALLET_FEE_API_URL, WALLET_FEE_TIMEOUT_MS } from "../constants/index.js";
import { WalletFee } from "../types/index.js";

/**
 * Fetches the wallet's fee config for this app. Never throws: any failure resolves `undefined`,
 * and so does a config with no recipients and no referral code.
 */
export async function fetchWalletFeeConfig({
  apiUrl = WALLET_FEE_API_URL,
  projectId,
  walletId,
  logger,
}: {
  apiUrl?: string;
  projectId?: string;
  walletId: string;
  logger: Logger;
}): Promise<WalletFee | undefined> {
  const params = new URLSearchParams({
    projectId: projectId ?? "",
    walletId,
    st: "universal-provider",
    sv: `js-${RELAYER_SDK_VERSION}`,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WALLET_FEE_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}/wallet-fee/v1/config?${params}`, {
      signal: controller.signal,
      // the API's CDN serves cached responses with a long max-age, so skip the browser cache
      cache: "no-store",
    });
    if (response.status === 204) {
      logger.info("No wallet fee config for this app");
      return undefined;
    }
    // error bodies are plain text, so they aren't parsed
    if (!response.ok) {
      logger.warn(`Failed to load the wallet fee config: status ${response.status}`);
      return undefined;
    }
    const config = parseWalletFeeConfig(await response.json());
    if (!config) {
      logger.warn("Ignoring a malformed wallet fee config");
      return undefined;
    }
    if (!config.recipients.length && !config.referralCode) {
      logger.info("The wallet fee config has no recipients and no referral code");
      return undefined;
    }
    return config;
  } catch (error) {
    logger.warn(error, "Failed to load the wallet fee config");
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function parseWalletFeeConfig(value: any): WalletFee | undefined {
  if (!Array.isArray(value?.recipients)) return undefined;
  const feeBps = value.feeBps ?? undefined;
  const referralCode = value.referralCode ?? undefined;
  if (feeBps !== undefined && typeof feeBps !== "number") return undefined;
  if (referralCode !== undefined && typeof referralCode !== "string") return undefined;
  const recipients = value.recipients.flatMap((account: unknown) => {
    const recipient = parseRecipient(account);
    return recipient ? [recipient] : [];
  });
  return { feeBps, referralCode, recipients };
}

// parses a CAIP-10 account, or returns `undefined` if it's malformed
function parseRecipient(account: unknown): WalletFee["recipients"][number] | undefined {
  if (typeof account !== "string" || account.split(":").length !== 3) return undefined;
  const { namespace, reference, address } = parseAccountId(account);
  if (!namespace || !reference || !address) return undefined;
  return { chainId: `${namespace}:${reference}`, address };
}

export function isSameWalletFee(a?: WalletFee, b?: WalletFee): boolean {
  if (!a || !b) return a === b;
  return (
    a.feeBps === b.feeBps &&
    a.referralCode === b.referralCode &&
    a.recipients.length === b.recipients.length &&
    a.recipients.every(
      (recipient, i) =>
        recipient.chainId === b.recipients[i].chainId &&
        recipient.address === b.recipients[i].address,
    )
  );
}
