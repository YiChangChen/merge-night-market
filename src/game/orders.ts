// 訂單的時間結算與「請客人先走」（S4.2、FR29、RC-9）。
// 放在獨立模組而不是 vip.ts：兩者都要補新訂單（engine 的 createOrder），而 engine 已經 import vip 的 rollVip，
// 放進 vip.ts 會讓 engine ↔ vip 互相依賴。
import { BALANCE } from './content';
import { replaceOrder } from './engine';
import type { GameState } from './types';

/**
 * 線索單的時間結算（syncAll 每次都會呼叫，屬於熱路徑）：沒有變化時回傳同一個參考。
 * 到期（now ≥ expiresAt）或線索的菜已經發明出來，就移除並補一張新訂單；
 * 時鐘倒退時，剩餘時間截到 clueDurationMs 以內。
 */
export function syncOrders(state: GameState, now: number): GameState {
  let next = state;
  for (const order of state.orders) {
    if (order.kind !== 'clue' || order.expiresAt === undefined) continue;
    // 線索說的那道菜已經被發明出來：客人不用再暗示了，換一張單（E4 code review）
    const solved = order.recipe !== undefined && state.inventions[order.recipe]?.discovered;
    if (solved || now >= order.expiresAt) {
      next = replaceOrder(next, order.id, now);
    } else if (order.expiresAt - now > BALANCE.clueDurationMs) {
      const expiresAt = now + BALANCE.clueDurationMs;
      next = {
        ...next,
        orders: next.orders.map((o) => (o.id === order.id ? { ...o, expiresAt } : o)),
      };
    }
  }
  return next;
}

/**
 * 請客人先走（RC-9）：線索單與貴客單可以請走（貴客單在 E4 code review 加入，使用者決定：
 * 做不出來或不想做的貴客單不會永遠佔住欄位）；移除後補一張一般單，不扣人龍。一般單回傳原 state。
 */
export function dismissOrder(state: GameState, orderId: number, now: number): GameState {
  const order = state.orders.find((o) => o.id === orderId);
  if (order?.kind !== 'clue' && order?.kind !== 'vip') return state;
  return replaceOrder(state, orderId, now);
}

/** 線索單需要結算：到期、線索的菜已經發明出來，或時鐘倒退讓剩餘時間超過上限（needsTick 用）。 */
export function clueNeedsSync(
  state: Pick<GameState, 'orders' | 'inventions'>,
  now: number
): boolean {
  return state.orders.some(
    (order) =>
      order.kind === 'clue' &&
      order.expiresAt !== undefined &&
      (now >= order.expiresAt ||
        order.expiresAt - now > BALANCE.clueDurationMs ||
        (order.recipe !== undefined && state.inventions[order.recipe]?.discovered === true))
  );
}
