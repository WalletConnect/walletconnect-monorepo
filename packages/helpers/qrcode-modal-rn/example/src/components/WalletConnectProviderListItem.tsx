import * as React from 'react';
import { Image, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import tinycolor2 from 'tinycolor2';

import type { WalletConnectProvider } from '../types';

export type WalletConnectProviderListItemProps = WalletConnectProvider & {
  readonly height: number;
  readonly onPress: () => unknown;
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fullWidth: {
    width: '100%',
  },
  icon: {
    paddingLeft: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  title: {
    marginRight: 10,
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default function WalletConnectProviderListItemProps({
  height,
  name,
  logo,
  color: maybeColor,
  onPress,
}: WalletConnectProviderListItemProps): JSX.Element {
  const color = React.useMemo((): string => {
    const c = tinycolor2(maybeColor);
    c.setAlpha(0.05);
    return c.toString();
  }, [maybeColor]);
  return (
    <TouchableHighlight underlayColor={color} style={styles.fullWidth} onPress={onPress}>
      <View
        style={[
          styles.fullWidth,
          styles.row,
          {
            height,
            paddingHorizontal: height * 0.5,
          },
        ]}>
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.title, { width: '80%' }]}>
          {name}
        </Text>
        <View style={styles.flex} />
        <Image
          style={[
            {
              borderRadius: height * 0.2,
              width: height * 0.75,
              height: height * 0.75,
            },
            styles.icon,
          ]}
          source={{ uri: logo }}
        />
      </View>
    </TouchableHighlight>
  );
}