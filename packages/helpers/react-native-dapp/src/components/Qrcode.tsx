import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import QR from 'react-native-qrcode-svg';

import Logo from '../assets/walletconnect-logo.png';

export type QrcodeProps = {
  readonly uri?: string;
  readonly size: number;
};

const padding = 15;

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qr: {
    padding,
    backgroundColor: 'white',
    overflow: 'hidden',
    borderRadius: padding,
  },
});

export default function Qrcode({
  size,
  uri,
}: QrcodeProps): JSX.Element {
  return (
    <View style={[{ width: size, height: size }, styles.center, styles.qr]}>
      {typeof uri === 'string' && !!uri.length && (
        // @ts-ignore
        <QR logo={Logo} logoSize={size * 0.2} value={uri} size={size - padding * 2 } />
      )}
    </View>
  );
}
