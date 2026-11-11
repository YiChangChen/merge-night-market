// 純遊戲規則：所有函式都是 (state, ...) => state，不碰 UI、時間來源或儲存。
import {
  BALANCE,
  BOARD_SIZE,
  CHAIN_IDS,
  CHAINS,
  type ChainId,
  CUSTOMERS,
  type CustomerDef,
} from './content';
import { advanceQueue, queueCapacity } from './queue';
import { nextRandom, randomInt } from './random';
import {
  type GameState,
  type ItemPiece,
  type Order,
  type Piece,
  type Requirement,
  SAVE_VERSION,
  type StallState,
} from './types';

// 型別定義在 types.ts；這裡重新匯出，既有的 import 路徑不必修改
export type {
  DishPiece,
  GameState,
  GeneratorPiece,
  ItemPiece,
  Order,
  Piece,
  Requirement,
} from './types';

export type SpawnBlocker = 'no-energy' | 'board-full';

/** 依玩家等級推算攤位狀態：已解鎖的鏈視為已重開的 Lv1，其餘是鐵捲門（FR9、FR46）。 */
export function stallsForPlayerLevel(level: number): Record<ChainId, StallState> {
  const stalls = {} as Record<ChainId, StallState>;
  for (const chain of CHAIN_IDS) {
    stalls[chain] = { level: CHAINS[chain].unlockLevel <= level ? 1 : 0, signatureDish: null };
  }
  return stalls;
}

// 製作某階品項需要的基礎品項數，也是數值的基準
export function baseCost(level: number): number {
  return 2 ** (level - 1);
}

export function xpToNextLevel(level: number): number {
  return 10 + 5 * (level - 1);
}

export function unlockedChains(level: number): ChainId[] {
  return CHAIN_IDS.filter((id) => CHAINS[id].unlockLevel <= level);
}

export function maxOrderItemLevel(playerLevel: number, chain: ChainId): number {
  return Math.min(2 + Math.floor(playerLevel / 2), CHAINS[chain].items.length);
}

export function sellPrice(piece: ItemPiece): number {
  return baseCost(piece.level);
}

function emptyCells(board: (Piece | null)[]): number[] {
  const cells: number[] = [];
  board.forEach((piece, index) => {
    if (!piece) cells.push(index);
  });
  return cells;
}

function placeGenerator(state: GameState, chain: ChainId): GameState {
  const [cell] = emptyCells(state.board);
  if (cell === undefined) {
    return { ...state, pendingGenerators: [...state.pendingGenerators, chain] };
  }
  const board = [...state.board];
  board[cell] = { id: state.nextId, kind: 'generator', chain };
  return { ...state, board, nextId: state.nextId + 1 };
}

/**
 * 確保這條鏈有產生器：棋盤上或待放佇列裡已經有就不動，沒有就放一個（棋盤滿時進待放佇列）。
 * 攤位重開（S1.9 reopenStall）與除錯面板都用它，避免同一條鏈出現兩個產生器。
 */
export function ensureGenerator(state: GameState, chain: ChainId): GameState {
  const onBoard = state.board.some((piece) => piece?.kind === 'generator' && piece.chain === chain);
  if (onBoard || state.pendingGenerators.includes(chain)) return state;
  return placeGenerator(state, chain);
}

/** 棋盤騰出空格後，把待放的產生器放上去（合成、交單、賣出、發明、疊加都要呼叫）。 */
export function flushPendingGenerators(state: GameState): GameState {
  let next: GameState = { ...state, pendingGenerators: [] };
  for (const chain of state.pendingGenerators) {
    next = placeGenerator(next, chain);
  }
  return next;
}

/** 已重開（等級 ≥ 1）的攤位；訂單只從這些鏈產生（RC-2、FR7）。 */
export function openStallChains(stalls: Record<ChainId, StallState>): ChainId[] {
  return CHAIN_IDS.filter((chain) => stalls[chain].level >= 1);
}

/** 攤位等級帶來的訂單金幣倍率：Lv1 ×1.0、Lv2 ×1.1、Lv3 ×1.2（FR15）。 */
function stallCoinMultiplier(level: number): number {
  // 鐵捲門（0）不會出現在訂單裡；以 Lv1 為下限，避免出現 ×0.9 的負加成
  return 1 + BALANCE.stallOrderBonusPerLevel * (Math.max(level, 1) - 1);
}

