import '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAsyncStorage } from 'keyvaluestorage/dist/cjs/react-native/types';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { expo } from '../app.json';

import { useQrcodeModal, useWalletConnect } from './hooks';

const { scheme: deepLinkUriScheme } = expo;

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default function App(): JSX.Element {
  const { renderQrcodeModal, qrcodeModal } = useQrcodeModal({
    redirectUrl: Platform.OS === 'web' ? window.location.origin : `${deepLinkUriScheme}://`,
  });
  const { connector, ...extras } = useWalletConnect({
    qrcodeModal,
    storageOptions: {
      asyncStorage: AsyncStorage as unknown as IAsyncStorage<string, unknown>,
    },
  });
  const connect = React.useCallback(async () => {
    try {
      await connector.connect();
    } catch (e) {
      console.error(e);
    }
  }, [connector]);
  const signTransaction = React.useCallback(async () => {
    try {
      await connector.signTransaction({
        from: '0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3',
        to: '0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359',
        data: '0x',
        gasPrice: '0x02540be400',
        gas: '0x9c40',
        value: '0x00',
        nonce: '0x0114',
      });
    } catch (e) {
      console.error(e);
    }
  }, [connector]);
  const killSession = React.useCallback(async () => {
    try {
      await connector.killSession();
    } catch (e) {
      console.error(e);
    }
  }, [connector]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      {!connector || !connector.connected && (
        <TouchableOpacity onPress={connect}>
          <Text>Connect to WalletConnect</Text>
        </TouchableOpacity>
      )}
      {!!connector && connector.connected && (
        <>
          <TouchableOpacity onPress={signTransaction}>
            <Text>Sign Transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={killSession}>
            <Text>Kill Session</Text>
          </TouchableOpacity>
        </>
      )}
      {renderQrcodeModal(extras)}
    </View>
  );
}