import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { BALANCE, type ChainId, STALLS } from '@/game/content';
import { reopenCheck, reopenStall, upgradeCheck, upgradeStall } from '@/game/stalls';
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
 * 鐵捲門攤位顯示重開條件（FR10）；已開的攤位顯示下一級的升級條件（FR12）。
 * 未達成的條件標成紅色，條件都滿足才能按下按鈕。Lv3 需要發明菜，E3 之前一律鎖住。
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
  const upgrade = upgradeCheck(snapshot, chain);
  const { level: playerLevel, coins } = snapshot;

  // 按下後關閉面板，讓玩家看到夜市街上的演出（鐵捲門拉起／招牌通電）
  const onReopen = () => {
    apply((state, now) => reopenStall(state, chain, now));
    close();
  };
  const onUpgrade = () => {
    apply((state, now) => upgradeStall(state, chain, now));
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
      ) : upgrade ? (
        <>
          <Text style={styles.section}>升級到 {LEVEL_NAMES[upgrade.targetLevel]}</Text>
          <Text style={styles.info}>
            效果：這一攤的訂單金幣 +{Math.round(BALANCE.stallOrderBonusPerLevel * 100)}%，霓虹招牌多亮一段
          </Text>
          <Condition label={`金幣 ${upgrade.coins}`} current={`目前 ${coins}`} met={upgrade.coinsMet} />
          {upgrade.needsDish ? (
            <Condition label="1 份含這一攤食材的發明菜" current="即將開放" met={false} />
          ) : null}
          <Pressable
            testID="upgrade-stall"
            accessibilityRole="button"
            disabled={!upgrade.ok}
            onPress={onUpgrade}
            style={({ pressed }) => [styles.primary, !upgrade.ok && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>
              {upgrade.needsDish
                ? '需要發明菜（即將開放）'
                : upgrade.ok
                  ? `升級（🪙${upgrade.coins}）`
                  : '金幣不足'}
            </Text>
          </Pressable>
        </>
      ) : level === 0 ? (
        // 沒有重開條件的鐵捲門（開局攤位只會因為除錯或匯入而關閉）
        <Text style={styles.info}>暫停營業中。</Text>
      ) : (
        <Text style={styles.info}>已經是最高等級的大店。</Text>
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
