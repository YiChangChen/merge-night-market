// Story 6.1：syncAll 加上換日結算；time.ts 匯出 dateKeyUTC8。
import { createGame } from '../engine';
import { dateKeyUTC8, needsTick, syncAll } from '../time';

const NOW = Date.UTC(2026, 10, 11, 4, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe('time：每日結算', () => {
  it('dateKeyUTC8 從 time.ts 匯出', () => {
    expect(dateKeyUTC8(NOW)).toBe('2026-11-11');
  });

  it('syncAll 會換日：計數歸零並寫入新日期', () => {
    const state = {
      ...createGame(NOW, 1),
      daily: { dateKey: '2026-11-11', adEnergyUsed: 4, adDoubleUsed: 2 },
    };
    expect(syncAll(state, NOW + DAY).daily).toEqual({
      dateKey: '2026-11-12',
      adEnergyUsed: 0,
      adDoubleUsed: 0,
    });
  });

  it('syncAll 遇到時鐘倒退不歸零', () => {
    const state = {
      ...createGame(NOW, 1),
      daily: { dateKey: '2026-11-11', adEnergyUsed: 4, adDoubleUsed: 2 },
    };
    expect(syncAll(state, NOW - DAY).daily).toEqual(state.daily);
  });

  it('新局第一次結算後，同一天 needsTick 不會因為每日計數而一直為 true', () => {
    const synced = syncAll(createGame(NOW, 1), NOW);
    expect(synced.daily.dateKey).toBe('2026-11-11');
    // 新局體力是滿的（200），人龍沒在冷卻，也沒有線索單
    expect(needsTick(synced, NOW + 1000)).toBe(false);
  });
});
