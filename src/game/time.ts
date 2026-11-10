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
 * 新增任何倒數計時都必須同步擴充：S4.2 線索單、S6.1 開幕週體力上限（會用到 now）。
 */
export function needsTick(state: GameState, _now: number): boolean {
  return state.energy < BALANCE.maxEnergy || state.queue.cooldownEndsAt !== null;
}
