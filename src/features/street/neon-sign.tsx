import { Image } from 'expo-image';
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

/** 招牌通電演出的長度；結束後回到一般的閃爍 */
export const NEON_POWER_ON_MS = 900;

// 沒亮的霓虹管仍然隱約看得到，像關掉的燈管
const OFF_OPACITY = 0.12;

type NeonSegmentProps = {
  source: number;
  lit: boolean;
  animate: boolean;
  delay: number;
  /** 正在通電（升級剛完成的那一段）：先閃幾下再亮起 */
  poweringOn: boolean;
};

/** 霓虹招牌的一段：三段圖層用同一張畫布，疊在一起就是完整的招牌。 */
function NeonSegment({ source, lit, animate, delay, poweringOn }: NeonSegmentProps) {
  const opacity = useSharedValue(lit ? 1 : OFF_OPACITY);

  useEffect(() => {
    cancelAnimation(opacity);
    if (!lit) {
      opacity.set(OFF_OPACITY);
      return;
    }
    if (poweringOn) {
      // 通電：接觸不良似地閃幾下，最後穩定亮起（FR14）
      opacity.set(0.05);
      opacity.set(
        withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0.15, { duration: 120 }),
          withTiming(1, { duration: 80 }),
          withTiming(0.35, { duration: 160 }),
          withTiming(1, { duration: 200 })
        )
      );
      return () => cancelAnimation(opacity);
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
  }, [animate, delay, lit, opacity, poweringOn]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      testID={poweringOn ? 'neon-segment-powering-on' : lit ? 'neon-segment-lit' : 'neon-segment-off'}
      style={[styles.layer, style]}>
      <Image source={source} contentFit="contain" cachePolicy="memory-disk" style={styles.layerImage} />
    </Animated.View>
  );
}

type NeonSignProps = {
  name: string;
  /** 攤位名稱亮起時的顏色 */
  color: string;
  /** 三段霓虹圖層（art-manifest#22–26） */
  layers: readonly [number, number, number];
  /** 攤位等級 0–3：亮起的段數（Lv1 1/3、Lv2 2/3、Lv3 全亮，FR14） */
  level: number;
  animate: boolean;
  /** 招牌通電演出的序號（FxController 收到 stall_upgraded 時觸發）；undefined 代表沒有演出 */
  powerOn?: number;
  onPowerOnDone?: () => void;
};

export function NeonSign({ name, color, layers, level, animate, powerOn, onPowerOnDone }: NeonSignProps) {
  // 用 JS 計時收尾，不必從 worklet 回呼
  useEffect(() => {
    if (powerOn === undefined || !onPowerOnDone) return;
    const timer = setTimeout(onPowerOnDone, NEON_POWER_ON_MS);
    return () => clearTimeout(timer);
  }, [powerOn, onPowerOnDone]);

  return (
    <View style={styles.sign}>
      <Text style={[styles.name, level > 0 && { color, textShadowColor: color }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.segments}>
        {layers.map((source, index) => (
          <NeonSegment
            key={index}
            source={source}
            lit={index < level}
            animate={animate}
            delay={index * 220}
            // 剛升級時，最新亮起的那一段播放通電
            poweringOn={powerOn !== undefined && index === level - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: {
    alignItems: 'center',
    gap: 2,
  },
  name: {
    color: '#5A6075',
    fontSize: 18,
    fontWeight: '800',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  segments: {
    width: 210,
    height: 70,
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  layerImage: {
    flex: 1,
  },
});
