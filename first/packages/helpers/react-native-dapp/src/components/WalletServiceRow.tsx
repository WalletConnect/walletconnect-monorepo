import * as React from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';

import { WalletService } from '../types';

import WalletServiceIcon from './WalletServiceIcon';

// eslint-disable-next-line functional/no-mixed-type
export type WalletServiceRowProps = {
  readonly style?: unknown;
  readonly walletServices: readonly WalletService[];
  readonly width: number;
  readonly height: number;
  readonly division: number;
  readonly connectToWalletService: (walletService: WalletService) => unknown;
};

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row' },
});

export default function WalletServiceRow({
  style,
  width,
  height,
  walletServices,
  division,
  connectToWalletService,
}: WalletServiceRowProps): JSX.Element {
  return (
    <Animated.View style={[{ width, height }, styles.row, StyleSheet.flatten(style as ViewStyle)]}>
      {walletServices.map((walletService: WalletService, i: number) => (
        <WalletServiceIcon
          key={`i${i}`}
          width={width / division}
          height={height}
          walletService={walletService}
          connectToWalletService={connectToWalletService}
        />
      ))}
    </Animated.View>
  );
};