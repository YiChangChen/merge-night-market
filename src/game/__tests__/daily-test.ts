// Story 6.1：開幕週體力上限與每日廣告計數（FR36、NP-4）。
import { BALANCE } from '../content';
import {
  adRemaining,
  canWatchAd,
  dateKeyUTC8,
  grantAdReward,
  maxEnergy,
  syncDaily,
} from '../daily';
import { createGame, type GameState, syncEnergy } from '../engine';
import { migrateV1ToV2 } from '../save/migrations';
import { needsTick } from '../time';
import type { LastSellout } from '../types';
import { xpToNextLevel } from '../levels';

// 2026-11-11 12:00 UTC+8（04:00 UTC）
const NOW = Date.UTC(2026, 10, 11, 4, 0, 0);
const HOUR = 60 * 60 * 1000;
const WEEK = BALANCE.openingWeekMs;
const TODAY = '2026-11-11';

function game(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(NOW, 1), ...overrides };
}

const sellout = (patch: Partial<LastSellout> = {}): LastSellout => ({
  wave: 3,
  coins: 60,
  energy: 10,
  xp: 12,
  doubled: false,
  ...patch,
});

describe('maxEnergy：開幕週 200，之後 100（FR36）', () => {
  it('開幕週的邊界：71:59 還是 200，72:00 起是 100', () => {
    const state = game();
    expect(maxEnergy(state, NOW)).toBe(200);
    expect(maxEnergy(state, NOW + 72 * HOUR - 60_000)).toBe(200);
    expect(maxEnergy(state, NOW + 72 * HOUR - 1)).toBe(200);
    expect(maxEnergy(state, NOW + 72 * HOUR)).toBe(100);
    expect(BALANCE.openingWeekMaxEnergy).toBe(200);
    expect(BALANCE.maxEnergy).toBe(100);
  });

  it('不存檔：meta 只有原本的欄位', () => {
    expect(Object.keys(game().meta).sort()).toEqual([
      'firstLaunchAt',
      'hintedRecipes',
      'tutorialStep',
    ]);
  });

  it('v1 遷移的玩家不享有開幕週', () => {
    const migrated = migrateV1ToV2(
      {
        version: 1,
        board: Array(BALANCE.boardColumns * BALANCE.boardRows).fill(null),
        orders: [],
        energy: 50,
        energyUpdatedAt: NOW,
        coins: 0,
        level: 1,
        xp: 0,
        pendingGenerators: [],
        nextId: 1,
        rngSeed: 1,
      },
      NOW
    );
    expect(maxEnergy(migrated, NOW)).toBe(100);
  });
});

describe('體力回復依開幕週上限', () => {
  const regen = BALANCE.energyRegenMs;

  it('新局體力 200', () => {
    expect(game().energy).toBe(200);
  });

  it('開幕週內會回復到 200', () => {
    const state = game({ energy: 150, energyUpdatedAt: NOW });
    expect(syncEnergy(state, NOW + regen * 10).energy).toBe(160);
    expect(syncEnergy(state, NOW + regen * 80).energy).toBe(200);
  });

  it('開幕週結束時超過 100 的體力保留，但不會再回復', () => {
    const state = game({ energy: 150, energyUpdatedAt: NOW + WEEK });
    const later = syncEnergy(state, NOW + WEEK + regen * 30);
    expect(later.energy).toBe(150);
  });

  it('開幕週結束後降到 100 以下，才回復到 100 為止', () => {
    const state = game({ energy: 95, energyUpdatedAt: NOW + WEEK });
    expect(syncEnergy(state, NOW + WEEK + regen * 30).energy).toBe(100);
  });

  it('needsTick：開幕週內體力 150 時為 true；結束後 150 時為 false', () => {
    const state = syncDaily(game({ energy: 150 }), NOW);
    expect(needsTick(state, NOW + 1000)).toBe(true);
    const after = syncDaily(game({ energy: 150 }), NOW + WEEK);
    expect(needsTick(after, NOW + WEEK + 1000)).toBe(false);
  });
});

