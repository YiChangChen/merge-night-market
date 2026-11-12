// 新手教學（S6.4、FR40）：3 步依序由實際的 GameEvent 推進，進度記在 meta.tutorialStep。
// 只依賴 content 與 types；engine（新手訂單金幣）與 store（apply 後推進）都會 import 這裡。
import { BALANCE, CHAIN_IDS } from './content';
import type { GameEvent } from './events';
import type { GameState } from './types';

/** 每一步要等的事件：0 合成、1 出餐、2 升級攤位 */
const STEP_EVENTS: readonly GameEvent['type'][] = [
  'item_merged',
  'order_completed',
  'stall_upgraded',
];

export function tutorialDone(state: Pick<GameState, 'meta'>): boolean {
  return state.meta.tutorialStep >= BALANCE.tutorialSteps;
}

/**
 * 教學期間建立的一般單金幣倍率（AC4）：新手 8 張單以內一定能存到第一次升級的 200 金幣。
 * 在建立訂單時套用並鎖定（RC-3）；教學完成後恢復 1。
 * 只在玩家 Lv2 以下套用：前 8 張單一定在 Lv1、Lv2 建立；一直不升級攤位也不能無限期拿 ×2.5（E6 code review，使用者決定）。
 */
export function tutorialOrderCoinMultiplier(state: Pick<GameState, 'meta' | 'level'>): number {
  return tutorialDone(state) || state.level > BALANCE.tutorialBonusMaxLevel
    ? 1
    : BALANCE.tutorialOrderCoinMultiplier;
}

function stepDone(state: GameState, step: number): boolean {
  if (state.events.some((event) => event.type === STEP_EVENTS[step])) return true;
  // 第 3 步：已經有攤位升到 Lv2 以上（例如自己先升級了）也算完成
  return step === 2 && CHAIN_IDS.some((chain) => state.stalls[chain].level >= 2);
}

/**
 * 依這一批事件推進教學（store 的 apply 在 action 之後呼叫，每個動作都會經過）。
 * 不是這一步的事件不推進；同一批事件可以連續推進。沒有變化時回傳同一個參考。
 */
export function advanceTutorial(state: GameState): GameState {
  let step = state.meta.tutorialStep;
  while (step < BALANCE.tutorialSteps && stepDone(state, step)) step += 1;
  if (step === state.meta.tutorialStep) return state;
  return { ...state, meta: { ...state.meta, tutorialStep: step } };
}
