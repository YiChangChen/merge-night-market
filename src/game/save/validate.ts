// v2 存檔的驗證。讀檔與匯入存檔都要先通過這裡，失敗時絕不覆寫原檔。
//
// 原則：只接受「目前的引擎與畫面真的處理得了」的資料。型別正確但語意錯誤的資料
// （例如超出範圍的階數、小數 id）一旦載入，會在 render 時崩潰，而且 ErrorBoundary 的重試也救不回來，
// 所以一律在這裡擋下，交給「存檔讀取失敗」畫面處理。
//
// 擴充時機：
// - S3.2 起棋盤支援發明菜，isValidPiece 接受 kind: 'dish'（{ recipe, count: 1–3 }）。
// - S4.1 起接受貴客單（kind: 'vip'、recipe、需求為空）；S4.2 起接受線索單（kind: 'clue'、expiresAt、沒有獎勵）。
// 這兩者都是「接受更多」，舊版 App 讀到新資料只會顯示讀檔失敗、不會覆寫，所以不需要升版。
import {
  BALANCE,
  BOARD_SIZE,
  CHAIN_IDS,
  CHAINS,
  type ChainId,
  RECIPE_IDS,
  RECIPES_BY_ID,
  type RecipeId,
} from '../content';
import { SAVE_VERSION } from '../types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNonNegative = (value: unknown): value is number => isFiniteNumber(value) && value >= 0;
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isNonNegativeInteger = (value: unknown): value is number =>
  isInteger(value) && (value as number) >= 0;
const isPositiveInteger = (value: unknown): value is number =>
  isInteger(value) && (value as number) >= 1;
const isChain = (value: unknown): value is ChainId =>
  typeof value === 'string' && (CHAIN_IDS as readonly string[]).includes(value);
const isItemLevel = (chain: ChainId, level: unknown): boolean =>
  isInteger(level) && (level as number) >= 1 && (level as number) <= CHAINS[chain].items.length;

// 只接受已知的配方 id（S3.1）：未知的 id 在查 RECIPES_BY_ID 時會讓畫面或規則崩潰
const isRecipeId = (value: unknown) =>
  typeof value === 'string' && (RECIPE_IDS as readonly string[]).includes(value);

function isValidPiece(value: unknown): boolean {
  if (value === null) return true;
  if (!isObject(value) || !isPositiveInteger(value.id)) return false;
  switch (value.kind) {
    case 'item':
      return isChain(value.chain) && isItemLevel(value.chain, value.level);
    case 'generator':
      return isChain(value.chain);
    case 'dish':
      return isRecipeId(value.recipe) && [1, 2, 3].includes(value.count as number);
    default:
      // 未知的棋子種類
      return false;
  }
}

function isValidOrder(value: unknown, discovered: ReadonlySet<string>): boolean {
  if (
    !isObject(value) ||
    !isPositiveInteger(value.id) ||
    !Array.isArray(value.requirements) ||
    !isNonNegative(value.coins) ||
    !isNonNegative(value.xp) ||
    !isNonNegative(value.energy)
  ) {
    return false;
  }
  switch (value.kind) {
    case 'normal':
      return (
        value.recipe === undefined &&
        value.expiresAt === undefined &&
        value.requirements.length >= 1 &&
        value.requirements.length <= 2 &&
        value.requirements.every(
          (requirement) =>
            isObject(requirement) &&
            isChain(requirement.chain) &&
            isItemLevel(requirement.chain, requirement.level)
        )
      );
    case 'vip':
      // 貴客單（S4.1）：指定一道已知的發明菜，沒有品項需求；這道菜必須已經發現（不能劇透，E4 code review）
      return (
        isRecipeId(value.recipe) &&
        discovered.has(value.recipe as string) &&
        value.requirements.length === 0 &&
        value.expiresAt === undefined
      );
    case 'clue':
      // 線索單（S4.2）：只說一句台詞，沒有需求、沒有獎勵，有離開時間
      return (
        isRecipeId(value.recipe) &&
        value.requirements.length === 0 &&
        isFiniteNumber(value.expiresAt) &&
        value.coins === 0 &&
        value.xp === 0 &&
        value.energy === 0
      );
    default:
      return false;
  }
}

const isSignatureOf = (value: unknown, chain: ChainId) => {
  if (!isRecipeId(value)) return false;
  const recipe = RECIPES_BY_ID[value as RecipeId];
  return recipe.a.chain === chain || recipe.b.chain === chain;
};

/** 存檔裡已發現的配方 id（inventions 本身的格式由 isValidInventions 另外檢查） */
function discoveredRecipeIds(inventions: unknown): ReadonlySet<string> {
  if (!isObject(inventions)) return new Set();
  return new Set(
    Object.entries(inventions)
      .filter(([, record]) => isObject(record) && record.discovered === true)
      .map(([id]) => id)
  );
}

