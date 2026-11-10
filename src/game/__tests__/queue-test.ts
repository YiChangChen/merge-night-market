// Story 2.1：人龍波次規則（NP-2、FR17–FR20）
import { BALANCE, BOARD_SIZE, type ChainId } from '../content';
import { completeOrder, createGame, type GameState, type Order, type Piece } from '../engine';
import {
  distributeQueue,
  growActiveWave,
  isQueueFinalStretch,
  queueCapacity,
  queueServed,
  syncQueue,
} from '../queue';
import { reopenStall, upgradeStall } from '../stalls';
import { needsTick, syncAll } from '../time';
import type { QueueState, StallLevel } from '../types';

const NOW = 1_000_000;
const COOLDOWN = BALANCE.queueCooldownMs;

const ORDER: Order = {
  id: 900,
  kind: 'normal',
  requirements: [{ chain: 'tea', level: 2 }],
  coins: 10,
  xp: 2,
  energy: 1,
};

/** 新局（體力滿、Lv1），覆寫人龍狀態；金幣、XP 歸零方便計算 */
function withQueue(queue: Partial<QueueState>, overrides: Partial<GameState> = {}): GameState {
  const base = createGame(NOW, 1);
  return { ...base, coins: 0, xp: 0, queue: { ...base.queue, ...queue }, ...overrides };
}

function withStallLevels(
  state: GameState,
  levels: Partial<Record<ChainId, StallLevel>>
): GameState {
  const stalls = { ...state.stalls };
  for (const [chain, level] of Object.entries(levels) as [ChainId, StallLevel][]) {
    stalls[chain] = { level, signatureDish: null };
  }
  return { ...state, stalls };
}

/** 放好訂單需要的品項並交單 */
function fulfil(state: GameState, now = NOW): GameState {
  const board = Array<Piece | null>(BOARD_SIZE).fill(null);
  ORDER.requirements.forEach((requirement, index) => {
    board[index] = { id: 50_000 + index, kind: 'item', ...requirement };
  });
  return completeOrder({ ...state, board, orders: [ORDER], nextId: 60_000 }, ORDER.id, now);
}

describe('queueCapacity（FR17）', () => {
  it('新局為 12', () => {
    const state = createGame(NOW, 1);
    expect(queueCapacity(state)).toBe(12);
    expect(state.queue).toMatchObject({ length: 12, remaining: 12, cooldownEndsAt: null });
  });

  it('上限 20（再加上 bonus）', () => {
    const state = withStallLevels(withQueue({}), {
      tea: 3,
      fried: 3,
      noodle: 3,
      dumpling: 3,
      sweet: 3,
    });
    expect(queueCapacity(state)).toBe(20);
    expect(queueCapacity({ ...state, queue: { ...state.queue, bonus: 2 } })).toBe(22);
  });
});

describe('出單消化人龍（FR18–FR20）', () => {
  it('一般消化：remaining − 1，只拿訂單本身的獎勵', () => {
    const next = fulfil(withQueue({ remaining: 12 }));

    expect(next.queue.remaining).toBe(11);
    expect(next.queue.cooldownEndsAt).toBeNull();
    expect(next.coins).toBe(ORDER.coins);
    expect(next.lastSellout).toBeNull();
    expect(next.events.map((event) => event.type)).toEqual(['order_completed']);
  });

  it('剛好完售：發放完售獎勵、寫入 lastSellout、進入冷卻，事件排在出單之後', () => {
    // 玩家 Lv10（升級需要 55 XP），這一單不會升級，體力只看訂單與完售
    const before = withQueue({ wave: 3, length: 14, remaining: 1 }, { energy: 50, level: 10 });
    const next = fulfil(before);

    expect(next.queue).toMatchObject({
      wave: 3,
      length: 14,
      remaining: 0,
      cooldownEndsAt: NOW + COOLDOWN,
    });
    expect(next.coins).toBe(ORDER.coins + 5 * 14);
    expect(next.energy).toBe(50 + ORDER.energy + 10);
    expect(next.lastSellout).toEqual({ wave: 3, coins: 70, energy: 10, xp: 14, doubled: false });
    expect(next.events).toEqual([
      { type: 'order_completed', kind: 'normal', coins: ORDER.coins },
      { type: 'queue_sold_out', wave: 3, length: 14 },
    ]);
  });

  it('完售的 XP 會觸發升級（升級體力也會加上）', () => {
    // Lv1 升 Lv2 需要 10 XP：訂單 2 + 完售 12 = 14
    const next = fulfil(withQueue({ length: 12, remaining: 1 }, { energy: 50 }));

    expect(next.level).toBe(2);
    expect(next.xp).toBe(14 - 10);
    expect(next.energy).toBe(50 + ORDER.energy + 10 + BALANCE.levelUpEnergy);
  });

  it('冷卻中出單：只拿基本獎勵，不動人龍，也沒有完售', () => {
    const before = withQueue(
      { remaining: 0, cooldownEndsAt: NOW + 60_000 },
      { lastSellout: { wave: 1, coins: 60, energy: 10, xp: 12, doubled: false } }
    );
    const next = fulfil(before);

    expect(next.queue).toEqual(before.queue);
    expect(next.lastSellout).toEqual(before.lastSellout);
    expect(next.coins).toBe(ORDER.coins);
    expect(next.events.map((event) => event.type)).toEqual(['order_completed']);
  });
});

