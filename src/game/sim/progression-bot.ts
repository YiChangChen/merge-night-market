// 進度模擬（S7.5）：用規則層函式扮演一位「照表操課」的玩家，從開局玩到 5 攤全部 Lv3，
// 量出各個里程碑落在第幾天、第幾次開啟。結果寫進 docs/balance.md，當封測校正時的模擬基準。
//
// 只給測試與文件用，App 不會 import。玩家模型刻意簡化（見 PlayerProfile 與 docs/balance.md 的說明）：
// - bot 知道所有配方：比真人更快發明，「首次發明」是樂觀值
// - 每次開啟都把體力用完才離開；不看廣告
import { BALANCE, CHAIN_IDS, CHAINS, type ChainId, RECIPES, type RecipeId } from '../content';
import { applyDrop } from '../drop';
import {
  baseCost,
  completeOrder,
  createGame,
  findOrderCells,
  getSpawnBlocker,
  sellPiece,
  tapGenerator,
} from '../engine';
import { canInvent } from '../invention';
import { dismissOrder } from '../orders';
import {
  reopenCheck,
  signatureCandidates,
  upgradeCheck,
  upgradeStall,
  reopenStall,
} from '../stalls';
import { syncAll } from '../time';
import { advanceTutorial } from '../tutorial';
import type { GameState, ItemPiece } from '../types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** 首次啟動的時刻：第 0 天晚上 7 點（逛夜市的時間）；當天只剩這之後的開啟 */
const FIRST_LAUNCH_HOUR = 19;

export type PlayerProfile = {
  name: string;
  /** 每天開啟 App 的時刻（開局當天的時鐘，小時，可以有小數），依序排列 */
  sessionHours: readonly number[];
  /** 每個操作（產出、合成、出單…）花的時間 */
  actionMs: number;
  /** 單次開啟最長玩多久；體力用完會更早離開 */
  maxSessionMs: number;
};

export const PROFILES: readonly PlayerProfile[] = [
  {
    name: '輕度：一天 3 次、每次 5 分鐘',
    sessionHours: [12.5, 19, 22.5],
    actionMs: 2000,
    maxSessionMs: 5 * 60 * 1000,
  },
  {
    name: '中度：一天 5 次、每次 6 分鐘',
    sessionHours: [8, 12.5, 16, 19, 22.5],
    actionMs: 2000,
    maxSessionMs: 6 * 60 * 1000,
  },
  {
    name: '重度：一天 5 次、每次玩到體力用完',
    sessionHours: [8, 12.5, 16, 19, 22.5],
    actionMs: 2000,
    maxSessionMs: 60 * 60 * 1000,
  },
];

export type Milestone =
  | 'firstUpgrade'
  | 'firstInvention'
  | 'reopenNoodle'
  | 'reopenDumpling'
  | 'reopenSweet'
  | 'allLv2'
  | 'allRecipes'
  | 'allLv3';

/** 里程碑達成的時間點：開局後第幾天（0 起算）、第幾次開啟（1 起算） */
export type MilestoneHit = { day: number; session: number };

export type SessionStat = { durationMs: number; energyOut: boolean };

export type RunResult = {
  seed: number;
  milestones: Partial<Record<Milestone, MilestoneHit>>;
  sessions: SessionStat[];
  /** 花在重開與升級的金幣 */
  coinsSpent: number;
  ordersCompleted: number;
  finished: boolean;
};

type Need = { chain: ChainId; level: number };

/** 這一輪想湊齊的品項：一般訂單的需求，加上想發明的配方材料 */
function collectNeeds(state: GameState): { needs: Need[]; recipes: RecipeId[] } {
  const needs: Need[] = [];
  for (const order of state.orders) {
    if (order.kind === 'normal') needs.push(...order.requirements);
  }
  const recipes = wantedRecipes(state);
  for (const id of recipes) {
    const recipe = RECIPES.find((r) => r.id === id);
    if (recipe) needs.push(recipe.a, recipe.b);
  }
  return { needs, recipes };
}

/** 想做的發明菜：還沒發現的可發明配方、貴客單要的菜、Lv2 攤位升 Lv3 要用的招牌菜 */
function wantedRecipes(state: GameState): RecipeId[] {
  const wanted = new Set<RecipeId>();
  const onBoard = new Set(
    state.board.flatMap((piece) => (piece?.kind === 'dish' ? [piece.recipe] : []))
  );
  for (const recipe of RECIPES) {
    if (canInvent(recipe, state.stalls) && !state.inventions[recipe.id]?.discovered) {
      wanted.add(recipe.id);
    }
  }
  for (const order of state.orders) {
    if (order.kind === 'vip' && order.recipe && !onBoard.has(order.recipe))
      wanted.add(order.recipe);
  }
  for (const chain of CHAIN_IDS) {
    if (state.stalls[chain].level !== 2) continue;
    if (signatureCandidates(state, chain).length > 0) continue;
    const recipe = RECIPES.find(
      (r) => (r.a.chain === chain || r.b.chain === chain) && canInvent(r, state.stalls)
    );
    if (recipe) wanted.add(recipe.id);
  }
  return [...wanted];
}

