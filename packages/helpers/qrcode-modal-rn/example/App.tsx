import WalletConnect from "@walletconnect/client";
import React from "react";
import { Button, StyleSheet, View } from "react-native";

import { expo } from "./app.json";
import { useQrcodeModal } from "./src";

const { scheme } = expo;

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

export default function App(): JSX.Element {
  const { qrcodeModal, renderQrcodeModal } = useQrcodeModal({
    redirectUrl: `${scheme}://`,
  });
  const onPress = React.useCallback(() => {
    (async () => {
      try {
        const connector = new WalletConnect({
          bridge: "https://bridge.walletconnect.org",
          qrcodeModal,
          clientMeta: {
            description: "React Native WalletConnect Example",
            url: "https://walletconnect.org",
            icons: ["https://walletconnect.org/walletconnect-logo.png"],
            name: "WalletConnect",
          },
        });
        await connector.connect();
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Button onPress={onPress} title="Open WalletConnect" />
      {renderQrcodeModal()}
    </View>
  );
}