function isValidStalls(value: unknown): boolean {
  return (
    isObject(value) &&
    // 至少一攤開著，訂單才有地方出（開局的手搖飲、炸物永遠不會關）
    CHAIN_IDS.some((chain) => isObject(value[chain]) && (value[chain] as Json).level !== 0) &&
    CHAIN_IDS.every((chain) => {
      const stall = value[chain];
      return (
        isObject(stall) &&
        (stall.level === 0 || stall.level === 1 || stall.level === 2 || stall.level === 3) &&
        // 招牌菜只屬於 Lv3，而且一定含這一攤的食材（FR13、RC-7）
        (stall.signatureDish === null ||
          (stall.level === 3 && isSignatureOf(stall.signatureDish, chain)))
      );
    })
  );
}

function isValidQueue(value: unknown): boolean {
  return (
    isObject(value) &&
    isPositiveInteger(value.wave) &&
    isNonNegativeInteger(value.length) &&
    isNonNegativeInteger(value.remaining) &&
    (value.remaining as number) <= (value.length as number) &&
    isNonNegativeInteger(value.bonus) &&
    // 人龍長度有上限（queueCapacity），匯入的存檔不能放大完售獎勵（code review 2026-11-10）
    (value.length as number) <= BALANCE.queueMax + (value.bonus as number) &&
    // 冷卻只會在完售後開始，冷卻中不會還有人排隊
    (value.cooldownEndsAt === null ||
      (isFiniteNumber(value.cooldownEndsAt) && value.remaining === 0))
  );
}

function isValidInventions(value: unknown): boolean {
  return (
    isObject(value) &&
    Object.keys(value).every(isRecipeId) &&
    Object.values(value).every(
      (invention) =>
        isObject(invention) &&
        typeof invention.discovered === 'boolean' &&
        isNonNegativeInteger(invention.made) &&
        isNonNegativeInteger(invention.failures) &&
        typeof invention.clueSeen === 'boolean'
    )
  );
}

function isValidMeta(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.firstLaunchAt) &&
    isNonNegativeInteger(value.tutorialStep) &&
    (value.tutorialStep as number) <= BALANCE.tutorialSteps &&
    Array.isArray(value.hintedRecipes) &&
    value.hintedRecipes.every(isRecipeId)
  );
}

function isValidDaily(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.dateKey === 'string' &&
    isNonNegativeInteger(value.adEnergyUsed) &&
    isNonNegativeInteger(value.adDoubleUsed)
  );
}

function isValidLastSellout(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      isPositiveInteger(value.wave) &&
      isNonNegative(value.coins) &&
      isNonNegative(value.energy) &&
      isNonNegative(value.xp) &&
      typeof value.doubled === 'boolean')
  );
}

/** 棋子與訂單的 id 不得重複，而且 nextId 必須大於所有現有 id（新棋子才不會撞號）。 */
function hasConsistentIds(board: Json[], orders: Json[], nextId: number): boolean {
  const ids = [...board.map((piece) => piece.id), ...orders.map((order) => order.id)] as number[];
  return new Set(ids).size === ids.length && ids.every((id) => id < nextId);
}

/** 待放的產生器不得重複，也不得和棋盤上已有的產生器同一條鏈。 */
function hasConsistentGenerators(board: Json[], pending: ChainId[]): boolean {
  const onBoard = board.filter((piece) => piece.kind === 'generator').map((piece) => piece.chain);
  const all = [...onBoard, ...pending];
  return new Set(all).size === all.length;
}

/** 驗證存檔 JSON（不含暫態的 events）是否為目前版本可以安全載入的 v2 存檔。 */
export function isValidSaveV2(value: unknown): boolean {
  if (!isObject(value) || value.version !== SAVE_VERSION) return false;
  const { board, orders, pendingGenerators } = value;
  if (
    !Array.isArray(board) ||
    board.length !== BOARD_SIZE ||
    !board.every(isValidPiece) ||
    !Array.isArray(orders) ||
    !orders.every((order) => isValidOrder(order, discoveredRecipeIds(value.inventions))) ||
    // 同一時間最多 1 張貴客或線索單（FR27）
    orders.filter((order) => isObject(order) && order.kind !== 'normal').length > 1 ||
    !Array.isArray(pendingGenerators) ||
    !pendingGenerators.every(isChain)
  ) {
    return false;
  }
  const pieces = board.filter((piece): piece is Json => piece !== null);
  return (
    isNonNegative(value.energy) &&
    isFiniteNumber(value.energyUpdatedAt) &&
    isNonNegative(value.coins) &&
    isPositiveInteger(value.level) &&
    isNonNegative(value.xp) &&
    isPositiveInteger(value.nextId) &&
    isInteger(value.rngSeed) &&
    hasConsistentIds(pieces, orders as Json[], value.nextId as number) &&
    hasConsistentGenerators(pieces, pendingGenerators) &&
    isValidStalls(value.stalls) &&
    isValidQueue(value.queue) &&
    isValidInventions(value.inventions) &&
    isValidMeta(value.meta) &&
    isValidDaily(value.daily) &&
    isValidLastSellout(value.lastSellout)
  );
}
