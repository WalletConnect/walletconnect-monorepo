import { RELAYER_SDK_VERSION } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";

import { WALLET_FEE_API_URL, WALLET_FEE_TIMEOUT_MS } from "../constants/index.js";
import { WalletFee, WalletFeeConfig } from "../types/index.js";

/**
 * Fetches the wallet's fee config for this app. Never throws: any failure resolves `undefined`.
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
}): Promise<WalletFeeConfig | undefined> {
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
    if (!config) logger.warn("Ignoring a malformed wallet fee config");
    return config;
  } catch (error) {
    logger.warn(error, "Failed to load the wallet fee config");
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function parseWalletFeeConfig(value: any): WalletFeeConfig | undefined {
  if (!Array.isArray(value?.recipients)) return undefined;
  const feeBps = value.feeBps ?? undefined;
  const referralCode = value.referralCode ?? undefined;
  if (feeBps !== undefined && typeof feeBps !== "number") return undefined;
  if (referralCode !== undefined && typeof referralCode !== "string") return undefined;
  const recipients = value.recipients.filter((r: unknown) => typeof r === "string");
  return { feeBps, recipients, referralCode };
}

/**
 * Picks the part of the config that applies to `chainId` (CAIP-2), or `undefined` if nothing does.
 */
export function selectWalletFee(config: WalletFeeConfig, chainId: string): WalletFee | undefined {
  const prefix = `${chainId}:`;
  const recipient = config.recipients
    .find((account) => account.startsWith(prefix) && account.length > prefix.length)
    ?.slice(prefix.length);
  const { feeBps, referralCode } = config;
  if (!recipient && !referralCode) return undefined;
  return { chainId, feeBps, recipient, referralCode };
}

export function isSameWalletFee(a?: WalletFee, b?: WalletFee): boolean {
  return (
    a?.chainId === b?.chainId &&
    a?.feeBps === b?.feeBps &&
    a?.recipient === b?.recipient &&
    a?.referralCode === b?.referralCode
  );
}
