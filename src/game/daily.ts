// 開幕週體力上限與每日廣告計數（S6.1、FR36、NP-4）。
// 只依賴 content、types、levels；engine 與 time 都 import 這裡，所以這裡不能 import 它們。
import { BALANCE } from './content';
import { applyLevelUps } from './levels';
import type { GameState } from './types';

export type Placement = 'energy' | 'sellout-double';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 體力上限（衍生值，不存檔）：首次啟動後 72 小時內是 200，之後是 100（FR36）。 */
export function maxEnergy(state: { meta: { firstLaunchAt: number } }, now: number): number {
  return now < state.meta.firstLaunchAt + BALANCE.openingWeekMs
    ? BALANCE.openingWeekMaxEnergy
    : BALANCE.maxEnergy;
}

/** UTC+8（台北）的日期 'YYYY-MM-DD'；只依時間戳計算，和裝置時區無關，可以直接用字串比大小。 */
export function dateKeyUTC8(now: number): string {
  const date = new Date(now + UTC8_OFFSET_MS);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * 換日歸零：日期變大時兩個廣告計數歸零並寫入新日期（空字串比任何日期都小，第一次結算會寫入當天）。
 * 日期相同或變小（時鐘倒退）時視為還沒換日，回傳同一個參考。
 */
export function syncDaily(state: GameState, now: number): GameState {
  const dateKey = dateKeyUTC8(now);
  if (dateKey <= state.daily.dateKey) return state;
  return { ...state, daily: { dateKey, adEnergyUsed: 0, adDoubleUsed: 0 } };
}

function dailyLimit(placement: Placement): number {
  return placement === 'energy' ? BALANCE.adEnergyDailyLimit : BALANCE.adDoubleDailyLimit;
}

function used(state: Pick<GameState, 'daily'>, placement: Placement): number {
  return placement === 'energy' ? state.daily.adEnergyUsed : state.daily.adDoubleUsed;
}

/** 今天還能看幾次（給按鈕顯示）。呼叫前 state 要先經過 syncDaily。 */
export function adRemaining(state: Pick<GameState, 'daily'>, placement: Placement): number {
  return Math.max(0, dailyLimit(placement) - used(state, placement));
}

/**
 * 能不能看這個廣告（NP-4，UI 按鈕的規則層條件）。只看 state，呼叫前要先經過 syncDaily。
 * - energy：體力不足（和 getSpawnBlocker 的 no-energy 同一個條件），而且今天還有次數。
 * - sellout-double：這一波的完售紀錄還在、還沒加倍，而且今天還有次數。
 */
export function canWatchAd(state: GameState, placement: Placement): boolean {
  if (adRemaining(state, placement) <= 0) return false;
  if (placement === 'energy') return state.energy < BALANCE.spawnEnergyCost;
  return state.lastSellout !== null && !state.lastSellout.doubled;
}

/**
 * 看完廣告的獎勵（NP-4）：獎勵發放的唯一入口。先換日結算，不能看就回傳結算後的 state，所以重複呼叫是安全的。
 * - energy：+20 體力（和其他獎勵一樣可以超過上限）。
 * - sellout-double：這一波的完售獎勵（金幣、體力、XP）整份再發一次並標記已加倍，XP 造成的升級一併結算。
 */
export function grantAdReward(state: GameState, placement: Placement, now: number): GameState {
  const synced = syncDaily(state, now);
  if (!canWatchAd(synced, placement)) return synced;
  const events = [...synced.events, { type: 'ad_rewarded', placement } as const];
  if (placement === 'energy') {
    return {
      ...synced,
      energy: synced.energy + BALANCE.adEnergy,
      daily: { ...synced.daily, adEnergyUsed: synced.daily.adEnergyUsed + 1 },
      events,
    };
  }
  // canWatchAd 已確認完售紀錄存在而且還沒加倍
  const sellout = synced.lastSellout!;
  return applyLevelUps({
    ...synced,
    coins: synced.coins + sellout.coins,
    energy: synced.energy + sellout.energy,
    xp: synced.xp + sellout.xp,
    lastSellout: { ...sellout, doubled: true },
    daily: { ...synced.daily, adDoubleUsed: synced.daily.adDoubleUsed + 1 },
    events,
  });
}
