// 排隊人龍（NP-2）：ACTIVE → SOLD_OUT → COOLDOWN → 開新波。
// 不得 import engine.ts（engine 已經 import 這裡，會循環依賴）。
import { BALANCE, CHAIN_IDS, type ChainId } from './content';
import type { GameState, QueueState } from './types';

/** 人龍長度 = min(8 + 2 × Σ已開攤位等級, 20) + 額外人潮（FR17）。新局為 12。 */
export function queueCapacity(state: Pick<GameState, 'stalls' | 'queue'>): number {
  const levels = CHAIN_IDS.reduce((sum, chain) => sum + state.stalls[chain].level, 0);
  return (
    Math.min(BALANCE.queueBase + BALANCE.queuePerStallLevel * levels, BALANCE.queueMax) +
    state.queue.bonus
  );
}

/**
 * 把剩下的客人依各攤等級比例分配到已開的攤位（S2.3、FR43），總和恆等於 remaining。
 * 最大餘數法：先取整數部分，剩下的人依小數部分由大到小補 1，相同時依 CHAIN_IDS 順序。
 * 衍生值，不存檔；冷卻中 remaining 為 0，全部為 0。
 */
export function distributeQueue(
  state: Pick<GameState, 'stalls' | 'queue'>
): Record<ChainId, number> {
  const counts = Object.fromEntries(CHAIN_IDS.map((chain) => [chain, 0])) as Record<
    ChainId,
    number
  >;
  const remaining = state.queue.remaining;
  const open = CHAIN_IDS.filter((chain) => state.stalls[chain].level >= 1);
  const totalLevels = open.reduce((sum, chain) => sum + state.stalls[chain].level, 0);
  if (remaining <= 0 || totalLevels === 0) return counts;

  const fractions: { chain: ChainId; fraction: number }[] = [];
  let assigned = 0;
  for (const chain of open) {
    const quota = (remaining * state.stalls[chain].level) / totalLevels;
    counts[chain] = Math.floor(quota);
    assigned += counts[chain];
    fractions.push({ chain, fraction: quota - counts[chain] });
  }
  // sort 是穩定排序，小數相同時保留 CHAIN_IDS 的順序
  fractions.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining - assigned; i++) counts[fractions[i].chain] += 1;
  return counts;
}

/** 本波已出單人數（計量條的「今晚客流 x/y」的 x）；波中加長時不會歸零。 */
export function queueServed(queue: QueueState): number {
  return queue.length - queue.remaining;
}

/** 人龍進行中且只剩最後 3 人（計量條閃爍，UX-DR2）。 */
export function isQueueFinalStretch(queue: QueueState): boolean {
  return queue.cooldownEndsAt === null && queue.remaining >= 1 && queue.remaining <= 3;
}

/**
 * 出一單消化一位客人（completeOrder 呼叫）。冷卻中不動人龍（FR20）；
 * 剛好清空時發放完售獎勵、寫入 lastSellout、進入冷卻，並送出 queue_sold_out（FR19）。
 * 完售獎勵以本波最終的 length 計算（含波中升級的加長）。XP 造成的升級由呼叫端處理。
 */
export function advanceQueue(state: GameState, now: number): GameState {
  const queue = state.queue;
  if (queue.cooldownEndsAt !== null || queue.remaining <= 0) return state;
  const remaining = queue.remaining - 1;
  if (remaining > 0) return { ...state, queue: { ...queue, remaining } };

  const coins = BALANCE.selloutCoinsPerCustomer * queue.length;
  const energy = BALANCE.selloutEnergy;
  const xp = BALANCE.selloutXpPerCustomer * queue.length;
  return {
    ...state,
    coins: state.coins + coins,
    // 和訂單獎勵一樣可以超過體力上限
    energy: state.energy + energy,
    xp: state.xp + xp,
    queue: { ...queue, remaining: 0, cooldownEndsAt: now + BALANCE.queueCooldownMs },
    lastSellout: { wave: queue.wave, coins, energy, xp, doubled: false },
    events: [...state.events, { type: 'queue_sold_out', wave: queue.wave, length: queue.length }],
  };
}

function startNextWave(state: GameState): GameState {
  const queue = { ...state.queue, wave: state.queue.wave + 1, cooldownEndsAt: null };
  const length = queueCapacity({ stalls: state.stalls, queue });
  return { ...state, queue: { ...queue, length, remaining: length }, lastSellout: null };
}

/**
 * 人龍的時間結算（syncAll 每次都會呼叫，屬於熱路徑）：沒有變化時回傳同一個參考。
 * 冷卻結束就開新一波；離線再久也只開一波（波次要靠出單消化）。
 * 時鐘倒退時，剩餘冷卻截到 queueCooldownMs 以內，不會被拉長。
 */
export function syncQueue(state: GameState, now: number): GameState {
  const { cooldownEndsAt, remaining } = state.queue;
  if (cooldownEndsAt === null) {
    // remaining 為 0 卻沒在冷卻（例如手改存檔）：直接開新波，人龍不會永遠卡住
    return remaining > 0 ? state : startNextWave(state);
  }
  if (now >= cooldownEndsAt) return startNextWave(state);
  if (cooldownEndsAt - now > BALANCE.queueCooldownMs) {
    return { ...state, queue: { ...state.queue, cooldownEndsAt: now + BALANCE.queueCooldownMs } };
  }
  return state;
}

/**
 * 重開或升級攤位後呼叫：人龍進行中時，length 與 remaining 同時加長到新的容量（FR18）。
 * 冷卻中不變，下一波開始時才用新容量。只會變長，不會變短。
 */
export function growActiveWave(state: GameState): GameState {
  const queue = state.queue;
  if (queue.cooldownEndsAt !== null) return state;
  const delta = Math.max(0, queueCapacity(state) - queue.length);
  if (delta === 0) return state;
  return {
    ...state,
    queue: { ...queue, length: queue.length + delta, remaining: queue.remaining + delta },
  };
}
