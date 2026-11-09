import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { type ChainId, STALLS } from '@/game/content';
import { reopenCheck, reopenStall } from '@/game/stalls';
import { useGameStore } from '@/game/store';

import { useOverlayStore } from './overlay-store';

const LEVEL_NAMES = ['鐵捲門', 'Lv1 小攤', 'Lv2 店面', 'Lv3 大店'] as const;

function Condition({ label, current, met }: { label: string; current: string; met: boolean }) {
  return (
    <View style={styles.condition}>
      <Text style={[styles.mark, met ? styles.met : styles.unmet]}>{met ? '✓' : '✗'}</Text>
      <Text style={styles.conditionLabel}>{label}</Text>
      <Text testID={met ? undefined : 'condition-unmet'} style={[styles.current, !met && styles.unmet]}>
        {current}
      </Text>
    </View>
  );
}

/**
 * 攤位面板（UX-DR3）：點夜市街的攤位開啟。
 * 鐵捲門攤位顯示重開條件，未達成的條件標成紅色；條件都滿足才能按「重開」（FR10）。
 * 升級（S1.10）之後加在這個面板。
 */
export function StallPanel({ chain }: { chain: ChainId }) {
  const stall = STALLS[chain];
  const close = useOverlayStore((store) => store.closeStallPanel);
  const apply = useGameStore((store) => store.apply);
  // 只訂閱穩定的值（數字與 stalls 物件本身），重開條件在 render 時算出來；
  // 不要在 selector 裡回傳 reopenCheck 的新物件，否則每次快照都不同
  const snapshot = useGameStore(
    useShallow((store) =>
      store.state
        ? { level: store.state.level, coins: store.state.coins, stalls: store.state.stalls }
        : null
    )
  );
  if (!snapshot) return null;
  const level = snapshot.stalls[chain].level;
  const check = reopenCheck(snapshot, chain);
  const { level: playerLevel, coins } = snapshot;

  const onReopen = () => {
    apply((state) => reopenStall(state, chain, Date.now()));
    close();
  };

  return (
    <View testID="stall-panel" style={styles.panel}>
      <Text style={styles.title}>{stall.name}</Text>
      <Text style={styles.owner}>
        老闆 {stall.owner.name}・{LEVEL_NAMES[level]}
      </Text>

      {check ? (
        <>
          <Text style={styles.section}>重開條件</Text>
          <Condition label={`玩家等級 Lv${check.playerLevel}`} current={`目前 Lv${playerLevel}`} met={check.levelMet} />
          <Condition label={`金幣 ${check.coins}`} current={`目前 ${coins}`} met={check.coinsMet} />
          <Pressable
            testID="reopen-stall"
            accessibilityRole="button"
            disabled={!check.ok}
            onPress={onReopen}
            style={({ pressed }) => [styles.primary, !check.ok && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{check.ok ? `重開（🪙${check.coins}）` : '條件不足'}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.info}>營業中。升級功能即將開放。</Text>
      )}

      <Pressable
        testID="close-stall-panel"
        accessibilityRole="button"
        onPress={close}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>關閉</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#13193D',
    borderWidth: 1,
    borderColor: '#2E3A7A',
  },
  title: {
    color: '#FFD966',
    fontSize: 22,
    fontWeight: '800',
  },
  owner: {
    color: '#C9D1E8',
    fontSize: 14,
  },
  section: {
    marginTop: 6,
    color: '#9FB3D1',
    fontSize: 13,
    fontWeight: '700',
  },
  condition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 20,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  met: {
    color: '#06D6A0',
  },
  unmet: {
    color: '#FF6B6B',
  },
  conditionLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  current: {
    color: '#C9D1E8',
    fontSize: 14,
  },
  info: {
    color: '#C9D1E8',
    fontSize: 14,
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    borderRadius: 24,
    backgroundColor: '#FF7A45',
  },
  disabled: {
    backgroundColor: '#4A4F6A',
  },
  pressed: {
    opacity: 0.8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#9FB3D1',
    fontSize: 15,
  },
});
