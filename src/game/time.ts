// 時間型機制的總結算。每次 apply 前都會先執行，之後的 story 會依序加入
// syncQueue（人龍冷卻）、syncOrders（線索單到期）、syncDaily（換日歸零）。
import { type GameState, syncEnergy } from './engine';

export function syncAll(state: GameState, now: number): GameState {
  return syncEnergy(state, now);
}
