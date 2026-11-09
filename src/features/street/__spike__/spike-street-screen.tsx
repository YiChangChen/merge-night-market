// Spike A：夜市街最重場景的效能原型（純 RN + Reanimated）。結論出來後刪除，或改寫成 Story 1.7 的起點。
// 場景：5 攤 × 4 層（外觀、霓虹 3 段、鐵捲門、頭像），共 20 個頭像，霓虹與鐵捲門同時播放，外加煙火。
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHAIN_IDS, CHAINS, type ChainId, CUSTOMERS } from '@/game/content';

import { clearNavSamples, markNavEnd, navSamples } from './nav-timing';
import { median } from './stats';
import { MEASURE_MS, type RunResult, useFrameRecorder } from './use-frame-recorder';

const STALL_WIDTH = 220;
const STALL_HEIGHT = 340;
const AVATARS_PER_STALL = 4;
const FIREWORK_PARTICLES = 30;
const FIREWORK_INTERVAL_MS = 5000;

// 占位色：每攤一個主色，霓虹用高飽和色
const STALL_COLORS: Record<ChainId, { body: string; neon: string }> = {
  tea: { body: '#5B3A29', neon: '#00F5D4' },
  fried: { body: '#7A2E1F', neon: '#FFBE0B' },
  noodle: { body: '#3D405B', neon: '#FF006E' },
  dumpling: { body: '#2F4F4F', neon: '#8338EC' },
  sweet: { body: '#6D2E46', neon: '#FB5607' },
};

function NeonSegment({ color, delay }: { color: string; delay: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.35, { duration: 90 }),
            withTiming(1, { duration: 90 }),
            withTiming(1, { duration: 700 }),
            withTiming(0.6, { duration: 300 })
          ),
          -1,
          true
        )
      )
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.neonSegment, { backgroundColor: color }, style]} />;
}

function Shutter({ delay }: { delay: number }) {
  // 0 = 拉下，1 = 拉起；持續上下循環，模擬重開演出同時播放
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1, true)
      )
    );
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() * (STALL_HEIGHT * 0.55) }],
  }));
  return (
    <Animated.View style={[styles.shutter, style]}>
      {Array.from({ length: 8 }, (_, index) => (
        <View key={index} style={styles.shutterSlat} />
      ))}
    </Animated.View>
  );
}

function Avatar({ index }: { index: number }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(
      withDelay(
        index * 120,
        withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }), -1, true)
      )
    );
  }, [bob, index]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.get() * 6 }] }));
  const customer = CUSTOMERS[index % CUSTOMERS.length];
  return (
    <Animated.View style={[styles.avatar, style]}>
      <Image source={customer.art} style={styles.avatarImage} contentFit="contain" />
    </Animated.View>
  );
}

function StallPrototype({ chain, order }: { chain: ChainId; order: number }) {
  const colors = STALL_COLORS[chain];
  return (
    <View style={styles.stall}>
      {/* 第 1 層：外觀 */}
      <View style={[styles.stallBody, { backgroundColor: colors.body }]}>
        <Text style={styles.stallName}>{CHAINS[chain].generatorName}</Text>
        <Text style={styles.stallHint}>占位外觀</Text>
      </View>
      {/* 第 2 層：霓虹 3 段 */}
      <View style={styles.neon}>
        {[0, 1, 2].map((segment) => (
          <NeonSegment key={segment} color={colors.neon} delay={order * 150 + segment * 220} />
        ))}
      </View>
      {/* 第 3 層：鐵捲門 */}
      <Shutter delay={order * 300} />
      {/* 第 4 層：人龍頭像 */}
      <View style={styles.queue}>
        {Array.from({ length: AVATARS_PER_STALL }, (_, slot) => (
          <Avatar key={slot} index={order * AVATARS_PER_STALL + slot} />
        ))}
      </View>
    </View>
  );
}

const PARTICLE_COLORS = ['#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#FFFFFF'];

function Particle({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (index / FIREWORK_PARTICLES) * Math.PI * 2;
  const distance = 90 + (index % 5) * 18;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p + 40 * p * p },
        { scale: 1 - p * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: PARTICLE_COLORS[index % PARTICLE_COLORS.length] },
        style,
      ]}
    />
  );
}

function Fireworks({ progress }: { progress: SharedValue<number> }) {
  return (
    <View pointerEvents="none" style={styles.fireworks}>
      {Array.from({ length: FIREWORK_PARTICLES }, (_, index) => (
        <Particle key={index} index={index} progress={progress} />
      ))}
    </View>
  );
}

function formatMs(value: number | null) {
  return value === null ? '—' : `${Math.round(value)} ms`;
}

