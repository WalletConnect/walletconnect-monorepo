import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import useProvider from '../hooks/useProvider';
import type { QrcodeModalProps, WalletConnectProvider } from '../types';

import AnimatedModal from './AnimatedModal';
import WalletConnectLogo from './WalletConnectLogo';

export default function QrcodeModal({
  visible,
  uri,
  redirectUrl,
  providers,
  setProvider,
}: QrcodeModalProps): JSX.Element {
  const { connect } = useProvider({ redirectUrl });
  const onPressConnect = React.useCallback(async (provider: WalletConnectProvider) => {
    try {
      await connect(provider, uri);
      await setProvider(provider);
    } catch (e) {
      console.error(e);
    }
  }, [uri, connect, setProvider]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AnimatedModal visible={visible} duration={1000}>
        <>
          {typeof uri === 'string' && !!uri.length && (
            <QRCode value={uri} />
          )}
          <WalletConnectLogo width={200} />
          {providers.map((provider: WalletConnectProvider, i: number): JSX.Element => (
            <TouchableOpacity key={`k${i}`} onPress={() => onPressConnect(provider)}>
              <Text>{provider.name}</Text>
            </TouchableOpacity>
          ))}
        </>
      </AnimatedModal>
    </View>
  );
}
