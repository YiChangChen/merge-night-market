// v1 存檔格式（凍結）。只給遷移使用，不得修改：已經存在玩家裝置上的資料就長這樣。
import { BOARD_SIZE, type ChainId } from '../content';

export type ItemPieceV1 = { id: number; kind: 'item'; chain: ChainId; level: number };
export type GeneratorPieceV1 = { id: number; kind: 'generator'; chain: ChainId };

export type OrderV1 = {
  id: number;
  requirements: { chain: ChainId; level: number }[];
  coins: number;
  xp: number;
  energy: number;
};

export type GameStateV1 = {
  version: 1;
  board: (ItemPieceV1 | GeneratorPieceV1 | null)[];
  orders: OrderV1[];
  energy: number;
  energyUpdatedAt: number;
  coins: number;
  level: number;
  xp: number;
  pendingGenerators: ChainId[];
  nextId: number;
  rngSeed: number;
};

/** v1 的驗證規則，與 v1 版本 App 的 isValidSave 相同。 */
export function isValidSaveV1(value: unknown): value is GameStateV1 {
  if (typeof value !== 'object' || value === null) return false;
  const save = value as Partial<GameStateV1>;
  return (
    save.version === 1 &&
    Array.isArray(save.board) &&
    save.board.length === BOARD_SIZE &&
    Array.isArray(save.orders) &&
    Array.isArray(save.pendingGenerators) &&
    [
      save.energy,
      save.energyUpdatedAt,
      save.coins,
      save.level,
      save.xp,
      save.nextId,
      save.rngSeed,
    ].every((field) => typeof field === 'number' && Number.isFinite(field))
  );
}
