import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { adRemaining, canWatchAd, grantAdReward } from '@/game/daily';
import { useGameStore } from '@/game/store';
import { ads, useAdReady } from '@/services/ads';

/** 完售演出的長度；沒點跳過時自動結束 */
export const SELLOUT_SHOW_MS = 2800;
/** 有「看廣告獎勵加倍」按鈕時的長度：2.8 秒來不及決定要不要看（S6.3） */
export const SELLOUT_DECIDE_MS = 6000;
/** 看完廣告、獎勵加倍之後，再停這麼久讓玩家看到加倍的數字 */
export const SELLOUT_DOUBLED_MS = 1200;
/** 演出剛出現的這段時間不接受點擊：出單後緊接著的那一下點擊，不該直接關掉慶祝 */
const SHOW_TAP_GUARD_MS = 400;

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
  // 演出開始時記下這一波的獎勵：演出途中冷卻到期（例如除錯快轉）會清除 lastSellout，
  // 不能讓獎勵列突然消失（code review 2026-11-10）
  const [reward] = useState(() => {
    const sellout = useGameStore.getState().state?.lastSellout;
    return sellout && sellout.wave === wave ? sellout : null;
  });

  // 讀螢幕軟體：標籤要包含獎勵（會蓋掉子元素的文字），出現時主動唸出來，因為演出會自動結束
  const label = reward
    ? `完售！第 ${wave} 波，獲得金幣 ${reward.coins}、體力 ${reward.energy}、經驗 ${reward.xp}。點一下繼續`
    : `完售！第 ${wave} 波。點一下繼續`;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(label);
    // 只在演出開始時唸一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 剛出現時忽略點擊（code review 2026-11-11）：計時器過了才接受跳過
  const tappable = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      tappable.current = true;
    }, SHOW_TAP_GUARD_MS);
    return () => clearTimeout(timer);
  }, []);
  // 看廣告獎勵加倍（S6.3、FR38、NP-4）：這一波的紀錄還在、還沒加倍、今天還有次數，而且有廣告
  const canDouble = useGameStore((store) =>
    store.state
      ? store.state.lastSellout?.wave === wave && canWatchAd(store.state, 'sellout-double')
      : false
  );
  const remaining = useGameStore((store) =>
    store.state ? adRemaining(store.state, 'sellout-double') : 0
  );
  const apply = useGameStore((store) => store.apply);
  const ready = useAdReady('sellout-double');
  const [playing, setPlaying] = useState(false);
  // 「已加倍」以遊戲狀態為準：真的發出去才顯示加倍（E6 code review）
  const doubled = useGameStore(
    (store) => store.state?.lastSellout?.wave === wave && store.state.lastSellout.doubled
  );
  const showDouble = canDouble && ready && !doubled;

  const onPress = () => {
    // 播放廣告時不能跳過：結果出來之前演出要留著
    if (tappable.current && !playing) onDone();
  };

  // 自動結束：播放中不計時；看完加倍後停一下讓玩家看到數字；有加倍按鈕時給比較久的時間決定
  const duration = doubled ? SELLOUT_DOUBLED_MS : showDouble ? SELLOUT_DECIDE_MS : SELLOUT_SHOW_MS;
  useEffect(() => {
    if (playing) return;
    // 用 JS 計時收尾，不必從 worklet 回呼（演出本身在 UI 執行緒播放）
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone, playing]);

  const watchDouble = async () => {
    if (playing) return;
    setPlaying(true);
    // 廣告 SDK 出錯（reject）時當成沒有廣告，演出不能卡在「播放中」（E6 code review）
    const result = await ads.show('sellout-double').catch(() => 'unavailable' as const);
    if (result === 'earned') {
      // 獎勵唯一入口；就算演出已經被關掉也照樣發，看了廣告一定拿得到（NP-4）
      apply((state, now) => grantAdReward(state, 'sellout-double', now));
    }
    setPlaying(false);
  };
  const shown =
    reward && doubled
      ? { ...reward, coins: reward.coins * 2, energy: reward.energy * 2, xp: reward.xp * 2 }
      : reward;

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
      accessibilityLabel={label}
      // 焦點不要跑到底下的棋盤（iOS）
      accessibilityViewIsModal
      onPress={onPress}
      style={styles.backdrop}>
      <Fireworks />
      {/* 面板本身不擋點擊（點面板外的背景跳過）；只有加倍按鈕可以點 */}
      <View style={styles.panel} pointerEvents="box-none">
        <Animated.Text style={[styles.title, titleStyle]}>完售！</Animated.Text>
        <Text style={styles.wave}>第 {wave} 波客人全部招呼完了</Text>
        {shown ? (
          <View testID="sellout-reward" style={styles.rewards}>
            <Text style={styles.reward}>🪙 +{shown.coins}</Text>
            <Text style={styles.reward}>⚡ +{shown.energy}</Text>
            <Text style={styles.reward}>⭐ +{shown.xp}</Text>
          </View>
        ) : null}
        {/* 「看廣告獎勵加倍」按鈕（UX-DR4、S6.3）；沒有廣告或不能加倍時只留位置 */}
        <View testID="sellout-double-slot" style={styles.doubleSlot}>
          {doubled ? (
            <Text style={styles.doubledText}>獎勵加倍！</Text>
          ) : showDouble || playing ? (
            <>
              <Pressable
                testID="watch-ad-double"
                accessibilityRole="button"
                disabled={playing}
                // 不把 Promise 回傳給 onPress：播放在背景進行，畫面靠 playing 狀態更新
                onPress={() => void watchDouble()}
                style={({ pressed }) => [styles.double, (pressed || playing) && styles.pressed]}>
                <Text style={styles.doubleText}>
                  {playing ? '廣告播放中…' : '📺 看廣告 獎勵加倍'}
                </Text>
              </Pressable>
              <Text testID="double-remaining" style={styles.remaining}>
                今天還剩 {remaining} 次
              </Text>
            </>
          ) : null}
        </View>
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
    // 約 45% 不透明：夜市街上完售時，底下全街招牌一起閃要看得到（獎勵面板本身不透明）
    backgroundColor: '#0B163873',
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
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  double: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD966',
  },
  pressed: {
    opacity: 0.7,
  },
  doubleText: {
    color: '#3A2A1A',
    fontSize: 16,
    fontWeight: '800',
  },
  remaining: {
    color: '#C9D1E8',
    fontSize: 12,
  },
  doubledText: {
    color: '#FFD966',
    fontSize: 20,
    fontWeight: '900',
  },
  hint: {
    color: '#9FB3D1',
    fontSize: 12,
  },
});
