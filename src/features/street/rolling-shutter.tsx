import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export const SHUTTER_ROLL_MS = 1100;

type RollingShutterProps = {
  /** 這一攤的鐵捲門外觀圖 */
  source: number;
  height: number;
  onDone: () => void;
};

/**
 * 重開時的鐵捲門拉起演出（FR10）：鐵捲門圖蓋在新開的攤位上，往上收起後淡出，結束時呼叫 onDone。
 */
export function RollingShutter({ source, height, onDone }: RollingShutterProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(150, withTiming(1, { duration: SHUTTER_ROLL_MS - 150, easing: Easing.inOut(Easing.cubic) }))
    );
    // 用 JS 計時收尾，不必從 worklet 回呼（演出本身仍在 UI 執行緒播放）
    const timer = setTimeout(onDone, SHUTTER_ROLL_MS);
    return () => clearTimeout(timer);
  }, [onDone, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() * height }],
    opacity: 1 - Math.max(0, progress.get() - 0.6) / 0.4,
  }));

  return (
    <Animated.View testID="rolling-shutter" pointerEvents="none" style={[styles.shutter, { height }, style]}>
      <Image source={source} contentFit="contain" contentPosition="bottom" style={styles.image} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shutter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    flex: 1,
  },
});
