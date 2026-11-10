import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInRight,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CUSTOMERS } from '@/game/content';
import { isQueueFinalStretch, queueServed } from '@/game/queue';
import { useGameStore } from '@/game/store';

/** 計量條高度；棋盤畫面的版面計算要預留這個高度（見 (tabs)/index.tsx） */
export const QUEUE_METER_HEIGHT = 28;

// 排隊頭像最多畫幾個，其餘顯示「+k」
const MAX_AVATARS = 5;
const AVATAR_SIZE = 22;
const LEAVE_MS = 260;
const SHIFT_MS = 220;
// 人龍進行中時背景緩慢脈動；最後 3 人時加快並變亮（UX-DR2「閃爍並加快脈動節奏」）
const NORMAL_PULSE_MS = 1400;
const NORMAL_PULSE_OPACITY = 0.25;
const FINAL_PULSE_MS = 280;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 本波第 index 位客人的頭像：同一位客人在出單前後不會換臉 */
function customerAt(wave: number, index: number) {
  return CUSTOMERS[(wave * 5 + index) % CUSTOMERS.length];
}

/** 冷卻倒數：只有冷卻中才掛上每秒計時器，時間加上除錯面板的快轉偏移量（與 HUD 相同）。 */
function Cooldown({ endsAt }: { endsAt: number }) {
  const timeOffsetMs = useGameStore((store) => store.timeOffsetMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text testID="queue-meter-cooldown" style={styles.label}>
      完售！下一波 {formatCountdown(endsAt - (now + timeOffsetMs))}
    </Text>
  );
}

/**
 * 棋盤頂端的客流計量條（S2.2、UX-DR2、FR42）。只訂閱 queue 切片：拖曳、合成都不會讓它重繪。
 * 動畫（離隊、數字跳動、最後 3 人閃爍）都是 Reanimated，在 UI 執行緒執行。
 */
export const QueueMeter = memo(function QueueMeter() {
  const queue = useGameStore((store) => store.state?.queue);
  const served = queue ? queueServed(queue) : 0;
  const finalStretch = queue ? isQueueFinalStretch(queue) : false;

  // 數字跳動：每出一單彈一下
  const bump = useSharedValue(1);
  useEffect(() => {
    if (served === 0) return;
    bump.set(withSequence(withTiming(1.3, { duration: 120 }), withTiming(1, { duration: 160 })));
  }, [bump, served]);
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  // 背景脈動：一般時緩慢、最後 3 人時快速閃爍；冷卻中停止
  const cooling = queue?.cooldownEndsAt != null;
  const glow = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(glow);
    if (cooling) {
      glow.set(0);
      return;
    }
    glow.set(
      finalStretch
        ? withRepeat(withTiming(1, { duration: FINAL_PULSE_MS }), -1, true)
        : withRepeat(withTiming(NORMAL_PULSE_OPACITY, { duration: NORMAL_PULSE_MS }), -1, true)
    );
    return () => cancelAnimation(glow);
  }, [cooling, finalStretch, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  if (!queue) return null;

  if (queue.cooldownEndsAt !== null) {
    return (
      <View testID="queue-meter" style={styles.meter}>
        <Cooldown endsAt={queue.cooldownEndsAt} />
      </View>
    );
  }

  const progress = queue.length > 0 ? served / queue.length : 0;
  const visible = Math.min(queue.remaining, MAX_AVATARS);
  const overflow = queue.remaining - visible;

  return (
    <View
      testID="queue-meter"
      accessibilityLabel={`今晚客流 ${served}/${queue.length}${finalStretch ? `，剩最後 ${queue.remaining} 位` : ''}`}
      style={styles.meter}>
      <Animated.View
        testID={finalStretch ? 'queue-meter-final-stretch' : undefined}
        pointerEvents="none"
        style={[styles.glow, glowStyle]}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>今晚客流 </Text>
        <Animated.Text testID="queue-meter-count" style={[styles.label, styles.count, countStyle]}>
          {served}/{queue.length}
        </Animated.Text>
      </View>
      <View style={styles.avatars}>
        {Array.from({ length: visible }, (_, offset) => {
          const index = served + offset;
          return (
            <Animated.View
              key={`${queue.wave}-${index}`}
              entering={FadeInRight.duration(SHIFT_MS)}
              exiting={FadeOutLeft.duration(LEAVE_MS)}
              layout={LinearTransition.duration(SHIFT_MS)}>
              <Image
                source={customerAt(queue.wave, index).art}
                contentFit="cover"
                contentPosition="top"
                cachePolicy="memory-disk"
                style={styles.avatar}
              />
            </Animated.View>
          );
        })}
        {overflow > 0 ? <Text style={styles.overflow}>+{overflow}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  meter: {
    height: QUEUE_METER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: QUEUE_METER_HEIGHT / 2,
    overflow: 'hidden',
    backgroundColor: '#000000AA',
  },
  glow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FF6B3D88',
  },
  progressTrack: {
    ...StyleSheet.absoluteFill,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F2C57233',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#FFF3D6',
    fontSize: 13,
    fontWeight: '700',
  },
  count: {
    color: '#FFD966',
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#1E2550',
  },
  overflow: {
    color: '#C9D1E8',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
});