function PerfPanel({
  measuring,
  runs,
  onStart,
  onClear,
}: {
  measuring: boolean;
  runs: RunResult[];
  onStart: () => void;
  onClear: () => void;
}) {
  const uiFps = median(runs.map((run) => run.ui.avgFps));
  const uiJank = median(runs.map((run) => run.ui.jankPercent));
  const jsFps = median(runs.map((run) => run.js.avgFps));
  const nav = navSamples();
  return (
    <View style={styles.panel}>
      <View style={styles.panelRow}>
        <Pressable
          testID="spike-measure"
          disabled={measuring}
          onPress={onStart}
          style={[styles.panelButton, measuring && styles.panelButtonBusy]}>
          <Text style={styles.panelButtonText}>
            {measuring ? `量測中（${MEASURE_MS / 1000} 秒）…請左右捲動` : `開始量測（第 ${runs.length + 1} 次）`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onClear();
            clearNavSamples();
          }}
          style={styles.panelButtonSecondary}>
          <Text style={styles.panelButtonText}>清除</Text>
        </Pressable>
      </View>
      {runs.map((run, index) => (
        <Text key={index} style={styles.panelText}>
          #{index + 1} UI {run.ui.avgFps.toFixed(1)} FPS・卡頓 {run.ui.jankPercent.toFixed(1)}%・JS{' '}
          {run.js.avgFps.toFixed(1)} FPS
        </Text>
      ))}
      <Text style={styles.panelSummary}>
        中位數（{runs.length} 次）：UI {uiFps?.toFixed(1) ?? '—'} FPS・卡頓 {uiJank?.toFixed(1) ?? '—'}%・JS{' '}
        {jsFps?.toFixed(1) ?? '—'} FPS
      </Text>
      <Text style={styles.panelSummary}>
        進入時間（{nav.length} 次）：中位數 {formatMs(median(nav))}
      </Text>
    </View>
  );
}

export function SpikeStreetScreen() {
  const { start, measuring, runs, clearRuns } = useFrameRecorder();
  const fireworks = useSharedValue(0);
  const [, setNavCount] = useState(0);

  const launchFireworks = () => {
    fireworks.set(0);
    fireworks.set(withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }));
  };

  // 量測期間每 5 秒放一次煙火，讓最重的情況出現在數據裡
  useEffect(() => {
    if (!measuring) return;
    launchFireworks();
    const timer = setInterval(launchFireworks, FIREWORK_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只隨量測開關啟停
  }, [measuring]);

  return (
    <SafeAreaView
      style={styles.screen}
      onLayout={() => {
        markNavEnd();
        setNavCount(navSamples().length);
      }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← 回棋盤</Text>
        </Pressable>
        <Text style={styles.title}>Spike A：夜市街（純 RN）</Text>
        <Pressable onPress={launchFireworks} style={styles.back}>
          <Text style={styles.backText}>🎆</Text>
        </Pressable>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.street}>
        {CHAIN_IDS.map((chain, order) => (
          <StallPrototype key={chain} chain={chain} order={order} />
        ))}
      </ScrollView>
      <Fireworks progress={fireworks} />
      <PerfPanel measuring={measuring} runs={runs} onStart={start} onClear={clearRuns} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1638',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  title: {
    color: '#FFD966',
    fontSize: 16,
    fontWeight: '700',
  },
  street: {
    alignItems: 'flex-end',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  stall: {
    width: STALL_WIDTH,
    height: STALL_HEIGHT + 90,
    justifyContent: 'flex-end',
  },
  stallBody: {
    height: STALL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stallName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  stallHint: {
    color: '#FFFFFF99',
    fontSize: 12,
  },
  neon: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 6,
  },
  neonSegment: {
    flex: 1,
    height: 22,
    borderRadius: 11,
  },
  shutter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 90 + 12,
    height: STALL_HEIGHT * 0.55,
    gap: 4,
    padding: 4,
    backgroundColor: '#8D99AE',
    borderRadius: 6,
  },
  shutterSlat: {
    flex: 1,
    backgroundColor: '#6C757D',
    borderRadius: 2,
  },
  queue: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  avatar: {
    width: 48,
    height: 72,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  fireworks: {
    position: 'absolute',
    top: '30%',
    left: '50%',
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  panel: {
    gap: 4,
    padding: 12,
    backgroundColor: '#000000CC',
  },
  panelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panelButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FF7A45',
  },
  panelButtonBusy: {
    backgroundColor: '#555555',
  },
  panelButtonSecondary: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  panelButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  panelText: {
    color: '#DDDDDD',
    fontSize: 12,
  },
  panelSummary: {
    color: '#FFD966',
    fontSize: 13,
    fontWeight: '700',
  },
});
