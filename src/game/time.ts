// 時間型機制的總結算。每次 apply 前都會先執行：體力 → 人龍 → 線索單到期（S4.2）→ 換日歸零（S6.1）。
import { BALANCE } from './content';
import { dateKeyUTC8, maxEnergy, syncDaily } from './daily';
import { syncEnergy } from './engine';
import { tutorialHint } from './invention';
import { clueNeedsSync, syncOrders } from './orders';
import { syncQueue } from './queue';
import type { GameState } from './types';

export { dateKeyUTC8 };

export function syncAll(state: GameState, now: number): GameState {
  // 教學提示放在最後：舊存檔、匯入、除錯調整等級後的第一次結算就會補上（只一次）
  return tutorialHint(syncDaily(syncOrders(syncQueue(syncEnergy(state, now), now), now), now));
}

/**
 * store 的每秒 tick 只在這裡回傳 true 時才結算（game-architecture〈Time & Day Rollover〉）。
 * 新增任何倒數計時都必須同步擴充：S4.2 線索單、S6.1 開幕週體力上限與換日。
 *
 * 冷卻只在兩種時候需要結算：到期（開新一波），以及時鐘倒退讓剩餘時間超過 3 分鐘（截短，
 * 冷卻不會被拉長）。倒數期間的畫面由計量條自己計時。
 * 不能整段冷卻都回傳 true：體力滿時 syncEnergy 每次都會更新 energyUpdatedAt，
 * 會變成每秒產生新 state 並觸發存檔（code review 2026-11-10）。
 */
export function needsTick(state: GameState, now: number): boolean {
  // 體力上限依開幕週而定（S6.1）
  if (state.energy < maxEnergy(state, now)) return true;
  // 換日（S6.1）：每天只成立一次，結算後 dateKey 就更新；時鐘倒退時不成立
  if (dateKeyUTC8(now) > state.daily.dateKey) return true;
  // 線索單（S4.2）：到期要移除並補單、時鐘倒退要截短；倒數期間的畫面由訂單卡自己計時
  if (clueNeedsSync(state, now)) return true;
  const { cooldownEndsAt } = state.queue;
  return (
    cooldownEndsAt !== null &&
    (now >= cooldownEndsAt || cooldownEndsAt - now > BALANCE.queueCooldownMs)
  );
}
