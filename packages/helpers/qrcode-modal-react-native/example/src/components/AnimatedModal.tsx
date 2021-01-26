import * as React from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';

export type AnimatedModalProps = {
  readonly children: JSX.Element | readonly JSX.Element[];
  readonly duration: number;
  readonly visible?: boolean;
};

const styles = StyleSheet.create({
  absolute: { position: 'absolute' },
});

export default function AnimatedModal({
  children,
  duration,
  visible,
}: AnimatedModalProps): JSX.Element {
  const { width, height } = useWindowDimensions();
  const progress = React.useMemo(() => new Animated.Value(0), []);

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [duration, visible]);

  return (
    <Animated.View style={[styles.absolute, { width, height }]} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: 'red' }]} />
      </TouchableOpacity>
      <Animated.View style={StyleSheet.absoluteFill}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