const isItem = (piece: unknown): piece is ItemPiece => (piece as ItemPiece | null)?.kind === 'item';

/** 每個 (鏈, 階) 在棋盤上的格子 */
function itemCells(state: GameState): Map<string, number[]> {
  const cells = new Map<string, number[]>();
  state.board.forEach((piece, index) => {
    if (!isItem(piece)) return;
    const key = `${piece.chain}:${piece.level}`;
    const list = cells.get(key) ?? [];
    list.push(index);
    cells.set(key, list);
  });
  return cells;
}

/** 依需求保留棋盤上的品項，回傳保留的格子與還沒湊到的需求 */
function reserve(state: GameState, needs: Need[]): { reserved: Set<number>; unmet: Need[] } {
  const cells = itemCells(state);
  const reserved = new Set<number>();
  const unmet: Need[] = [];
  for (const need of needs) {
    const list = cells.get(`${need.chain}:${need.level}`) ?? [];
    const cell = list.find((c) => !reserved.has(c));
    if (cell === undefined) unmet.push(need);
    else reserved.add(cell);
  }
  return { reserved, unmet };
}

type Step = {
  state: GameState;
  kind: 'spend' | 'order' | 'dismiss' | 'invent' | 'merge' | 'spawn' | 'sell';
};

/** 選一個操作；沒有可以做的事時回傳 null（體力用完、也沒有可合成或可出的單）。 */
function nextStep(state: GameState, now: number): Step | null {
  // 1. 花錢：重開攤位優先，再升級（Lv3 用第一道候選菜當招牌菜）
  for (const chain of CHAIN_IDS) {
    if (reopenCheck(state, chain)?.ok)
      return { state: reopenStall(state, chain, now), kind: 'spend' };
  }
  for (const chain of CHAIN_IDS) {
    const check = upgradeCheck(state, chain);
    if (!check?.ok) continue;
    return { state: upgradeStall(state, chain, now, check.candidates[0]), kind: 'spend' };
  }

  // 2. 出單：做得出來的訂單直接交（含貴客單）
  for (const order of state.orders) {
    if (findOrderCells(state, order)) {
      return { state: completeOrder(state, order.id, now), kind: 'order' };
    }
  }

  // 3. 線索單：bot 已經知道配方，直接請客人先走，空出欄位
  const clue = state.orders.find((order) => order.kind === 'clue');
  if (clue) return { state: dismissOrder(state, clue.id, now), kind: 'dismiss' };

  const { needs, recipes } = collectNeeds(state);

  // 4. 發明：材料都在棋盤上就拖過去
  for (const id of recipes) {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) continue;
    const cells = itemCells(state);
    const from = cells.get(`${recipe.a.chain}:${recipe.a.level}`)?.[0];
    const to = cells.get(`${recipe.b.chain}:${recipe.b.level}`)?.[0];
    if (from !== undefined && to !== undefined) {
      return { state: applyDrop(state, from, to, now), kind: 'invent' };
    }
  }

  const { reserved, unmet } = reserve(state, needs);

  // 5. 合成：只合成還需要往上做的鏈，而且不動已經保留給需求的品項；從高階的先合
  const maxNeed = new Map<ChainId, number>();
  for (const need of unmet) {
    maxNeed.set(need.chain, Math.max(maxNeed.get(need.chain) ?? 0, need.level));
  }
  const cells = itemCells(state);
  let best: [number, number, number] | null = null;
  for (const [key, list] of cells) {
    const [chain, levelText] = key.split(':') as [ChainId, string];
    const level = Number(levelText);
    if (level >= (maxNeed.get(chain) ?? 0) || level >= CHAINS[chain].items.length) continue;
    const free = list.filter((c) => !reserved.has(c));
    if (free.length < 2) continue;
    if (!best || level > best[0]) best = [level, free[0], free[1]];
  }
  if (best) return { state: applyDrop(state, best[1], best[2], now), kind: 'merge' };

  // 6. 產出：還差的需求裡，挑最低階的那條鏈
  const target = [...unmet].sort((a, b) => baseCost(a.level) - baseCost(b.level))[0];
  if (!target) return null;
  const generator = state.board.findIndex(
    (piece) => piece?.kind === 'generator' && piece.chain === target.chain
  );
  if (generator === -1) return null;
  const blocker = getSpawnBlocker(state);
  if (blocker === null) return { state: tapGenerator(state, generator), kind: 'spawn' };
  if (blocker === 'no-energy') return null;

  // 7. 棋盤滿了：賣掉最沒用的一格再繼續（先賣沒保留的低階品項，再賣用不到的發明菜）
  const wantedDishes = new Set(recipes);
  for (const order of state.orders) if (order.recipe) wantedDishes.add(order.recipe);
  let sell: [number, number] | null = null;
  state.board.forEach((piece, index) => {
    if (!piece || piece.kind === 'generator' || reserved.has(index)) return;
    let score: number;
    if (piece.kind === 'item') {
      const useful = piece.level < (maxNeed.get(piece.chain) ?? 0);
      score = (useful ? 100 : 0) + piece.level;
    } else {
      const keep = wantedDishes.has(piece.recipe) || isSignatureCandidate(state, piece.recipe);
      score = keep ? 1000 : 50;
    }
    if (!sell || score < sell[1]) sell = [index, score];
  });
  if (!sell) return null;
  return { state: sellPiece(state, (sell as [number, number])[0]), kind: 'sell' };
}

