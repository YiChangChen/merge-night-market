// v2 存檔的結構驗證。讀檔與匯入存檔都要先通過這裡，失敗時絕不覆寫原檔。
import { BOARD_SIZE, CHAIN_IDS, CHAINS, type ChainId } from '../content';
import { SAVE_VERSION } from '../types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isChain = (value: unknown): value is ChainId =>
  typeof value === 'string' && (CHAIN_IDS as readonly string[]).includes(value);

function isValidPiece(value: unknown): boolean {
  if (value === null) return true;
  if (!isObject(value) || !isNumber(value.id)) return false;
  switch (value.kind) {
    case 'item':
      return (
        isChain(value.chain) &&
        isInteger(value.level) &&
        (value.level as number) >= 1 &&
        (value.level as number) <= CHAINS[value.chain].items.length
      );
    case 'generator':
      return isChain(value.chain);
    case 'dish':
      // 發明菜（E3）：格式在 v2 就已經保留
      return (
        typeof value.recipe === 'string' &&
        (value.count === 1 || value.count === 2 || value.count === 3)
      );
    default:
      return false;
  }
}

function isValidOrder(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    (value.kind === 'normal' || value.kind === 'vip' || value.kind === 'clue') &&
    Array.isArray(value.requirements) &&
    value.requirements.every(
      (requirement) =>
        isObject(requirement) && isChain(requirement.chain) && isInteger(requirement.level)
    ) &&
    isNumber(value.coins) &&
    isNumber(value.xp) &&
    isNumber(value.energy) &&
    (value.recipe === undefined || typeof value.recipe === 'string') &&
    (value.expiresAt === undefined || isNumber(value.expiresAt))
  );
}

function isValidStalls(value: unknown): boolean {
  return (
    isObject(value) &&
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
    isInteger(value.wave) &&
    isInteger(value.length) &&
    isInteger(value.remaining) &&
    isInteger(value.bonus) &&
    (value.cooldownEndsAt === null || isNumber(value.cooldownEndsAt))
  );
}

function isValidInventions(value: unknown): boolean {
  return (
    isObject(value) &&
    Object.values(value).every(
      (invention) =>
        isObject(invention) &&
        typeof invention.discovered === 'boolean' &&
        isInteger(invention.made) &&
        isInteger(invention.failures) &&
        typeof invention.clueSeen === 'boolean'
    )
  );
}

function isValidMeta(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.firstLaunchAt) &&
    isInteger(value.tutorialStep) &&
    Array.isArray(value.hintedRecipes) &&
    value.hintedRecipes.every((recipe) => typeof recipe === 'string')
  );
}

function isValidDaily(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.dateKey === 'string' &&
    isInteger(value.adEnergyUsed) &&
    isInteger(value.adDoubleUsed)
  );
}

function isValidLastSellout(value: unknown): boolean {
  return (
    value === null ||
    (isObject(value) &&
      isInteger(value.wave) &&
      isNumber(value.coins) &&
      isNumber(value.energy) &&
      isNumber(value.xp) &&
      typeof value.doubled === 'boolean')
  );
}

/** 驗證存檔 JSON（不含暫態的 events）是否為合法的 v2 存檔。 */
export function isValidSaveV2(value: unknown): boolean {
  if (!isObject(value) || value.version !== SAVE_VERSION) return false;
  return (
    Array.isArray(value.board) &&
    value.board.length === BOARD_SIZE &&
    value.board.every(isValidPiece) &&
    Array.isArray(value.orders) &&
    value.orders.every(isValidOrder) &&
    [
      value.energy,
      value.energyUpdatedAt,
      value.coins,
      value.level,
      value.xp,
      value.nextId,
      value.rngSeed,
    ].every(isNumber) &&
    Array.isArray(value.pendingGenerators) &&
    value.pendingGenerators.every(isChain) &&
    isValidStalls(value.stalls) &&
    isValidQueue(value.queue) &&
    isValidInventions(value.inventions) &&
    isValidMeta(value.meta) &&
    isValidDaily(value.daily) &&
    isValidLastSellout(value.lastSellout)
  );
}
