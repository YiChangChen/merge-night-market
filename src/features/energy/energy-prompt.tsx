import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { BALANCE } from '@/game/content';
import { adRemaining, canWatchAd, grantAdReward } from '@/game/daily';
import { msUntilNextEnergy } from '@/game/engine';
import { useGameStore } from '@/game/store';
import { ads, useAdReady } from '@/services/ads';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

type Props = {
  onClose: () => void;
  /** 看完廣告、拿到體力之後（棋盤畫面顯示「+20 體力」） */
  onRewarded?: () => void;
};

/**
 * 體力不足的提示卡（S6.2、FR37、FR39、NP-4）：下一點體力的倒數，以及「看廣告 +20 體力」。
 * 按鈕只在 canWatchAd && ads.isReady 時出現；只有看完（earned）才經由 grantAdReward 發獎勵。
 * 離開方式：✕、點背景、拿到獎勵、體力自然回來；播放中不能關閉。
 */
export function EnergyPrompt({ onClose, onRewarded }: Props) {
  const energy = useGameStore((store) => store.state?.energy ?? 0);
  const canWatch = useGameStore((store) =>
    store.state ? canWatchAd(store.state, 'energy') : false
  );
  const remaining = useGameStore((store) => (store.state ? adRemaining(store.state, 'energy') : 0));
  const timing = useGameStore(
    useShallow((store) =>
      store.state
        ? {
            energy: store.state.energy,
            energyUpdatedAt: store.state.energyUpdatedAt,
            firstLaunchAt: store.state.meta.firstLaunchAt,
            offset: store.timeOffsetMs,
          }
        : null
    )
  );
  const apply = useGameStore((store) => store.apply);
  const ready = useAdReady('energy');
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 體力自然回來了：提示沒有意義，自動關閉（播放中等結果）
  useEffect(() => {
    if (!playing && energy >= BALANCE.spawnEnergyCost) onClose();
  }, [energy, onClose, playing]);

  const untilNext = timing
    ? msUntilNextEnergy(
        { ...timing, meta: { firstLaunchAt: timing.firstLaunchAt } },
        now + timing.offset
      )
    : null;

  const watch = async () => {
    if (playing) return;
    setPlaying(true);
    const result = await ads.show('energy');
    if (result === 'earned') {
      // 獎勵唯一入口；重複呼叫是安全的（NP-4）
      apply((state, at) => grantAdReward(state, 'energy', at));
      onRewarded?.();
      onClose();
      return;
    }
    // 跳過或沒有廣告：什麼都不給，可以再試（沒有廣告時按鈕會因為 isReady 變成 false 而隱藏）
    setPlaying(false);
  };

  const close = () => {
    if (!playing) onClose();
  };

  return (
    <View style={styles.layer}>
      <Pressable
        testID="energy-prompt-backdrop"
        accessibilityLabel="關閉"
        onPress={close}
        style={styles.backdrop}
      />
      <View testID="energy-prompt" style={styles.card} accessibilityViewIsModal>
        <View style={styles.header}>
          <Text style={styles.title}>體力不足</Text>
          <Pressable
            testID="close-energy-prompt"
            accessibilityRole="button"
            accessibilityLabel="關閉"
            hitSlop={8}
            onPress={close}
            style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Text testID="energy-countdown" style={styles.countdown}>
          {untilNext !== null ? `下一點體力 ${formatCountdown(untilNext)}` : '體力回復中'}
        </Text>
        {canWatch && ready ? (
          <Pressable
            testID="watch-ad-energy"
            accessibilityRole="button"
            disabled={playing}
            // 不把 Promise 回傳給 onPress：播放在背景進行，畫面靠 playing 狀態更新
            onPress={() => void watch()}
            style={({ pressed }) => [styles.watch, (pressed || playing) && styles.pressed]}>
            <Text style={styles.watchText} numberOfLines={1}>
              {playing ? '廣告播放中…' : `📺 看廣告 +${BALANCE.adEnergy} 體力`}
            </Text>
          </Pressable>
        ) : null}
        {canWatch && ready ? (
          <Text testID="ad-remaining" style={styles.note}>
            今天還剩 {remaining} 次
          </Text>
        ) : remaining <= 0 ? (
          <Text style={styles.note}>今天的廣告次數用完了</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#00000099',
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFD966',
    backgroundColor: '#11173AF2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFD966',
    fontSize: 20,
    fontWeight: '900',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F2F4FA',
    fontSize: 20,
  },
  countdown: {
    color: '#F2F4FA',
    fontSize: 16,
    fontWeight: '700',
  },
  watch: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD966',
  },
  pressed: {
    opacity: 0.7,
  },
  watchText: {
    color: '#3A2A1A',
    fontSize: 16,
    fontWeight: '800',
  },
  note: {
    color: '#9FB3D1',
    fontSize: 14,
  },
});
