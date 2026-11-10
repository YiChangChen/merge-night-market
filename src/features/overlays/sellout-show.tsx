import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useGameStore } from '@/game/store';

/** 完售演出的長度；沒點跳過時自動結束 */
export const SELLOUT_SHOW_MS = 2800;

// 煙火：固定位置與顏色的 3 組爆炸，依序施放（S1.3 原型約 30 顆粒子）
const BURSTS = [
  { x: 0.25, y: 0.22, color: '#FFD966', delay: 0 },
  { x: 0.75, y: 0.18, color: '#FF6B9D', delay: 350 },
  { x: 0.5, y: 0.34, color: '#6BE4FF', delay: 700 },
] as const;
const PARTICLES_PER_BURST = 10;
const BURST_RADIUS = 70;
const BURST_MS = 900;
const PARTICLE_SIZE = 7;

function Particle({ angle, color, delay }: { angle: number; color: string; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(delay, withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) }))
    );
  }, [delay, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * BURST_RADIUS * p },
        // 粒子往外飛的同時稍微下墜
        { translateY: Math.sin(angle) * BURST_RADIUS * p + 18 * p * p },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

function Fireworks() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BURSTS.map((burst, burstIndex) => (
        <View
          key={burstIndex}
          style={[styles.burst, { left: `${burst.x * 100}%`, top: `${burst.y * 100}%` }]}>
          {Array.from({ length: PARTICLES_PER_BURST }, (_, i) => (
            <Particle
              key={i}
              angle={(i / PARTICLES_PER_BURST) * Math.PI * 2}
              color={burst.color}
              delay={burst.delay}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type SelloutShowProps = {
  wave: number;
  onDone: () => void;
};

/**
 * 「完售！」演出（S2.4、FR19、UX-DR4）：煙火、標題、本波獎勵。點任何地方跳過，時間到自動結束。
 * 只讀遊戲狀態，不寫入；獎勵數字來自規則層寫入的 lastSellout。
 */
export function SelloutShow({ wave, onDone }: SelloutShowProps) {
  // 只顯示這一波的獎勵；冷卻已經結束（例如除錯快轉）時 lastSellout 會是 null
  const reward = useGameStore((store) => {
    const sellout = store.state?.lastSellout;
    return sellout && sellout.wave === wave ? sellout : null;
  });

  useEffect(() => {
    // 用 JS 計時收尾，不必從 worklet 回呼（演出本身在 UI 執行緒播放）
    const timer = setTimeout(onDone, SELLOUT_SHOW_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  const pop = useSharedValue(0);
  useEffect(() => {
    pop.set(withSequence(withSpring(1.15, { damping: 8 }), withTiming(1, { duration: 150 })));
  }, [pop]);
  const titleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get()),
    transform: [{ scale: pop.get() }],
  }));

  return (
    <Pressable
      testID="sellout-show"
      accessibilityRole="button"
      accessibilityLabel="完售！點一下繼續"
      onPress={onDone}
      style={styles.backdrop}>
      <Fireworks />
      <View style={styles.panel} pointerEvents="none">
        <Animated.Text style={[styles.title, titleStyle]}>完售！</Animated.Text>
        <Text style={styles.wave}>第 {wave} 波客人全部招呼完了</Text>
        {reward ? (
          <View testID="sellout-reward" style={styles.rewards}>
            <Text style={styles.reward}>🪙 +{reward.coins}</Text>
            <Text style={styles.reward}>⚡ +{reward.energy}</Text>
            <Text style={styles.reward}>⭐ +{reward.xp}</Text>
          </View>
        ) : null}
        {/* 「看廣告獎勵加倍」按鈕的位置（UX-DR4）；S6.3 接上 canWatchAd 之前一律不顯示 */}
        <View testID="sellout-double-slot" style={styles.doubleSlot} />
        <Text style={styles.hint}>點一下繼續</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1638CC',
  },
  burst: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  particle: {
    position: 'absolute',
    left: -PARTICLE_SIZE / 2,
    top: -PARTICLE_SIZE / 2,
    width: PARTICLE_SIZE,
    height: PARTICLE_SIZE,
    borderRadius: PARTICLE_SIZE / 2,
  },
  panel: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: '#11173AF2',
    borderWidth: 2,
    borderColor: '#FFD966',
  },
  title: {
    color: '#FFD966',
    fontSize: 44,
    fontWeight: '900',
    textShadowColor: '#FF6B3D',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  wave: {
    color: '#C9D1E8',
    fontSize: 14,
  },
  rewards: {
    flexDirection: 'row',
    gap: 16,
  },
  reward: {
    color: '#FFF3D6',
    fontSize: 20,
    fontWeight: '800',
  },
  doubleSlot: {
    height: 44,
  },
  hint: {
    color: '#9FB3D1',
    fontSize: 12,
  },
});
