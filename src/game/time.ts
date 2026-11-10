// 時間型機制的總結算。每次 apply 前都會先執行，之後的 story 會依序加入
// syncOrders（線索單到期）、syncDaily（換日歸零）。
import { BALANCE } from './content';
import { syncEnergy } from './engine';
import { syncQueue } from './queue';
import type { GameState } from './types';

export function syncAll(state: GameState, now: number): GameState {
  return syncQueue(syncEnergy(state, now), now);
}

/**
 * store 的每秒 tick 只在這裡回傳 true 時才結算（game-architecture〈Time & Day Rollover〉）。
 * 新增任何倒數計時都必須同步擴充：S4.2 線索單、S6.1 開幕週體力上限。
 *
 * 冷卻只在兩種時候需要結算：到期（開新一波），以及時鐘倒退讓剩餘時間超過 3 分鐘（截短，
 * 冷卻不會被拉長）。倒數期間的畫面由計量條自己計時。
 * 不能整段冷卻都回傳 true：體力滿時 syncEnergy 每次都會更新 energyUpdatedAt，
 * 會變成每秒產生新 state 並觸發存檔（code review 2026-11-10）。
 */
export function needsTick(state: GameState, now: number): boolean {
  if (state.energy < BALANCE.maxEnergy) return true;
  const { cooldownEndsAt } = state.queue;
  return (
    cooldownEndsAt !== null &&
    (now >= cooldownEndsAt || cooldownEndsAt - now > BALANCE.queueCooldownMs)
  );
}
