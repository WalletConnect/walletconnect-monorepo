import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnect, withWalletConnect } from '@walletconnect/react-native';
import { IAsyncStorage } from 'keyvaluestorage/dist/cjs/react-native/types';
import * as React from 'react';
import { Button, Platform, StyleSheet, View } from 'react-native';

import { expo } from '../app.json';

function App(): JSX.Element {
  const connector = useWalletConnect();
  const connect = React.useCallback(async () => {
    try {
      await connector.connect();
    } catch (e) {
      // console.error(e); i.e. "User close QRCode Modal"
    }
  }, [connector]);
  const signTransaction = React.useCallback(async () => {
    try {
      await connector.signTransaction({
        from: "0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3",
        to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359",
        data: "0x",
        gasPrice: "0x02540be400",
        gas: "0x9c40",
        value: "0x00",
        nonce: "0x0114",
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
    <View style={StyleSheet.absoluteFill}>
      <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        {!connector.connected ? (
          <Button title="Connect" onPress={connect} />
        ) : (
          <>
            <Button title="Sign Transaction" onPress={signTransaction} />
            <Button title="Kill Session" onPress={killSession} />
          </>
        )}
      </View>
    </View>
  );
}

const { scheme } = expo;

export default withWalletConnect(App, {
  redirectUrl: Platform.OS === 'web' ? window.location.origin : `${scheme}://`,
  storageOptions: {
    asyncStorage: AsyncStorage as unknown as IAsyncStorage<string, unknown>
  },
});
