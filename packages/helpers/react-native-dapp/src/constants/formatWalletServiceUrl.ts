import { Platform } from 'react-native';

import { WalletService } from '../types';

export default function formatProviderUrl(walletService: WalletService): string {
  const { deepLink, universalLink } = walletService;
  return `${Platform.OS === 'android' ? deepLink : universalLink}`;
}
