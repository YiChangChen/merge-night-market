// 排隊人龍（NP-2）。S1.5 先提供開新一波需要的長度公式，S2.1 會補上波次狀態機。
import { BALANCE, CHAIN_IDS } from './content';
import type { GameState } from './types';

/** 人龍長度 = min(8 + 2 × Σ已開攤位等級, 20) + 額外人潮（FR17）。新局為 12。 */
export function queueCapacity(state: Pick<GameState, 'stalls' | 'queue'>): number {
  const levels = CHAIN_IDS.reduce((sum, chain) => sum + state.stalls[chain].level, 0);
  return (
    Math.min(BALANCE.queueBase + BALANCE.queuePerStallLevel * levels, BALANCE.queueMax) +
    state.queue.bonus
  );
}