describe('syncQueue', () => {
  const cooling = withQueue(
    { wave: 2, length: 12, remaining: 0, cooldownEndsAt: NOW + COOLDOWN },
    { lastSellout: { wave: 2, coins: 60, energy: 10, xp: 12, doubled: false } }
  );

  it('人龍進行中：回傳同一個參考', () => {
    const state = withQueue({ remaining: 5 });
    expect(syncQueue(state, NOW + 10 * COOLDOWN)).toBe(state);
  });

  it('冷卻還沒結束：回傳同一個參考', () => {
    expect(syncQueue(cooling, NOW + COOLDOWN - 1)).toBe(cooling);
  });

  it('冷卻結束（剛好等於也算）：開新一波，依目前攤位重算長度，清除 lastSellout', () => {
    const upgraded = withStallLevels(cooling, { tea: 2 });
    const next = syncQueue(upgraded, NOW + COOLDOWN);

    expect(next.queue).toEqual({
      wave: 3,
      length: 14,
      remaining: 14,
      cooldownEndsAt: null,
      bonus: 0,
    });
    expect(next.lastSellout).toBeNull();
  });

  it('離線很久也只開一波', () => {
    expect(syncQueue(cooling, NOW + 100 * COOLDOWN).queue.wave).toBe(3);
  });

  it('時鐘倒退：冷卻截到 3 分鐘以內，不會被拉長', () => {
    const rewound = NOW - 60 * 60 * 1000;
    const next = syncQueue(cooling, rewound);

    expect(next.queue.cooldownEndsAt).toBe(rewound + COOLDOWN);
    expect(next.queue.wave).toBe(2);
  });

  it('remaining 為 0 卻沒有冷卻（不該出現的狀態）：直接開新一波，不會卡住', () => {
    const stuck = withQueue({ wave: 4, remaining: 0, cooldownEndsAt: null });
    expect(syncQueue(stuck, NOW).queue).toMatchObject({ wave: 5, length: 12, remaining: 12 });
  });

  it('syncAll 會結算人龍', () => {
    expect(syncAll(cooling, NOW + COOLDOWN).queue.wave).toBe(3);
  });
});

describe('攤位成長讓人龍加長（FR18）', () => {
  it('波中升級：length 與 remaining 同時 + 2', () => {
    const before = withQueue({ length: 12, remaining: 5 }, { coins: 1000 });
    const next = upgradeStall(before, 'tea', NOW);

    expect(next.queue).toMatchObject({ length: 14, remaining: 7 });
  });

  it('波中重開：length 與 remaining 同時 + 2', () => {
    const before = withQueue({ length: 12, remaining: 5 }, { coins: 1000, level: 3 });
    const next = reopenStall(before, 'noodle', NOW);

    expect(next.stalls.noodle.level).toBe(1);
    expect(next.queue).toMatchObject({ length: 14, remaining: 7 });
  });

  it('冷卻中升級：人龍不變，下一波才用新的長度', () => {
    const before = withQueue(
      { length: 12, remaining: 0, cooldownEndsAt: NOW + COOLDOWN },
      { coins: 1000 }
    );
    const upgraded = upgradeStall(before, 'tea', NOW);

    expect(upgraded.queue).toEqual(before.queue);
    expect(syncQueue(upgraded, NOW + COOLDOWN).queue.length).toBe(14);
  });

  it('上限 20：growActiveWave 不會超過', () => {
    const state = withStallLevels(withQueue({ length: 19, remaining: 3 }), {
      tea: 3,
      fried: 3,
      noodle: 3,
      dumpling: 3,
      sweet: 3,
    });
    expect(growActiveWave(state).queue).toMatchObject({ length: 20, remaining: 4 });
  });

  it('容量沒有變大時回傳同一個參考', () => {
    const state = withQueue({ length: 12, remaining: 3 });
    expect(growActiveWave(state)).toBe(state);
  });
});