function isSignatureCandidate(state: GameState, recipe: RecipeId): boolean {
  const def = RECIPES.find((r) => r.id === recipe);
  if (!def) return false;
  return [def.a.chain, def.b.chain].some((chain) => state.stalls[chain].level === 2);
}

function coinsSpentOn(before: GameState, after: GameState): number {
  return Math.max(0, before.coins - after.coins);
}

const ALL_LV3 = (state: GameState) => CHAIN_IDS.every((chain) => state.stalls[chain].level === 3);

/**
 * 從開局玩到 5 攤全部 Lv3（或超過 maxDays）。第一次開啟就是首次啟動，之後依 profile 的時刻開啟。
 */
export function simulateRun(profile: PlayerProfile, seed: number, maxDays = 60): RunResult {
  // 時間從某天 0 點起算，sessionHours 才是當天的時刻；首次啟動固定在第 0 天晚上 7 點
  const dayStart = 0;
  const firstLaunch = dayStart + FIRST_LAUNCH_HOUR * HOUR_MS;
  let state = createGame(firstLaunch, seed);
  const result: RunResult = {
    seed,
    milestones: {},
    sessions: [],
    coinsSpent: 0,
    ordersCompleted: 0,
    finished: false,
  };

  const hit = (milestone: Milestone, day: number) => {
    if (!result.milestones[milestone]) {
      result.milestones[milestone] = { day, session: result.sessions.length + 1 };
    }
  };

  const sessionStarts: number[] = [];
  for (let day = 0; day < maxDays; day++) {
    for (const hour of profile.sessionHours) {
      const at = dayStart + day * DAY_MS + hour * HOUR_MS;
      if (at >= firstLaunch) sessionStarts.push(at);
    }
  }

  for (const start of sessionStarts) {
    const day = Math.floor((start - dayStart) / DAY_MS);
    let now = start;
    let energyOut = false;
    while (now - start < profile.maxSessionMs) {
      const synced = syncAll(state, now);
      const step = nextStep(synced, now);
      if (!step) {
        energyOut = synced.energy < BALANCE.spawnEnergyCost;
        state = synced;
        break;
      }
      const next = advanceTutorial(step.state);
      result.coinsSpent += step.kind === 'spend' ? coinsSpentOn(synced, next) : 0;
      for (const event of next.events) {
        if (event.type === 'order_completed') result.ordersCompleted += 1;
        if (event.type === 'stall_upgraded' && event.level === 2) hit('firstUpgrade', day);
        if (event.type === 'dish_invented' && event.first) hit('firstInvention', day);
        if (event.type === 'stall_reopened') {
          if (event.stall === 'noodle') hit('reopenNoodle', day);
          if (event.stall === 'dumpling') hit('reopenDumpling', day);
          if (event.stall === 'sweet') hit('reopenSweet', day);
        }
      }
      state = { ...next, events: [] };
      if (CHAIN_IDS.every((chain) => state.stalls[chain].level >= 2)) hit('allLv2', day);
      if (RECIPES.every((recipe) => state.inventions[recipe.id]?.discovered))
        hit('allRecipes', day);
      now += profile.actionMs;
      if (ALL_LV3(state)) {
        hit('allLv3', day);
        break;
      }
    }
    result.sessions.push({ durationMs: now - start, energyOut });
    if (ALL_LV3(state)) {
      result.finished = true;
      break;
    }
  }
  return result;
}

/** 由小到大排序後取百分位（最近秩） */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}
