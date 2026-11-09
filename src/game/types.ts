// GameState v2：存檔格式的唯一定義。形狀依 game-architecture.md〈State Management〉。
//
// 取捨（S1.5）：v2 一次定義到 E6 才會用到的欄位（queue、inventions、daily、lastSellout…），
// 換來整個 MVP 只需要一次 v1→v2 遷移。這些欄位在對應的 Epic 實作前只放空值或初始值。
// 只要改到存檔形狀，就必須遞增 SAVE_VERSION、新增 migrations[n]、新增 fixture（見 project-context）。
import type { ChainId } from './content';
import type { GameEvent } from './events';

export const SAVE_VERSION = 2;

// TODO(S3.1): 改成 recipes.ts 匯出的字面量聯集
export type RecipeId = string;

export type ItemPiece = { id: number; kind: 'item'; chain: ChainId; level: number };
export type GeneratorPiece = { id: number; kind: 'generator'; chain: ChainId };
// 發明菜（E3）。形狀先定在這裡；S3.2 會把它加進 Piece，並讓 isValidSaveV2 接受 kind: 'dish'。
// 在那之前驗證器一律拒絕，因為棋盤還畫不了發明菜（載入會在 render 時崩潰）。
// 「接受更多」不需要升版：舊版 App 讀到發明菜只會顯示讀檔失敗、不會覆寫。
export type DishPiece = { id: number; kind: 'dish'; recipe: RecipeId; count: 1 | 2 | 3 };
export type Piece = ItemPiece | GeneratorPiece;

export type Requirement = { chain: ChainId; level: number };

export type OrderKind = 'normal' | 'vip' | 'clue';

export type Order = {
  id: number;
  kind: OrderKind;
  requirements: Requirement[];
  coins: number;
  xp: number;
  energy: number;
  // 貴客單與線索單指定的發明菜（E4）
  recipe?: RecipeId;
  // 線索單離開的時間（E4）
  expiresAt?: number;
};

// 0 代表鐵捲門
export type StallLevel = 0 | 1 | 2 | 3;
export type StallState = { level: StallLevel; signatureDish: RecipeId | null };

export type QueueState = {
  wave: number;
  length: number;
  remaining: number;
  // null 代表人龍進行中；有值代表完售後的冷卻結束時間
  cooldownEndsAt: number | null;
  // 額外人潮的接口，MVP 恆為 0
  bonus: number;
};

export type InventionState = {
  discovered: boolean;
  made: number;
  failures: number;
  clueSeen: boolean;
};

export type MetaState = {
  firstLaunchAt: number;
  tutorialStep: number;
  hintedRecipes: RecipeId[];
};

export type DailyState = {
  // UTC+8 的日期，例如 '2026-11-09'；空字串代表還沒結算過（S6.1 的 syncDaily 會補上）
  dateKey: string;
  adEnergyUsed: number;
  adDoubleUsed: number;
};

export type LastSellout = {
  wave: number;
  coins: number;
  energy: number;
  xp: number;
  doubled: boolean;
};

export type GameState = {
  version: typeof SAVE_VERSION;
  // —— v1 沿用 ——
  board: (Piece | null)[];
  orders: Order[];
  energy: number;
  // 體力回復的計時起點
  energyUpdatedAt: number;
  coins: number;
  level: number;
  xp: number;
  // 解鎖但棋盤已滿、等有空位才放上去的產生器
  pendingGenerators: ChainId[];
  nextId: number;
  rngSeed: number;
  // —— v2 新增 ——
  stalls: Record<ChainId, StallState>;
  queue: QueueState;
  inventions: Partial<Record<RecipeId, InventionState>>;
  meta: MetaState;
  daily: DailyState;
  lastSellout: LastSellout | null;
  // 暫態：本次 apply 產生的事件，store 分派後清空，不寫入存檔
  events: GameEvent[];
};
