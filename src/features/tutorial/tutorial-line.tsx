import { StyleSheet, Text, View } from 'react-native';

import { BALANCE, STALLS } from '@/game/content';
import { useGameStore } from '@/game/store';
import { tutorialFocusLine } from '@/game/tutorial-focus';

// 說明文字和手指層分開放：棋盤、夜市街要用說明，但不能 import 依賴 overlays 的手指層（避免互相 import）
const FIRST_UPGRADE_COINS = STALLS.tea.upgradeCoins[2];

/**
 * 每一步的說明（一句話）的預設版本。第 1、2 步實際顯示的是 tutorialFocusLine（含要做的品項）；
 * 第 3 步金幣不夠時，先告訴玩家要存多少。
 */
export function tutorialLine(step: number, coins: number): string | null {
  if (step === 0) return '👆 點產生器出食材，把兩個一樣的拖在一起合成';
  if (step === 1) return '👆 做出訂單要的品項，點訂單出餐';
  if (step === 2) {
    return coins >= FIRST_UPGRADE_COINS
      ? '👆 到夜市街，點攤位升級到 Lv2'
      : `存到 ${FIRST_UPGRADE_COINS} 金幣就能升級攤位（目前 ${coins}/${FIRST_UPGRADE_COINS}）`;
  }
  return null;
}

/** 目前這一步的說明；教學完成（或還沒讀檔）時是 null。第 1、2 步依第一張訂單說出要做什麼，第 3 步才訂閱金幣。 */
export function useTutorialLine(): string | null {
  const step = useGameStore((store) => store.state?.meta.tutorialStep ?? BALANCE.tutorialSteps);
  const focusLine = useGameStore((store) =>
    store.state && step < 2 ? tutorialFocusLine(store.state) : null
  );
  const coins = useGameStore((store) => (step === 2 ? (store.state?.coins ?? 0) : 0));
  return focusLine ?? tutorialLine(step, coins);
}

/** 只在指定步驟顯示的說明列（夜市街用）；不擋觸控。 */
export function TutorialLine({ steps }: { steps: readonly number[] }) {
  const step = useGameStore((store) => store.state?.meta.tutorialStep ?? BALANCE.tutorialSteps);
  const line = useTutorialLine();
  if (!line || !steps.includes(step)) return null;
  return (
    <View testID="tutorial-line" pointerEvents="none" style={styles.line}>
      <Text style={styles.lineText}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#11173AE6',
    borderWidth: 1,
    borderColor: '#FFD966',
  },
  lineText: {
    color: '#FFD966',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
