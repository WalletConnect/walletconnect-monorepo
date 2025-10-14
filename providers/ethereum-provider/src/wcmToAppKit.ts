import type { AppKitOptions, CaipNetwork, CaipNetworkId } from "@reown/appkit";
import type { WalletConnectModalConfig, Assign, ChainFormatters, Prettify } from "./types.js";
import type { AppKitNetwork } from "@reown/appkit/networks";
import type { EthereumProviderOptions } from "./EthereumProvider.js";

function convertThemeVariables(
  wcmTheme?: WalletConnectModalConfig["themeVariables"],
): AppKitOptions["themeVariables"] | undefined {
  if (!wcmTheme) return undefined;

  return {
    "--w3m-font-family": wcmTheme["--wcm-font-family"],
    "--w3m-accent": wcmTheme["--wcm-accent-color"],
    "--w3m-color-mix": wcmTheme["--wcm-background-color"],
    "--w3m-z-index": wcmTheme["--wcm-z-index"] ? Number(wcmTheme["--wcm-z-index"]) : undefined,

    "--w3m-qr-color": wcmTheme["--wcm-accent-color"],

    "--w3m-font-size-master": wcmTheme["--wcm-text-medium-regular-size"],
    "--w3m-border-radius-master": wcmTheme["--wcm-container-border-radius"],
    "--w3m-color-mix-strength": 0,
  };
}

const mapCaipIdToAppKitCaipNetwork = (caipId: CaipNetworkId): CaipNetwork => {
  const [namespace, chainId] = caipId.split(":");
  const chain = defineChain({
    id: chainId,
    caipNetworkId: caipId,
    chainNamespace: namespace as CaipNetwork["chainNamespace"],
    name: "",
    nativeCurrency: {
      name: "",
      symbol: "",
      decimals: 8,
    },
    rpcUrls: {
      default: { http: ["https://rpc.walletconnect.org/v1"] },
    },
  });

  return chain as CaipNetwork;
};

export function convertWCMToAppKitOptions(
  wcmConfig: WalletConnectModalConfig & { metadata?: EthereumProviderOptions["metadata"] },
): AppKitOptions {
  // Convert chains toCaipNetwork format
  const networks: CaipNetwork[] = (wcmConfig.chains as CaipNetworkId[])
    ?.map(mapCaipIdToAppKitCaipNetwork)
    .filter(Boolean);

  // Ensure at least one network is present
  if (networks.length === 0) {
    throw new Error("At least one chain must be specified");
  }

  const defaultNetwork = networks.find((network) => network.id === wcmConfig.defaultChain?.id);
  const appKitOptions: AppKitOptions = {
    projectId: wcmConfig.projectId,
    networks: networks as [AppKitNetwork, ...AppKitNetwork[]],
    themeMode: wcmConfig.themeMode,
    themeVariables: convertThemeVariables(wcmConfig.themeVariables),
    chainImages: wcmConfig.chainImages,
    connectorImages: wcmConfig.walletImages,
    defaultNetwork,
    metadata: {
      ...wcmConfig.metadata,
      name: wcmConfig.metadata?.name || "WalletConnect",
      description: wcmConfig.metadata?.description || "Connect to WalletConnect-compatible wallets",
      url: wcmConfig.metadata?.url || "https://walletconnect.org",
      icons: wcmConfig.metadata?.icons || ["https://walletconnect.org/walletconnect-logo.png"],
    },
    showWallets: true,
    // Explorer options mapping
    featuredWalletIds:
      wcmConfig.explorerRecommendedWalletIds === "NONE"
        ? []
        : Array.isArray(wcmConfig.explorerRecommendedWalletIds)
          ? wcmConfig.explorerRecommendedWalletIds
          : [],

    excludeWalletIds:
      wcmConfig.explorerExcludedWalletIds === "ALL"
        ? []
        : Array.isArray(wcmConfig.explorerExcludedWalletIds)
          ? wcmConfig.explorerExcludedWalletIds
          : [],

    // Additional AppKit-specific options that don't have direct WCM equivalents
    enableEIP6963: false, // Disable 6963 by default
    enableInjected: false, // Disable injected by default
    enableCoinbase: true, // Default to true
    enableWalletConnect: true, // Default to true,
    features: {
      email: false,
      socials: false,
    },
  };

  // Add mobile and desktop wallets as custom wallets if provided
  if (wcmConfig.mobileWallets?.length || wcmConfig.desktopWallets?.length) {
    const customWallets = [
      ...(wcmConfig.mobileWallets || []).map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        links: wallet.links,
      })),
      ...(wcmConfig.desktopWallets || []).map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        links: {
          native: wallet.links.native,
          universal: wallet.links.universal,
        },
      })),
    ];

    const allWallets = [
      ...(appKitOptions.featuredWalletIds || []),
      ...(appKitOptions.excludeWalletIds || []),
    ];

    // Only add a custom wallet if it's not on the other lists
    const uniqueCustomWallets = customWallets.filter((wallet) => !allWallets.includes(wallet.id));

    if (uniqueCustomWallets.length) {
      appKitOptions.customWallets = uniqueCustomWallets;
    }
  }

  return appKitOptions;
}

export function defineChain<
  formatters extends ChainFormatters,
  const chain extends CaipNetwork<formatters>,
>(chain: chain): Prettify<Assign<CaipNetwork<undefined>, chain>> {
  return {
    formatters: undefined,
    fees: undefined,
    serializers: undefined,
    ...chain,
  } as Assign<CaipNetwork<undefined>, chain>;
}
