import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** 升級慶祝的長度（和招牌通電一起結束，見 neon-sign NEON_POWER_ON_MS） */
export const UPGRADE_BURST_MS = 2000;

const SPARKLES = 8;
const SPARKLE_DISTANCE = 90;

type Props = {
  /** 升級後的等級與外觀名稱，例如 2、「Lv2 店面」 */
  label: string;
  color: string;
};

/**
 * 攤位升級的慶祝（實機回饋：原本只有 0.3 秒的換圖，感受不到升級）：
 * 外觀上閃一下白光、星星往外散開、「升級！」字樣彈出後往上飄走。不擋觸控，只讀不寫。
 */
export function UpgradeBurst({ label, color }: Props) {
  const flash = useSharedValue(0);
  const spread = useSharedValue(0);
  const title = useSharedValue(0);
  const leave = useSharedValue(0);
  useEffect(() => {
    flash.set(withSequence(withTiming(0.75, { duration: 120 }), withTiming(0, { duration: 500 })));
    spread.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    title.set(withDelay(150, withSpring(1, { damping: 7, stiffness: 160 })));
    leave.set(withDelay(UPGRADE_BURST_MS - 500, withTiming(1, { duration: 450 })));
  }, [flash, leave, spread, title]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, title.get()) * (1 - leave.get()),
    transform: [{ scale: 0.4 + 0.6 * title.get() }, { translateY: -30 * leave.get() }],
  }));

  return (
    <View testID="upgrade-burst" pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.flash, flashStyle]} />
      {Array.from({ length: SPARKLES }, (_, index) => (
        <Sparkle key={index} angle={(index * 2 * Math.PI) / SPARKLES} spread={spread} />
      ))}
      <Animated.View style={[styles.title, titleStyle]}>
        <Text style={[styles.titleText, { textShadowColor: color }]}>升級！</Text>
        <Text style={[styles.label, { borderColor: color }]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

function Sparkle({ angle, spread }: { angle: number; spread: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const progress = spread.get();
    return {
      opacity: progress < 0.15 ? progress / 0.15 : 1 - progress,
      transform: [
        { translateX: Math.cos(angle) * SPARKLE_DISTANCE * progress },
        { translateY: Math.sin(angle) * SPARKLE_DISTANCE * progress },
        { scale: 0.6 + 0.6 * progress },
      ],
    };
  });
  return <Animated.Text style={[styles.sparkle, style]}>✨</Animated.Text>;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: '#FFF6D0',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 22,
  },
  title: {
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    color: '#FFD966',
    fontSize: 34,
    fontWeight: '900',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  label: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    color: '#FFF3D6',
    backgroundColor: '#11173AE6',
    fontSize: 15,
    fontWeight: '800',
  },
});
