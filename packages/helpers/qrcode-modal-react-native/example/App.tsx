import WalletConnect from "@walletconnect/client";
import { useQrcodeModal } from "@walletconnect/qrcode-modal-react-native";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { expo } from "./app.json";

const { scheme } = expo;

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

export default function App(): JSX.Element {
  const { qrcodeModal, renderQrcodeModal } = useQrcodeModal({
    redirectUrl: `${scheme}://`,
  });
  const connector = React.useMemo<WalletConnect>(() => {
    const wc = new WalletConnect({
      bridge: "https://bridge.walletconnect.org",
      qrcodeModal,
      clientMeta: {
        description: "React Native WalletConnect Example",
        url: "https://walletconnect.org",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
        name: "WalletConnect",
      },
    });
    return wc;
  }, []);

  const [connected, setConnected] = React.useState<boolean>(connector.connected);

  const onPressOpen = React.useCallback(async () => {
    try {
      await connector.connect();
      setConnected(true);
    } catch (e) {
      console.error(e);
    }
  }, [setConnected]);

  const onPressSignTransaction = React.useCallback(async () => {
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

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      {(!connected) ? (
        <Button onPress={onPressOpen} title="Connect to WalletConnect" />
      ) : (
        <>
          <Text>You're connected! Try signing a transaction:</Text>
          <Button onPress={onPressSignTransaction} title="Sign a Transaction" />
        </>
      )}
      {renderQrcodeModal()}
    </View>
  );
}