/** 一般訂單金幣 = Σ 5 × baseCost × 該攤加成（FR8、FR15）。兩品項訂單分別依各自攤位的等級計算。 */
export function orderCoins(
  requirements: readonly Requirement[],
  stalls: Record<ChainId, StallState>
): number {
  return requirements.reduce(
    (sum, r) =>
      sum +
      Math.round(
        BALANCE.orderCoinsPerBase * baseCost(r.level) * stallCoinMultiplier(stalls[r.chain].level)
      ),
    0
  );
}

/**
 * 每張新訂單的期望金幣（數學期望值，對應 createOrder 的抽法）。
 * 用來產出 docs/balance.md 的「各玩家等級每單期望金幣」表，S6.4 用它驗證教學、S7.5 用實測校正。
 */
export function expectedOrderCoins(
  playerLevel: number,
  stalls: Record<ChainId, StallState>
): number {
  const chains = openStallChains(stalls);
  if (chains.length === 0) return 0;
  // 單一品項的期望金幣：鏈均勻抽、階數在 2..maxLevel 均勻抽
  const perRequirement =
    chains.reduce((sum, chain) => {
      const maxLevel = maxOrderItemLevel(playerLevel, chain);
      let chainSum = 0;
      for (let level = 2; level <= maxLevel; level++) {
        chainSum += orderCoins([{ chain, level }], stalls);
      }
      return sum + chainSum / (maxLevel - 1);
    }, 0) / chains.length;
  const expectedCount =
    playerLevel >= BALANCE.twoItemOrderMinLevel ? 1 + BALANCE.twoItemOrderChance : 1;
  return perRequirement * expectedCount;
}

function createOrder(state: GameState): [Order, GameState] {
  let next = state;
  const open = openStallChains(state.stalls);
  // 存檔驗證不保證至少有一攤開著；全關時退回依玩家等級解鎖的鏈，避免抽籤落空
  const chains = open.length > 0 ? open : unlockedChains(state.level);
  const requirements: Requirement[] = [];

  let count = 1;
  if (state.level >= BALANCE.twoItemOrderMinLevel) {
    const [roll, afterRoll] = nextRandom(next);
    next = afterRoll;
    if (roll < BALANCE.twoItemOrderChance) count = 2;
  }

  for (let i = 0; i < count; i++) {
    const [chainIndex, afterChain] = randomInt(next, chains.length);
    const chain = chains[chainIndex];
    const maxLevel = maxOrderItemLevel(state.level, chain);
    // 至少 2 階，訂單才一定需要合成
    const [offset, afterLevel] = randomInt(afterChain, maxLevel - 1);
    next = afterLevel;
    requirements.push({ chain, level: 2 + offset });
  }

  const totalCost = requirements.reduce((sum, r) => sum + baseCost(r.level), 0);
  const order: Order = {
    id: next.nextId,
    kind: 'normal',
    requirements,
    // 建立當下就鎖定，之後攤位升級不回溯（RC-3）
    coins: orderCoins(requirements, state.stalls),
    xp: requirements.reduce((sum, r) => sum + r.level, 0),
    energy: Math.ceil(totalCost * BALANCE.orderEnergyRefund),
  };
  return [order, { ...next, nextId: next.nextId + 1 }];
}

// 客人由訂單 id 決定，不必寫進存檔，同一張訂單移動位置或讀檔後也不會換人
export function customerForOrder(order: Order): CustomerDef {
  return CUSTOMERS[order.id % CUSTOMERS.length];
}

export function createGame(now: number, seed: number): GameState {
  const stalls = stallsForPlayerLevel(1);
  const queue = { wave: 1, length: 0, remaining: 0, cooldownEndsAt: null, bonus: 0 };
  const length = queueCapacity({ stalls, queue });
  let state: GameState = {
    version: SAVE_VERSION,
    board: Array<Piece | null>(BOARD_SIZE).fill(null),
    orders: [],
    energy: BALANCE.maxEnergy,
    energyUpdatedAt: now,
    coins: 0,
    level: 1,
    xp: 0,
    pendingGenerators: [],
    nextId: 1,
    rngSeed: seed,
    stalls,
    queue: { ...queue, length, remaining: length },
    inventions: {},
    meta: { firstLaunchAt: now, tutorialStep: 0, hintedRecipes: [] },
    daily: { dateKey: '', adEnergyUsed: 0, adDoubleUsed: 0 },
    lastSellout: null,
    events: [],
  };
  for (const chain of unlockedChains(1)) {
    state = placeGenerator(state, chain);
  }
  for (let i = 0; i < BALANCE.orderSlots; i++) {
    const [order, next] = createOrder(state);
    state = { ...next, orders: [...next.orders, order] };
  }
  return state;
}