describe('dateKeyUTC8 與 syncDaily', () => {
  it('以 UTC+8 換日：UTC 15:59 還是當天，16:00 是隔天', () => {
    expect(dateKeyUTC8(Date.UTC(2026, 10, 11, 15, 59, 59))).toBe('2026-11-11');
    expect(dateKeyUTC8(Date.UTC(2026, 10, 11, 16, 0, 0))).toBe('2026-11-12');
    expect(dateKeyUTC8(Date.UTC(2026, 11, 31, 16, 0, 0))).toBe('2027-01-01');
  });

  it('裝置時區改變不影響結果：本地時間的取值全部是錯的也照樣算對（E6 code review）', () => {
    // 執行中切換 TZ 在這個環境不會生效，所以改成讓所有「本地時間」的取值回傳錯的值：
    // 實作只要用到本地時間（受裝置時區影響），結果就會錯
    const local = ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getTimezoneOffset'] as const;
    const spies = local.map((name) => jest.spyOn(Date.prototype, name).mockReturnValue(7));
    try {
      expect(dateKeyUTC8(Date.UTC(2026, 10, 11, 15, 59, 59))).toBe('2026-11-11');
      expect(dateKeyUTC8(Date.UTC(2026, 10, 11, 16, 0, 0))).toBe('2026-11-12');
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('新局開局就是當天日期；dateKey 是空字串（v1 遷移）時，第一次結算寫入當天日期', () => {
    expect(game().daily).toEqual({ dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 });
    const migrated = game({ daily: { dateKey: '', adEnergyUsed: 0, adDoubleUsed: 0 } });
    expect(syncDaily(migrated, NOW).daily).toEqual({
      dateKey: TODAY,
      adEnergyUsed: 0,
      adDoubleUsed: 0,
    });
  });

  it('跨日把兩個計數歸零', () => {
    const state = game({ daily: { dateKey: TODAY, adEnergyUsed: 5, adDoubleUsed: 3 } });
    expect(syncDaily(state, NOW + 24 * HOUR).daily).toEqual({
      dateKey: '2026-11-12',
      adEnergyUsed: 0,
      adDoubleUsed: 0,
    });
  });

  it('同一天回傳同一個參考', () => {
    const state = game({ daily: { dateKey: TODAY, adEnergyUsed: 2, adDoubleUsed: 1 } });
    expect(syncDaily(state, NOW + HOUR)).toBe(state);
  });

  it('時鐘倒退到前一天：視為還沒換日，不歸零', () => {
    const state = game({ daily: { dateKey: TODAY, adEnergyUsed: 5, adDoubleUsed: 3 } });
    expect(syncDaily(state, NOW - 24 * HOUR)).toBe(state);
  });

  it('needsTick：換日時為 true，結算後同一天為 false', () => {
    const state = game({
      energy: 300,
      daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 },
    });
    expect(needsTick(state, NOW + HOUR)).toBe(false);
    expect(needsTick(state, NOW + 24 * HOUR)).toBe(true);
    expect(needsTick({ ...state, daily: { ...state.daily, dateKey: '' } }, NOW)).toBe(true);
  });
});

describe('canWatchAd 與 adRemaining（NP-4）', () => {
  const daily = (adEnergyUsed: number, adDoubleUsed: number) => ({
    dateKey: TODAY,
    adEnergyUsed,
    adDoubleUsed,
  });

  it('energy：體力不足而且今天還沒看滿 5 次', () => {
    expect(canWatchAd(game({ energy: 0, daily: daily(4, 0) }), 'energy')).toBe(true);
    expect(canWatchAd(game({ energy: 0, daily: daily(5, 0) }), 'energy')).toBe(false);
    expect(canWatchAd(game({ energy: 1, daily: daily(0, 0) }), 'energy')).toBe(false);
    expect(adRemaining(game({ daily: daily(2, 0) }), 'energy')).toBe(3);
    expect(adRemaining(game({ daily: daily(7, 0) }), 'energy')).toBe(0);
  });

  it('sellout-double：有完售紀錄、還沒加倍、今天還沒看滿 3 次', () => {
    expect(canWatchAd(game({ lastSellout: sellout(), daily: daily(0, 2) }), 'sellout-double')).toBe(
      true
    );
    expect(canWatchAd(game({ lastSellout: sellout(), daily: daily(0, 3) }), 'sellout-double')).toBe(
      false
    );
    expect(canWatchAd(game({ lastSellout: null }), 'sellout-double')).toBe(false);
    expect(canWatchAd(game({ lastSellout: sellout({ doubled: true }) }), 'sellout-double')).toBe(
      false
    );
    expect(adRemaining(game({ daily: daily(0, 1) }), 'sellout-double')).toBe(2);
  });
});

describe('grantAdReward（NP-4）', () => {
  it('energy：+20 體力（可以超過上限），計數 +1，送出 ad_rewarded', () => {
    const state = game({ energy: 0, daily: { dateKey: TODAY, adEnergyUsed: 1, adDoubleUsed: 0 } });
    const next = grantAdReward(state, 'energy', NOW);
    expect(next.energy).toBe(20);
    expect(next.daily.adEnergyUsed).toBe(2);
    expect(next.events).toEqual([{ type: 'ad_rewarded', placement: 'energy' }]);
  });

  it('energy 連續呼叫兩次（看了兩支廣告）：兩次都給，各用掉一次額度', () => {
    const state = game({ energy: 0, daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 } });
    const once = { ...grantAdReward(state, 'energy', NOW), events: [] };
    const twice = grantAdReward(once, 'energy', NOW);
    expect(twice.energy).toBe(40);
    expect(twice.daily.adEnergyUsed).toBe(2);
  });

  it('播放期間體力自然回復了：看完的人仍然拿到獎勵（E6 code review）', () => {
    // 按鈕只在體力 0 時出現；播放 30 秒期間回了 1 點
    const state = game({ energy: 1, daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 } });
    expect(canWatchAd(state, 'energy')).toBe(false);
    const next = grantAdReward(state, 'energy', NOW);
    expect(next.energy).toBe(21);
    expect(next.daily.adEnergyUsed).toBe(1);
  });

  it('每日上限：第 6 次不給；跨日後又可以', () => {
    const state = game({ energy: 0, daily: { dateKey: TODAY, adEnergyUsed: 5, adDoubleUsed: 0 } });
    expect(grantAdReward(state, 'energy', NOW)).toBe(state);
    const tomorrow = grantAdReward(state, 'energy', NOW + 24 * HOUR);
    expect(tomorrow.energy).toBe(20);
    expect(tomorrow.daily).toEqual({ dateKey: '2026-11-12', adEnergyUsed: 1, adDoubleUsed: 0 });
  });

  it.each([
    [sellout()],
    [sellout({ coins: 5, energy: 10, xp: 1 })],
    [sellout({ coins: 100, energy: 10, xp: 20 })],
  ])('sellout-double：完售獎勵整份再發一次（%o）', (last) => {
    const state = game({
      coins: 7,
      energy: 3,
      xp: 0,
      level: 30,
      lastSellout: last,
      daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 1 },
    });
    const next = grantAdReward(state, 'sellout-double', NOW);
    expect(next.coins).toBe(7 + last.coins);
    expect(next.energy).toBe(3 + last.energy);
    expect(next.xp).toBe(last.xp);
    expect(next.lastSellout).toEqual({ ...last, doubled: true });
    expect(next.daily.adDoubleUsed).toBe(2);
    expect(next.events).toEqual([{ type: 'ad_rewarded', placement: 'sellout-double' }]);
  });

  it('同一波重複加倍：第二次回傳原本的 state', () => {
    const state = game({
      lastSellout: sellout(),
      daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 },
    });
    const once = { ...grantAdReward(state, 'sellout-double', NOW), events: [] };
    expect(grantAdReward(once, 'sellout-double', NOW)).toBe(once);
  });

  it('完售加倍的 XP 會結算升級（含升級體力）', () => {
    const need = xpToNextLevel(1);
    const state = game({
      xp: need - 5,
      energy: 0,
      lastSellout: sellout({ xp: 10, energy: 10 }),
      daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 },
    });
    const next = grantAdReward(state, 'sellout-double', NOW);
    expect(next.level).toBe(2);
    expect(next.xp).toBe(5);
    expect(next.energy).toBe(10 + BALANCE.levelUpEnergy);
  });

  it('沒有完售紀錄：回傳結算後的 state，不給任何東西', () => {
    const state = game({
      lastSellout: null,
      daily: { dateKey: TODAY, adEnergyUsed: 0, adDoubleUsed: 0 },
    });
    expect(grantAdReward(state, 'sellout-double', NOW)).toBe(state);
  });
});
