# WalletConnect QR Code Modal for React Native

React Native QR Code Modal for WalletConnect

For more details, read the [documentation](https://docs.walletconnect.org)

```typescript
import WalletConnect from "@walletconnect/client";
import { useQrcodeModal } from "@walletconnect/qrcode-modal-react-native";
import * as React from "react";

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

export default function App(): JSX.Element {
  /**
   *  Define the WalletConnect Modal.
   *    - redirectUrl: the deep link scheme for your app.
   */
  const { qrcodeModal, renderQrcodeModal } = useQrcodeModal({
    redirectUrl: `myapp://`,
  });
  /**
   *  Allocate the connector and supply the qrcodeModal.
   */
  const connector = React.useMemo<WalletConnect>(() => new WalletConnect({
      bridge: "https://bridge.walletconnect.org",
      qrcodeModal,
      clientMeta: {
        description: "React Native WalletConnect Example",
        url: "https://walletconnect.org",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
        name: "WalletConnect",
      },
    }),
    [],
  );
  /**
   *  Connect! 🎉
   */
  React.useEffect(() => {
    (async () => {
      try {
        await connector.connect();
      } catch (e) {
        console.error(e);
      }
    })();
  }, [connector]);
  /**
   *  Render the Qrcode Modal.
   */
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Text>Welcome to React Native!</Text>
      {renderQrcodeModal()}
    </View>
  );
}
```