// 依經過時間回復體力。獎勵可超過上限，超過時不再自然回復。
export function syncEnergy(state: GameState, now: number): GameState {
  // 裝置時間被調回去時重設起點，避免之後長時間不回復
  if (now < state.energyUpdatedAt) return { ...state, energyUpdatedAt: now };
  if (state.energy >= BALANCE.maxEnergy) {
    return state.energyUpdatedAt === now ? state : { ...state, energyUpdatedAt: now };
  }
  const gained = Math.floor((now - state.energyUpdatedAt) / BALANCE.energyRegenMs);
  if (gained <= 0) return state;
  const energy = Math.min(BALANCE.maxEnergy, state.energy + gained);
  return {
    ...state,
    energy,
    energyUpdatedAt:
      energy >= BALANCE.maxEnergy ? now : state.energyUpdatedAt + gained * BALANCE.energyRegenMs,
  };
}

export function msUntilNextEnergy(
  state: Pick<GameState, 'energy' | 'energyUpdatedAt'>,
  now: number
): number | null {
  if (state.energy >= BALANCE.maxEnergy) return null;
  return Math.max(0, state.energyUpdatedAt + BALANCE.energyRegenMs - now);
}

export function getSpawnBlocker(state: GameState): SpawnBlocker | null {
  if (emptyCells(state.board).length === 0) return 'board-full';
  if (state.energy < BALANCE.spawnEnergyCost) return 'no-energy';
  return null;
}

function cellDistance(a: number, b: number): number {
  const { boardColumns } = BALANCE;
  return (
    Math.abs((a % boardColumns) - (b % boardColumns)) +
    Math.abs(Math.floor(a / boardColumns) - Math.floor(b / boardColumns))
  );
}

export function tapGenerator(state: GameState, cell: number): GameState {
  const piece = state.board[cell];
  if (piece?.kind !== 'generator' || getSpawnBlocker(state)) return state;

  const target = emptyCells(state.board).reduce((best, candidate) =>
    cellDistance(cell, candidate) < cellDistance(cell, best) ? candidate : best
  );

  const [roll, next] = nextRandom(state);
  const board = [...next.board];
  board[target] = {
    id: next.nextId,
    kind: 'item',
    chain: piece.chain,
    level: roll < BALANCE.spawnLevel2Chance ? 2 : 1,
  };
  return {
    ...next,
    board,
    nextId: next.nextId + 1,
    energy: next.energy - BALANCE.spawnEnergyCost,
  };
}

export type Spawn = { piece: ItemPiece; from: number; to: number };

// 比對前後棋盤，找出由產生器新產出的食材，給 UI 播放動畫。
// 合成、出餐與賣出都會移除棋子，產出不會，所以有棋子消失就不是產出。
export function findSpawns(before: (Piece | null)[], after: (Piece | null)[]): Spawn[] {
  const beforeIds = new Set(before.map((piece) => piece?.id));
  const afterIds = new Set(after.map((piece) => piece?.id));
  if (before.some((piece) => piece && !afterIds.has(piece.id))) return [];

  const spawns: Spawn[] = [];
  after.forEach((piece, to) => {
    if (piece?.kind !== 'item' || beforeIds.has(piece.id)) return;
    // 每條產品線只有一台產生器
    const from = after.findIndex(
      (other) => other?.kind === 'generator' && other.chain === piece.chain
    );
    if (from !== -1) spawns.push({ piece, from, to });
  });
  return spawns;
}

export type Merge = { piece: ItemPiece; cell: number };

