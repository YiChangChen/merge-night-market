// 遊戲數值。

export const BALANCE = {
  boardColumns: 7,
  boardRows: 8,
  orderSlots: 3,
  // 體力上限：開幕週（openingWeekMs）內是 openingWeekMaxEnergy，之後是 maxEnergy（FR36，見 daily.ts maxEnergy）
  maxEnergy: 100,
  openingWeekMaxEnergy: 200,
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
  // 卡牌星等（FR34）：made 達到這些份數依序為 ★1–★5；加成以星等為 index（★0、★1 都是 0）
  cardStarThresholds: [1, 3, 6, 10, 15],
  cardStarBonus: [0, 0, 0.1, 0.2, 0.35, 0.5],
  // 線索單（FR29）：貴客判定成立、而且還有未發現的可發明配方時，這個機率改為線索單；10 分鐘後離開
  clueChance: 0.5,
  clueDurationMs: 10 * 60 * 1000,
  // 阿嬤保底（NP-3、FR31）：同一道配方失敗這麼多次後直接說出答案
  hintAfterFailures: 5,
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
  // 激勵廣告（FR37、FR38、NP-4）：補體力每次 +20、每日 5 次；完售加倍每日 3 次。每日以 UTC+8 午夜換日
  adEnergy: 20,
  adEnergyDailyLimit: 5,
  adDoubleDailyLimit: 3,
  // 新手教學的步數；meta.tutorialStep 達到這個值代表教學完成（FR40）
  tutorialSteps: 3,
  // 教學期間建立的一般單金幣倍率（S6.4）：Lv1 每張 25，8 張以內一定存到第一次升級的 200 金幣
  tutorialOrderCoinMultiplier: 2.5,
  // 新手訂單金幣倍率只套用到這個玩家等級（含）；之後就算教學還沒完成也恢復原價（E6 code review）
  tutorialBonusMaxLevel: 2,
} as const;

export const BOARD_SIZE = BALANCE.boardColumns * BALANCE.boardRows;
