// 遊戲數值。

export const BALANCE = {
  boardColumns: 7,
  boardRows: 8,
  orderSlots: 3,
  maxEnergy: 100,
  energyRegenMs: 2 * 60 * 1000,
  spawnEnergyCost: 1,
  // 產生器有這個機率直接產出 2 階品項
  spawnLevel2Chance: 0.15,
  orderCoinsPerBase: 5,
  // 訂單回補的體力，相對於製作該品項所需基礎品項數的比例
  orderEnergyRefund: 0.3,
  levelUpEnergy: 20,
  twoItemOrderMinLevel: 3,
  twoItemOrderChance: 0.4,
} as const;

export const BOARD_SIZE = BALANCE.boardColumns * BALANCE.boardRows;
