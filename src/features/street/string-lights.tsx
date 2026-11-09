import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const BULB_COLOR = '#FFD166';

function Bulb({ index, phase }: { index: number; phase: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.65 + 0.35 * Math.sin((phase.get() + index * 0.35) * Math.PI * 2),
  }));
  return <Animated.View style={[styles.bulb, style]} />;
}

/** 橫跨整條街的暖黃燈泡串（UX-DR10）。失焦時停止閃爍。 */
export function StringLights({ count, animate }: { count: number; animate: boolean }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(phase);
      return;
    }
    phase.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [animate, phase]);

  return (
    <View style={styles.wire}>
      {Array.from({ length: count }, (_, index) => (
        <Bulb key={index} index={index} phase={phase} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wire: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3F5C',
  },
  bulb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BULB_COLOR,
    shadowColor: BULB_COLOR,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
