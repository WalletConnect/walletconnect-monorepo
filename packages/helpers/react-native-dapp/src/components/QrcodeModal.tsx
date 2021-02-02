import * as React from 'react';
import {
  Animated,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { RenderQrcodeModalProps, WalletService } from '../types';

import Qrcode from './Qrcode';
import WalletConnectLogo from './WalletConnectLogo';
import WalletServiceRow from './WalletServiceRow';

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
  black: { backgroundColor: 'black' },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  fullWidth: { width: '100%' },
  noOverflow: { overflow: 'hidden' },
  row: { alignItems: 'center', flexDirection: 'row' },
});

const useNativeDriver = Platform.OS !== 'web';

export default function QrcodeModal({
  visible,
  walletServices,
  connectToWalletService,
  uri,
  onDismiss,
  division,
}: RenderQrcodeModalProps & { readonly division: number }): JSX.Element {
  const shouldConnectToWalletService = React.useCallback(
    (walletService: WalletService) => connectToWalletService(walletService, uri),
    [connectToWalletService, uri],
  );
  const { width, height } = useWindowDimensions();
  const { opacity, logo, icons } = React.useMemo(() => ({
    opacity: new Animated.Value(0),
    logo: new Animated.Value(0),
    icons: new Animated.Value(0),
  }), []);
  const walletServiceRows = React.useMemo((): readonly (readonly WalletService[])[] => {
    return [...Array(Math.ceil(walletServices.length / division))]
      .map((_, i) => walletServices.slice(i * division, i * division + division));
  }, [walletServices, division]);

  const modalHeight = height * 0.4;
  const modalWidth = modalHeight * 0.9;

  const shouldAnimate = React.useCallback((totalDuration: number, direction: boolean) => {
    const sequence = [
      Animated.timing(opacity, {
        toValue: direction ? 1 : 0,
        duration: totalDuration * 0.5,
        useNativeDriver,
      }),
      Animated.delay(direction ? 0 : totalDuration * 0.4),
      Animated.parallel([
        Animated.sequence([
          Animated.delay(totalDuration * (direction ? 0.2 : 0)),
          Animated.timing(icons, {
            toValue: direction ? 1 : 0,
            duration: totalDuration * (direction ? 0.3 : 0.5),
            useNativeDriver,
          }),
        ]),
        Animated.timing(logo, {
          toValue: direction ? 1 : 0,
          duration: totalDuration * 0.5,
          useNativeDriver,
        }),
      ]),
    ];
    if (!direction) {
      sequence.reverse();
    }
    Animated.sequence(sequence).start();
  }, [opacity, logo, icons, division]);

  React.useEffect(() => {
    shouldAnimate(visible ? 600 : 600, visible);
  }, [shouldAnimate, visible]);

  const onPressLogo = React.useCallback(async () => {
    const url = 'https://walletconnect.org/';
    return (await Linking.canOpenURL(url)) && Linking.openURL(url);
  }, []);

  const keyExtractor = React.useCallback((walletServiceRow: readonly WalletService[]): string => {
    return `k${walletServiceRows.indexOf(walletServiceRow)}`;
  }, [walletServiceRows]);

  const renderItem = React.useCallback(({ item, index }): JSX.Element => {
    return (
      <WalletServiceRow
        key={`k${index}`}
        style={{ opacity: icons }}
        division={division}
        walletServices={item}
        width={modalWidth}
        height={modalHeight * 0.25}
        connectToWalletService={shouldConnectToWalletService}
      />
    );
  }, [modalWidth, modalHeight, division, icons, shouldConnectToWalletService]);

  const shouldRenderQrcode = Platform.OS === 'web';

  return (
    <Animated.View
      style={[
        styles.absolute,
        styles.noOverflow,
        {
          width,
          height,
          opacity,
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}>
      {/* backdrop */}
      <View style={StyleSheet.absoluteFill}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={0.98}>
          <Animated.View style={[styles.flex, { opacity: Animated.multiply(opacity, 0.95) }, styles.black]} />
        </TouchableOpacity>
      </View>
      {/* logo */}
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
        <Animated.View
          pointerEvents={visible ? 'box-none' : 'none'}
          style={{
            width: modalWidth,
            transform: [
              { translateY: Animated.multiply(modalHeight * (shouldRenderQrcode ? 0.5 : 0.6), logo) },
              { scale: Animated.add(1, Animated.multiply(logo, -0.2)) },
            ],
          }}>
          <TouchableOpacity onPress={onPressLogo}>
            <WalletConnectLogo width={modalWidth} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      {/* */}
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents={visible ? 'box-none' : 'none'}>
        <Animated.View style={{ width: modalWidth, height: modalHeight }}>
          {shouldRenderQrcode ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.center,
                { opacity: icons, transform: [{ scale: icons }] },
              ]}>
              <Qrcode uri={uri} size={modalHeight * 0.8} />
            </Animated.View>
          ) : (
            <FlatList
              scrollEnabled={visible}
              showsVerticalScrollIndicator={visible}
              keyExtractor={keyExtractor}
              style={styles.flex}
              data={walletServiceRows}
              renderItem={renderItem}
            />
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
