// 數值的共用基礎：品項成本與攤位金幣倍率。engine（一般訂單）與 vip（貴客單）都從這裡取，
// 避免兩個模組互相 import。
import { BALANCE } from './content';

/** 製作某階品項需要的基礎品項數，也是數值的基準。 */
export function baseCost(level: number): number {
  return 2 ** (level - 1);
}

/** 攤位等級帶來的訂單金幣倍率：Lv1 ×1.0、Lv2 ×1.1、Lv3 ×1.2（FR15）。 */
export function stallCoinMultiplier(level: number): number {
  // 鐵捲門（0）不會出現在訂單裡；以 Lv1 為下限，避免出現 ×0.9 的負加成
  return 1 + BALANCE.stallOrderBonusPerLevel * (Math.max(level, 1) - 1);
}
