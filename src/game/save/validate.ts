// v2 存檔的驗證。讀檔與匯入存檔都要先通過這裡，失敗時絕不覆寫原檔。
//
// 原則：只接受「目前的引擎與畫面真的處理得了」的資料。型別正確但語意錯誤的資料
// （例如超出範圍的階數、小數 id）一旦載入，會在 render 時崩潰，而且 ErrorBoundary 的重試也救不回來，
// 所以一律在這裡擋下，交給「存檔讀取失敗」畫面處理。
//
// 擴充時機：
// - S3.2 讓棋盤支援發明菜時，在 isValidPiece 接受 kind: 'dish'（{ recipe, count: 1–3 }）。
// - E4 支援貴客單與線索單時，在 isValidOrder 接受 kind: 'vip' | 'clue'（含 recipe、expiresAt）。
// 這兩者都是「接受更多」，舊版 App 讀到新資料只會顯示讀檔失敗、不會覆寫，所以不需要升版。
import { BALANCE, BOARD_SIZE, CHAIN_IDS, CHAINS, type ChainId } from '../content';
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

function isValidPiece(value: unknown): boolean {
  if (value === null) return true;
  if (!isObject(value) || !isPositiveInteger(value.id)) return false;
  switch (value.kind) {
    case 'item':
      return isChain(value.chain) && isItemLevel(value.chain, value.level);
    case 'generator':
      return isChain(value.chain);
    default:
      // 包含 'dish'：S3.2 之前棋盤還畫不了發明菜
      return false;
  }
}

function isValidOrder(value: unknown): boolean {
  return (
    isObject(value) &&
    isPositiveInteger(value.id) &&
    // 'vip' | 'clue' 要到 E4 才支援
    value.kind === 'normal' &&
    value.recipe === undefined &&
    value.expiresAt === undefined &&
    Array.isArray(value.requirements) &&
    value.requirements.length >= 1 &&
    value.requirements.length <= 2 &&
    value.requirements.every(
      (requirement) =>
        isObject(requirement) &&
        isChain(requirement.chain) &&
        isItemLevel(requirement.chain, requirement.level)
    ) &&
    isNonNegative(value.coins) &&
    isNonNegative(value.xp) &&
    isNonNegative(value.energy)
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
        (stall.signatureDish === null || typeof stall.signatureDish === 'string')
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
    (value.cooldownEndsAt === null || isFiniteNumber(value.cooldownEndsAt))
  );
}

function isValidInventions(value: unknown): boolean {
  return (
    isObject(value) &&
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
    value.hintedRecipes.every((recipe) => typeof recipe === 'string')
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
    !orders.every(isValidOrder) ||
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
