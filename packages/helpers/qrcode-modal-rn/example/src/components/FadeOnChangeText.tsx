import * as React from 'react';
import { Animated, Platform, StyleSheet, TextProps } from 'react-native';

export type FadeOnChangeTextProps = TextProps & {
  readonly children: string;
  readonly duration: number;
};

const useNativeDriver = Platform.OS !== 'web';

export default function FadeOnChangeText({
  children: maybeChildren,
  style,
  duration: twiceDuration,
  ...extras
}: FadeOnChangeTextProps): JSX.Element {
  const [children, setChildren] = React.useState(() => maybeChildren);
  const duration = twiceDuration * 0.5;
  const opacity = React.useMemo<Animated.Value>(() => new Animated.Value(0), []);
  React.useEffect(() => {
    (async () => {
      await new Promise(
        resolve => Animated.timing(opacity, { duration, useNativeDriver, toValue: 0 })
          .start(resolve),
      );
      requestAnimationFrame(() => setChildren(() => maybeChildren));
    })();
  }, [duration, maybeChildren, opacity, setChildren]);
  React.useEffect(() => {
    Animated.timing(opacity, { duration, useNativeDriver, toValue: 1 }).start();
  }, [opacity, children, duration]);
  return (
    <Animated.Text
      style={[{ opacity }, StyleSheet.flatten(style)]}
      {...extras}
      children={children}
    />
  );
}