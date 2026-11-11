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
  // 攤位每升 1 級，該攤品項的訂單金幣 +10%（FR15）；在訂單建立時鎖定（RC-3）
  stallOrderBonusPerLevel: 0.1,
  // 訂單回補的體力，相對於製作該品項所需基礎品項數的比例
  orderEnergyRefund: 0.3,
  levelUpEnergy: 20,
  twoItemOrderMinLevel: 3,
  twoItemOrderChance: 0.4,
  // 貴客單（FR27、FR28）：機率 = min(base + perStallLevel × (Σ攤位等級 − 2), max)
  vipBaseChance: 0.2,
  vipChancePerStallLevel: 0.02,
  vipMaxChance: 0.4,
  // 金幣 = 5 × 材料 baseCost 總和 × 兩攤加成平均 × 3 × (1 + 卡牌加成)；XP = 材料階數總和 × 2
  vipCoinMultiplier: 3,
  vipXpPerLevel: 2,
  // 人龍長度 = min(queueBase + queuePerStallLevel × Σ攤位等級, queueMax) + 額外人潮（FR17）
  queueBase: 8,
  queuePerStallLevel: 2,
  queueMax: 20,
  // 發明菜賣出價 = 兩個材料的 baseCost 總和 × 1.5（GDD M4）
  dishSellMultiplier: 1.5,
  // 完售後到下一波的冷卻（FR20）
  queueCooldownMs: 3 * 60 * 1000,
  // 完售獎勵：金幣 = 5 × 本波長度、體力 +10、XP + 本波長度（FR19）；不含攤位加成
  selloutCoinsPerCustomer: 5,
  selloutEnergy: 10,
  selloutXpPerCustomer: 1,
  // 開幕週長度：首次啟動後 72 小時（FR36）
  openingWeekMs: 72 * 60 * 60 * 1000,
  // 新手教學的步數；meta.tutorialStep 達到這個值代表教學完成（FR40）
  tutorialSteps: 3,
} as const;

export const BOARD_SIZE = BALANCE.boardColumns * BALANCE.boardRows;