describe('needsTick（store 的每秒 tick）', () => {
  it('體力滿且人龍進行中：false', () => {
    expect(needsTick(withQueue({ remaining: 5 }, { energy: BALANCE.maxEnergy }), NOW)).toBe(false);
  });

  it('體力沒滿：true', () => {
    expect(needsTick(withQueue({ remaining: 5 }, { energy: 40 }), NOW)).toBe(true);
  });

  it('冷卻中、體力滿：還沒到期時 false（不每秒存檔），到期時 true（開新一波）', () => {
    const state = withQueue(
      { remaining: 0, cooldownEndsAt: NOW + COOLDOWN },
      { energy: BALANCE.maxEnergy + 10 }
    );
    expect(needsTick(state, NOW)).toBe(false);
    expect(needsTick(state, NOW + COOLDOWN - 1)).toBe(false);
    expect(needsTick(state, NOW + COOLDOWN)).toBe(true);
  });

  it('時鐘倒退讓剩餘冷卻超過 3 分鐘：true（立刻截短，閒置時冷卻也不會被拉長）', () => {
    const state = withQueue(
      { remaining: 0, cooldownEndsAt: NOW + COOLDOWN },
      { energy: BALANCE.maxEnergy }
    );
    expect(needsTick(state, NOW - 60 * 60 * 1000)).toBe(true);
  });
});

describe('計量條用的小工具（S2.2）', () => {
  const queue = (q: Partial<QueueState>): QueueState => ({ ...withQueue({}).queue, ...q });

  it('queueServed：已出單人數；波中加長時不會歸零', () => {
    expect(queueServed(queue({ length: 12, remaining: 5 }))).toBe(7);
    expect(queueServed(queue({ length: 14, remaining: 7 }))).toBe(7);
  });

  it('isQueueFinalStretch：只在人龍進行中、剩 1–3 人時為 true', () => {
    expect(isQueueFinalStretch(queue({ remaining: 4 }))).toBe(false);
    expect(isQueueFinalStretch(queue({ remaining: 3 }))).toBe(true);
    expect(isQueueFinalStretch(queue({ remaining: 1 }))).toBe(true);
    expect(isQueueFinalStretch(queue({ remaining: 0, cooldownEndsAt: NOW }))).toBe(false);
  });
});

describe('distributeQueue（S2.3、FR43）', () => {
  const sum = (counts: Record<ChainId, number>) =>
    Object.values(counts).reduce((total, count) => total + count, 0);

  it('各攤等級相同時平均分配；鐵捲門分到 0', () => {
    // 新局：tea、fried Lv1，其餘鐵捲門
    const counts = distributeQueue(withQueue({ remaining: 12 }));
    expect(counts).toEqual({ tea: 6, fried: 6, noodle: 0, dumpling: 0, sweet: 0 });
  });

  it('依等級比例：Lv2 對 Lv1 為 2:1', () => {
    const state = withStallLevels(withQueue({ remaining: 12 }), { tea: 2 });
    expect(distributeQueue(state)).toMatchObject({ tea: 8, fried: 4 });
  });

  it('餘數依小數部分分配，相同時依攤位順序', () => {
    // 3 攤 Lv1、7 人：各 2.33 → 2、2、2，剩 1 人給第一攤
    const state = withStallLevels(withQueue({ remaining: 7 }), { noodle: 1 });
    expect(distributeQueue(state)).toMatchObject({ tea: 3, fried: 2, noodle: 2 });
  });

  it.each([
    [{ tea: 3, fried: 1 }, 1],
    [{ tea: 2, fried: 2, noodle: 1, dumpling: 3 }, 13],
    [{ tea: 1, fried: 3, noodle: 2, dumpling: 1, sweet: 2 }, 19],
    [{ tea: 3, fried: 3, noodle: 3, dumpling: 3, sweet: 3 }, 20],
  ] as const)('總和守恆：%o、%i 人', (levels, remaining) => {
    const state = withStallLevels(withQueue({ remaining }), levels);
    expect(sum(distributeQueue(state))).toBe(remaining);
  });

  it('冷卻中全部為 0', () => {
    const state = withQueue({ remaining: 0, cooldownEndsAt: NOW + COOLDOWN });
    expect(sum(distributeQueue(state))).toBe(0);
  });
});
