import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export const SHUTTER_ROLL_MS = 1100;

/**
 * 重開時的鐵捲門拉起演出（FR10）：蓋在新開的攤位上，往上收起後淡出，結束時呼叫 onDone。
 * TODO(content): art-manifest#2,6,10,14,18 鐵捲門圖到位後換成圖片
 */
export function RollingShutter({ height, onDone }: { height: number; onDone: () => void }) {
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
    opacity: 1 - Math.max(0, progress.get() - 0.7) / 0.3,
  }));

  return (
    <Animated.View testID="rolling-shutter" pointerEvents="none" style={[styles.shutter, style]}>
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} style={styles.slat} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shutter: {
    ...StyleSheet.absoluteFill,
    gap: 4,
    padding: 6,
    backgroundColor: '#7D8597',
  },
  slat: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#5C677D',
  },
});
