import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { BALANCE, type ChainId, RECIPES_BY_ID, type RecipeId, STALLS } from '@/game/content';
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
 * 未達成的條件標成紅色，條件都滿足才能按下按鈕。Lv3 要從棋盤上的發明菜選一道當招牌菜（S3.5）。
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
        ? {
            level: store.state.level,
            coins: store.state.coins,
            stalls: store.state.stalls,
            // Lv3 的招牌菜候選要看棋盤；面板開著時不能拖曳，訂閱棋盤不影響效能
            board: store.state.board,
          }
        : null
    )
  );
  // 玩家選的招牌菜（Lv2 → Lv3）
  const [chosen, setChosen] = useState<RecipeId | null>(null);
  // 防連點：按下後到面板關閉之間，第二次按壓不再送出（S1.10 審查的待辦）
  const submitted = useRef(false);
  if (!snapshot) return null;
  const level = snapshot.stalls[chain].level;
  const check = reopenCheck(snapshot, chain);
  const upgrade = upgradeCheck(snapshot, chain);
  const { level: playerLevel, coins } = snapshot;

  // 按下後關閉面板，讓玩家看到夜市街上的演出（鐵捲門拉起／招牌通電）
  const onReopen = () => {
    if (submitted.current) return;
    submitted.current = true;
    apply((state, now) => reopenStall(state, chain, now));
    close();
  };
  // 選好的招牌菜如果已經不在棋盤上（例如被賣掉），視為還沒選
  const signature = chosen !== null && upgrade?.candidates.includes(chosen) ? chosen : null;
  const canUpgrade = upgrade !== null && upgrade.ok && (!upgrade.needsDish || signature !== null);
  const onUpgrade = () => {
    if (submitted.current || !canUpgrade) return;
    submitted.current = true;
    apply((state, now) => upgradeStall(state, chain, now, signature ?? undefined));
    close();
  };
  const upgradeLabel = !upgrade
    ? ''
    : !upgrade.coinsMet
      ? '金幣不足'
      : upgrade.needsDish && upgrade.candidates.length === 0
        ? `需要含${stall.name}食材的發明菜`
        : upgrade.needsDish && signature === null
          ? '先選一道招牌菜'
          : `升級（🪙${upgrade.coins}）`;

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
            效果：這一攤的訂單金幣 +{Math.round(BALANCE.stallOrderBonusPerLevel * 100)}%，霓虹招牌
            {upgrade.needsDish ? '全亮，並掛上招牌菜' : '多亮一段'}
          </Text>
          <Condition label={`金幣 ${upgrade.coins}`} current={`目前 ${coins}`} met={upgrade.coinsMet} />
          {upgrade.needsDish ? (
            <>
              <Condition
                // 直接寫出是哪一攤：金幣不足時按鈕只顯示「金幣不足」，這裡仍然看得到要哪一攤的食材
                label={`1 份含${stall.name}食材的發明菜`}
                current={
                  upgrade.candidates.length > 0
                    ? `棋盤上有 ${upgrade.candidates.length} 道`
                    : '棋盤上沒有'
                }
                met={upgrade.candidates.length > 0}
              />
              {upgrade.candidates.length > 0 ? (
                <>
                  <Text style={styles.section}>選一道招牌菜（會用掉 1 份）</Text>
                  <View style={styles.options}>
                    {upgrade.candidates.map((recipe) => {
                      const selected = recipe === signature;
                      return (
                        <Pressable
                          key={recipe}
                          testID={`signature-option-${recipe}`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() => setChosen(recipe)}
                          style={[styles.option, selected && styles.optionSelected]}>
                          <Image
                            source={RECIPES_BY_ID[recipe].art}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                            style={styles.optionIcon}
                          />
                          <Text style={styles.optionText} numberOfLines={1}>
                            {RECIPES_BY_ID[recipe].name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.note}>招牌菜確定後不能更換。</Text>
                </>
              ) : null}
            </>
          ) : null}
          <Pressable
            testID="upgrade-stall"
            accessibilityRole="button"
            disabled={!canUpgrade}
            onPress={onUpgrade}
            style={({ pressed }) => [styles.primary, !canUpgrade && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{upgradeLabel}</Text>
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
  options: {
    gap: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E3A7A',
    backgroundColor: '#1B2250',
  },
  optionSelected: {
    borderColor: '#FFD966',
    backgroundColor: '#2A2F63',
  },
  optionIcon: {
    width: 36,
    height: 36,
  },
  optionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    color: '#9FB3D1',
    fontSize: 12,
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