// 比對前後棋盤，找出剛合成的品項：新棋子取代了同產品線、低一階的棋子。
// 產出只會落在空格，所以不會被算進來。
export function findMerges(before: (Piece | null)[], after: (Piece | null)[]): Merge[] {
  const beforeIds = new Set(before.map((piece) => piece?.id));
  const merges: Merge[] = [];
  after.forEach((piece, cell) => {
    if (piece?.kind !== 'item' || beforeIds.has(piece.id)) return;
    const replaced = before[cell];
    if (
      replaced?.kind === 'item' &&
      replaced.chain === piece.chain &&
      replaced.level === piece.level - 1
    ) {
      merges.push({ piece, cell });
    }
  });
  return merges;
}

export function canMerge(a: Piece, b: Piece): boolean {
  return (
    a.kind === 'item' &&
    b.kind === 'item' &&
    a.chain === b.chain &&
    a.level === b.level &&
    a.level < CHAINS[a.chain].items.length
  );
}

// 拖曳放下：相同品項合成，空格移動，其他情況交換位置。
// 規則層內部使用（drop.ts 的 move／merge／swap 與測試）；UI 一律呼叫 applyDrop（RC-4）
export function movePiece(state: GameState, from: number, to: number): GameState {
  const source = state.board[from];
  if (!source || from === to || to < 0 || to >= BOARD_SIZE) return state;
  const target = state.board[to];
  const board = [...state.board];

  if (target?.kind === 'item' && canMerge(source, target)) {
    board[from] = null;
    board[to] = { id: state.nextId, kind: 'item', chain: target.chain, level: target.level + 1 };
    return flushPendingGenerators({ ...state, board, nextId: state.nextId + 1 });
  }

  board[from] = target;
  board[to] = source;
  return { ...state, board };
}

// 為訂單找到要交出的格子；品項不夠時回傳 null
export function findOrderCells(state: Pick<GameState, 'board'>, order: Order): number[] | null {
  const used = new Set<number>();
  for (const requirement of order.requirements) {
    const cell = state.board.findIndex(
      (piece, index) =>
        !used.has(index) &&
        piece?.kind === 'item' &&
        piece.chain === requirement.chain &&
        piece.level === requirement.level
    );
    if (cell === -1) return null;
    used.add(cell);
  }
  return [...used];
}

function applyLevelUps(state: GameState): GameState {
  let next = state;
  while (next.xp >= xpToNextLevel(next.level)) {
    const level = next.level + 1;
    next = {
      ...next,
      xp: next.xp - xpToNextLevel(next.level),
      level,
      energy: next.energy + BALANCE.levelUpEnergy,
    };
    // 產生器不再隨玩家等級出現，只在攤位重開時放上棋盤（RC-1、FR11，見 S1.9 reopenStall）
  }
  return next;
}

/**
 * 交出訂單：扣品項、發放訂單獎勵，人龍 −1（剛好清空時完售，見 queue.ts advanceQueue），
 * 再結算升級並補一張新訂單。事件順序固定為 order_completed → queue_sold_out，
 * 完售演出才會接在出單之後（S2.4）。
 */
export function completeOrder(state: GameState, orderId: number, now: number): GameState {
  const orderIndex = state.orders.findIndex((order) => order.id === orderId);
  if (orderIndex === -1) return state;
  const order = state.orders[orderIndex];
  const cells = findOrderCells(state, order);
  if (!cells) return state;

  const board = [...state.board];
  for (const cell of cells) board[cell] = null;

  let next: GameState = {
    ...state,
    board,
    coins: state.coins + order.coins,
    xp: state.xp + order.xp,
    energy: state.energy + order.energy,
    events: [...state.events, { type: 'order_completed', kind: order.kind, coins: order.coins }],
  };
  next = advanceQueue(next, now);
  next = flushPendingGenerators(next);
  next = applyLevelUps(next);

  const [replacement, afterOrder] = createOrder(next);
  // 右邊的訂單往左遞補，新訂單排到最後
  const orders = [...afterOrder.orders];
  orders.splice(orderIndex, 1);
  orders.push(replacement);
  return { ...afterOrder, orders };
}

// 賣掉品項騰出空間，避免棋盤塞滿無法合成時卡死。產生器不能賣。
export function sellPiece(state: GameState, cell: number): GameState {
  const piece = state.board[cell];
  if (piece?.kind !== 'item') return state;
  const board = [...state.board];
  board[cell] = null;
  return flushPendingGenerators({ ...state, board, coins: state.coins + sellPrice(piece) });
}
