import { Platform } from 'react-native';

import { WalletConnectProvider } from '../types';

export default function formatProviderUrl(provider: WalletConnectProvider): string {
  const { deepLink, universalLink } = provider;
  return `${Platform.OS === 'android' ? deepLink : universalLink}`;
}
