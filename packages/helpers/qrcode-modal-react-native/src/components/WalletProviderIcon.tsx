import * as React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { WalletProvider } from '../types';

// eslint-disable-next-line functional/no-mixed-type
export type WalletProviderIconProps = {
  readonly width: number;
  readonly height: number;
  readonly provider: WalletProvider;
  readonly connectToProvider: (provider: WalletProvider) => unknown;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  fullWidth: { width: '100%' },
  icon: { borderRadius: 15 },
  noOverflow: { overflow: 'hidden' },
  title: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  padding: { padding: 5 },
});

export default function WalletProviderIcon({
  width,
  height,
  provider,
  connectToProvider,
}: WalletProviderIconProps): JSX.Element {
  const onPress = React.useCallback(() => (
    connectToProvider(provider)
  ), [connectToProvider, provider]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        { width, height },
        styles.container,
        styles.padding,
      ]}>
      <Image
        style={[
          styles.icon,
          {
            width: height * 0.6,
            height: height * 0.6,
          },
        ]}
        source={{ uri: provider.logo }}
      />
      <Text
        style={[styles.title, styles.fullWidth]}
        numberOfLines={1}
        ellipsizeMode="tail">
        {provider.name}
      </Text>
    </TouchableOpacity>
  );
}
