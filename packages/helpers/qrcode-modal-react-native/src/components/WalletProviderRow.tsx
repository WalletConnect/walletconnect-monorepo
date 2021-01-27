import * as React from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

import { WalletProvider } from '../types';

import WalletProviderIcon from './WalletProviderIcon';

// eslint-disable-next-line functional/no-mixed-type
export type WalletProviderRowProps = {
  readonly style?: unknown;
  readonly providers: readonly WalletProvider[];
  readonly width: number;
  readonly height: number;
  readonly division: number;
  readonly connectToProvider: (provider: WalletProvider) => unknown;
};

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
});

export default function WalletProviderRow({
  style,
  width,
  height,
  providers,
  division,
  connectToProvider,
}: WalletProviderRowProps): JSX.Element {
  return (
    <Animated.View style={[{ width, height }, styles.row, StyleSheet.flatten(style as ViewStyle)]}>
      {providers.map((provider: WalletProvider, i: number) => (
        <WalletProviderIcon
          key={`i${i}`}
          width={width / division}
          height={height}
          provider={provider}
          connectToProvider={connectToProvider}
        />
      ))}
    </Animated.View>
  );
};