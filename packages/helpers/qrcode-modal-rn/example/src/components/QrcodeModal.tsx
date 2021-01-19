import * as React from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import QrCode from "react-native-qrcode-svg";

import { formatWebDirect } from "../constants";
import useWalletConnectProvider from "../hooks/useWalletConnectProvider";
import { RenderQrcodeModalParams, WalletConnectProvider } from "../types";

import FadeOnChangeText from "./FadeOnChangeText";
import WalletConnectLogo, { aspectRatio as logoAspectRatio } from "./WalletConnectLogo";
import WalletConnectProviderListItem from "./WalletConnectProviderListItem";


const duration = 250;
const fadeDuration = 120;
const textContainerHeight = 60;

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000000",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 15,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { textAlign: "center" },
  flex: { flex: 1 },
  fullWidth: { width: "100%" },
  header: { paddingHorizontal: 5, paddingBottom: 15 },
  noOverflow: { overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center" },
  shadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  textColor: { color: "#8B8F99" },
  textContainer: { height: textContainerHeight },
  headerText: {
    fontWeight: "600",
  },
  footerText: {},
});

const useNativeDriver = Platform.OS !== "web";

export default function QrcodeModal({
  uri,
  data,
  visible,
  requestDismiss,
  mobileRedirectUrl,
}: RenderQrcodeModalParams): JSX.Element {
  // By default, show the Qrcode on the Web.
  const [showQrcode, setShowQrcode] = React.useState<boolean>(Platform.OS === "web");
  const createAnimatedValue = React.useCallback(
    (): Animated.Value => new Animated.Value(visible ? 1 : 0),
    [visible],
  );

  const opacity = React.useMemo<Animated.Value>(createAnimatedValue, []);
  const translateY = React.useMemo<Animated.Value>(createAnimatedValue, []);

  const { connect } = useWalletConnectProvider({
    redirectUrl: Platform.OS === "web" ? formatWebDirect() : mobileRedirectUrl,
  });

  React.useEffect(() => {
    const toValue = visible ? 1 : 0;
    Animated.parallel([
      Animated.timing(opacity, {
        useNativeDriver,
        toValue,
        duration,
        easing: Easing.ease,
      }),
      Animated.spring(translateY, {
        useNativeDriver,
        toValue,
        tension: 10,
        friction: 6,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  const keyExtractor = React.useCallback(({ name, deepLink }: WalletConnectProvider): string => {
    return `${name}${deepLink}`;
  }, []);

  const { height: windowHeight } = useWindowDimensions();
  const ref = React.useRef<ScrollView>();
  const height = windowHeight * 0.4;
  const width = height * 0.75;
  const logoWidth = width * 0.7;
  const logoHeight = logoWidth * logoAspectRatio;
  const [didCopyText, setDidCopyText] = React.useState<boolean>(false);

  React.useEffect(() => {
    /* reset */
    !visible &&
      setTimeout(() => {
        !!didCopyText && setDidCopyText(false);
        Platform.OS !== "web" && setShowQrcode(false);
      }, 120);
  }, [didCopyText, visible, setShowQrcode]);

  const onPressWallet = React.useCallback(
    async (provider: WalletConnectProvider): Promise<void> => {
      try {
        if (typeof uri !== "string" || !uri.length) {
          // eslint-disable-next-line functional/no-throw-statement
          throw new Error(`Expected non-empty string uri, encountered ${uri}.`);
        }
        await connect(uri, provider);
      } catch (e) {
        console.error(e);
      }
    },
    [connect, uri],
  );

  const onPressBottomTab = React.useCallback(() => {
    if (Platform.OS === "web") {
      try {
        navigator.clipboard.writeText(uri);
        setDidCopyText(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      setShowQrcode((e) => !e);
    }
  }, [setShowQrcode, showQrcode, width, uri, setDidCopyText]);

  React.useEffect(() => {
    /* scroll render sync */
    ref.current.scrollTo({
      x: showQrcode ? width : 0,
    });
  }, [showQrcode]);

  const renderItem = React.useCallback(
    ({ item }): JSX.Element => {
      return (
        <WalletConnectProviderListItem
          {...item}
          onPress={() => onPressWallet(item)}
          height={(height - 2 * textContainerHeight) * 0.25}
        />
      );
    },
    [height, onPressWallet],
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.center, styles.noOverflow]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {/* bg */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={requestDismiss}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            { opacity: Animated.multiply(opacity, 0.85) },
          ]}
        />
      </TouchableOpacity>
      {/* root */}
      <Animated.View
        style={[
          styles.fullWidth,
          styles.center,
          {
            opacity,
            transform: [
              {
                translateY: Animated.multiply(
                  Animated.add(1, Animated.multiply(translateY, -1)),
                  logoHeight,
                ),
              },
            ],
          },
        ]}
      >
        <View style={[styles.header, styles.center, { width }]}>
          <WalletConnectLogo width={logoWidth} />
        </View>
      </Animated.View>
      <Animated.View
        style={[
          {
            transform: [
              {
                translateY: Animated.multiply(
                  Animated.add(1, Animated.multiply(translateY, -1)),
                  windowHeight,
                ),
              },
            ],
          },
        ]}
      >
        <View
          pointerEvents="box-none"
          style={[{ width, height }, styles.container, styles.shadow, styles.noOverflow]}
        >
          <View style={[styles.textContainer, styles.center]}>
            <FadeOnChangeText
              duration={fadeDuration}
              style={[styles.textColor, styles.headerText, styles.centerText]}
              children={
                showQrcode
                  ? "Scan QR with a WalletConnect-compatible wallet"
                  : "Choose your preferred wallet"
              }
            />
          </View>
          <ScrollView
            pagingEnabled
            scrollEnabled={false}
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <FlatList
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              style={[{ width }]}
              data={data}
            />
            <View
              style={[
                styles.center,
                styles.flex,
                {
                  width,
                },
              ]}
            >
              {!!uri.length && <QrCode size={width * 0.8} value={uri} />}
            </View>
          </ScrollView>
          <TouchableOpacity
            style={[styles.textContainer, styles.center]}
            onPress={onPressBottomTab}
          >
            {/* Only render the wallet list on Mobile clients. */}
            <FadeOnChangeText
              duration={Platform.OS === "web" ? 0 : fadeDuration}
              style={[styles.textColor, styles.footerText, styles.centerText]}
              children={
                Platform.OS === "web"
                  ? didCopyText
                    ? "Copied!"
                    : "Copy to clipboard"
                  : showQrcode
                  ? "Return to mobile wallet options"
                  : "View QR code instead"
              }
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
