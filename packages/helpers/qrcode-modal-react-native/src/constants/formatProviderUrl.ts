import { Platform } from 'react-native';

import { WalletProvider } from '../types';

export default function formatProviderUrl(provider: WalletProvider): string {
  const { deepLink, universalLink } = provider;
  return `${Platform.OS === 'android' ? deepLink : universalLink}`;
}
