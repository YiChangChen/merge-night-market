import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SEGMENTS = 3;

type NeonSegmentProps = {
  color: string;
  lit: boolean;
  animate: boolean;
  delay: number;
};

function NeonSegment({ color, lit, animate, delay }: NeonSegmentProps) {
  const opacity = useSharedValue(lit ? 1 : 0.15);

  useEffect(() => {
    cancelAnimation(opacity);
    if (!lit) {
      opacity.set(0.15);
      return;
    }
    if (!animate) {
      // 夜市街失焦時停在全亮，不在背景耗電
      opacity.set(1);
      return;
    }
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.45, { duration: 90 }),
            withTiming(1, { duration: 90 }),
            withTiming(1, { duration: 1400 }),
            withTiming(0.8, { duration: 500 })
          ),
          -1,
          true
        )
      )
    );
    return () => cancelAnimation(opacity);
  }, [animate, delay, lit, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      testID={lit ? 'neon-segment-lit' : 'neon-segment-off'}
      style={[styles.segment, { backgroundColor: color, shadowColor: color }, lit && styles.glow, style]}
    />
  );
}

type NeonSignProps = {
  name: string;
  color: string;
  /** 攤位等級 0–3：亮起的段數（Lv1 1/3、Lv2 2/3、Lv3 全亮，FR14） */
  level: number;
  animate: boolean;
};

// TODO(content): art-manifest#22-26 正式霓虹招牌圖到位後，改成三段圖層疊加
export function NeonSign({ name, color, level, animate }: NeonSignProps) {
  return (
    <View style={styles.sign}>
      <Text style={[styles.name, level > 0 && { color, textShadowColor: color }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <NeonSegment
            key={index}
            color={color}
            lit={index < level}
            animate={animate}
            delay={index * 220}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0B0F24',
  },
  name: {
    color: '#5A6075',
    fontSize: 18,
    fontWeight: '800',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    width: 52,
    height: 10,
    borderRadius: 5,
  },
  glow: {
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
