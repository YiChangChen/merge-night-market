---
baseline_commit: a066964
---

# Story 4.1: 貴客單規則

Status: done

## Story

As a 玩家,
I want 發現第一道發明菜之後，偶爾有貴客上門指定要發明菜，給我三倍的錢,
so that 做出來的發明菜有一個高價的去處。

## Acceptance Criteria

1. `src/game/vip.ts`，`createOrder` 在建立新訂單時呼叫 `rollVip(state)`。已發現的發明菜至少 1 道、而且目前沒有貴客單或線索單時，以 `min(20% + 2% × (Σ攤位等級 − 2), 40%)` 的機率改為貴客單（`kind: 'vip'`、`recipe`），使用 seeded RNG（FR27）。
2. 貴客單隨機指定 1 道已發現的發明菜。金幣 = 5 × 材料 baseCost 總和 × 兩攤等級加成的平均 × 3 × (1 + `cardBonus(state, recipe)`)；XP = 材料階數總和 × 2；`cardBonus` 在本 Epic 一律回傳 0，E5 再接上（FR28）。
3. 交付貴客單時，從棋盤任一格扣 1 份該發明菜（RC-8），人龍 −1，並 push `order_completed { kind: 'vip' }`。
4. 同一時間最多只有 1 張貴客或線索單。
5. `vip-test.ts` 涵蓋：尚未發現任何發明菜時不會出現貴客單、機率上限 40%、同時最多 1 張、金幣公式、交付時扣 1 份、固定 seed 下結果可重現。

## Tasks / Subtasks

- [x] T1 測試先行：`src/game/__tests__/vip-test.ts`（AC1–AC5）
- [x] T2 `src/game/pricing.ts`：把 `baseCost`、攤位金幣倍率搬到這裡，engine 與 vip 都從這裡取，避免 engine ↔ vip 互相 import（engine 仍然重新匯出 `baseCost`）
- [x] T3 `src/game/cards.ts`：`cardBonus(state, recipe)` 回傳 0（E5 接上星等）
- [x] T4 `vip.ts`：`vipChance(stalls)`、`hasSpecialOrder(orders)`、`vipOrder(...)`、`rollVip(state)`；`BALANCE` 加上貴客數值（AC1、AC2、AC4）
- [x] T5 engine：`createOrder` 先 `rollVip`；`completeOrder` 先把完成的訂單移出再補新訂單（否則剛交的貴客單還算在場上，下一張永遠不會是貴客）；`findOrderCells` 支援貴客單（找放著該發明菜的格子）；交付時扣 1 份發明菜（`consumeDish`，和 S3.5 的 Lv3 升級共用）（AC3）
- [x] T6 存檔驗證接受貴客單（已知配方、需求為空、沒有 `expiresAt`），而且全部訂單裡最多 1 張貴客或線索單
- [x] T7 最小 UI（E3 retro A3）：貴客單沒有品項需求，棋盤畫面的訂單標籤改顯示「貴客：{菜名}」，不會變成空白；正式的貴客卡在 S4.3
- [x] T8 驗證：lint、tsc、jest、iOS 打包
- [x] T9 **（使用者）** 實機：發明一道菜後多出幾單，偶爾出現「貴客：…」，有那道菜時可以出餐、金幣約為三倍

## Dev Notes

### 數值

- 機率：`min(0.20 + 0.02 × (Σ全部攤位等級 − 2), 0.40)`。新局 Σ = 2（tea、fried 各 Lv1）→ 20%；Σ = 12 時到頂 40%。
- 金幣：`round(5 × (baseCost(a) + baseCost(b)) × avg(倍率a, 倍率b) × 3 × (1 + cardBonus))`。倍率沿用一般訂單（Lv1 ×1.0、Lv2 ×1.1、Lv3 ×1.2，鐵捲門以 Lv1 計）。例：紅茶鹽酥雞套餐、兩攤 Lv2 → 5 × 8 × 1.1 × 3 = 132。
- XP：`(a.level + b.level) × 2`。
- **體力（spec 沒寫，這裡的決定）**：和一般訂單同一個公式，`ceil((baseCost(a) + baseCost(b)) × 0.3)`。貴客單的價值已經在金幣上，體力不另外加倍。
- 數值放 `BALANCE`：`vipBaseChance`、`vipChancePerStallLevel`、`vipMaxChance`、`vipCoinMultiplier`、`vipXpPerLevel`。

### 規則細節

- **RNG**：符合資格時一定擲一次（用來決定要不要變成貴客），變成貴客時再擲一次挑配方；不符合資格時不擲，一般訂單的亂數序列不受影響（既有測試與 seed 結果不變）。
- **已發現的配方**：`inventions[r].discovered === true`，依 RECIPES 順序。
- **最多 1 張**：`kind !== 'normal'` 的訂單（貴客或線索）存在時不擲。`completeOrder` 必須先把剛完成的訂單移出，再建立新訂單。
- **交付**：`findOrderCells` 對貴客單回傳第一個放著該發明菜的格子；交付時用 `consumeDish`（count − 1，扣到 0 清空並放上待放產生器），不是把整格清掉。其餘流程（獎勵、人龍、升級、補新訂單、事件）和一般訂單相同。
- **訂單金幣在建立時鎖定**（RC-3），之後升級不回溯。

### 跨 story 的界線（E3 retro A3）

S4.1 一上線，遊戲裡就會真的出現貴客單。貴客單的 `requirements` 是空陣列，棋盤畫面的標籤會變成空字串，所以這裡要做最小 UI：標籤顯示「貴客：{菜名}」。貴客頭像（富豪、藝人、YouTuber）、發明菜放在托盤上、特別的卡片樣式，都在 S4.3。

### 要修改的檔案

| 檔案 | 現在 | 改成 |
|---|---|---|
| `engine.ts` | `createOrder` 只做一般訂單；`completeOrder` 補單時完成的訂單還在 `orders` 裡；`findOrderCells` 只找品項 | 先擲貴客；先移出再補單；支援貴客單；`consumeDish` |
| `stalls.ts` | 私有的 `takeOneDish` | 改用 engine 的 `consumeDish` |
| `save/validate.ts` | 只接受 `kind: 'normal'` | 接受貴客單、最多 1 張特殊訂單 |
| `(tabs)/index.tsx` | 標籤用 `requirements` 組品名 | 貴客單顯示菜名 |

### Project Context Rules

- 規則層純 TS；亂數一律用 `random.ts` 的 seeded RNG。
- 衍生值不存（貴客機率即時計算）。
- 獎勵只在規則層增加。
- 測試用固定 NOW 與 seed；規則層不 mock。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: 貴客單規則]（FR27、FR28、RC-8）
- [Source: _bmad-output/game-architecture.md]（`vip.ts`、RC-3、RC-8、衍生值不存）
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-11-11.md]（交單只認品項、A3、A5）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`vip.ts` 不存在。
- 「交完一般訂單後可能出現貴客單」一開始存檔驗證失敗：驗證器還只接受一般訂單（T6 補上後通過）。
- **反向驗證（E3 retro A4）**：暫時拿掉 `hasSpecialOrder` 檢查，「同時最多 1 張」的測試**仍然通過**。原因是 seed 1 剛好擲到「不是貴客」，測試靠運氣通過。改成 200 個 seed 逐一檢查後，拿掉這個檢查會失敗 1 個測試，拿掉「已發現才擲」的檢查會失敗 2 個測試，還原後全部通過。

### Completion Notes List

- `pricing.ts`：`baseCost`、`stallCoinMultiplier` 搬過來，engine 與 vip 都從這裡取（engine 仍重新匯出 `baseCost`，既有 import 不變）。
- `cards.ts`：`cardBonus` 回傳 0，E5 接上星等。
- `vip.ts`：`vipChance`（20% + 2% × (Σ等級 − 2)，上限 40%）、`hasSpecialOrder`、`vipOrder`（金幣、XP、體力在建立時鎖定）、`rollVip`（符合資格才擲，不符合時不消耗亂數，一般訂單的亂數序列與既有測試結果不變）。
- 體力（spec 沒寫的決定）：和一般訂單同一個公式，`ceil(材料成本 × 0.3)`。
- engine：`createOrder` 先擲貴客；`completeOrder` 先把完成的訂單移出再補新訂單（否則剛交的貴客單會擋住下一張貴客）；`findOrderCells` 對貴客單回傳放著那道菜的格子、對線索單回傳 null；新增 `consumeDish`，貴客單交付與 Lv3 升級共用（取代 stalls.ts 的私有函式）。
- 存檔驗證：接受貴客單（已知配方、需求為空、沒有 `expiresAt`），全部訂單最多 1 張貴客或線索單。
- 最小 UI（E3 retro A3）：訂單標籤顯示「貴客：{菜名}」；可以出餐的判斷自動支援（`findOrderCells`）。貴客頭像與卡片樣式在 S4.3。
- 驗證：lint 0、tsc 0、jest 455 通過（新增 vip-test 10 個、migration-test 淨增 3 個）、iOS 打包成功。
- T9：使用者實機確認通過（2026-11-11）。

### File List

- `src/game/vip.ts`、`src/game/pricing.ts`、`src/game/cards.ts`（新增）
- `src/game/__tests__/vip-test.ts`（新增）
- `src/game/engine.ts`、`src/game/stalls.ts`、`src/game/content/balance.ts`、`src/game/save/validate.ts`（修改）
- `src/game/save/__tests__/migration-test.ts`（修改）
- `src/app/(tabs)/index.tsx`（修改：貴客單標籤）

## Change Log

- 2026-11-11：貴客單規則；狀態改為 review。

### Review Findings（code review 2026-11-11，範圍 a066964..8fa0d1d）

- [x] [Review][Decision] （三層都抓到）貴客單沒有期限也不能請走，做不出來時永遠佔住欄位，也讓線索單不再出現 → 使用者決定：貴客單也可以請走，貴客只指定已發現而且兩攤目前都 ≥ Lv2 的菜（已套用，RC-9 同步）
- [x] [Review][Patch] 存檔驗證：貴客單的配方必須已經發現（匯入的存檔不能劇透） [src/game/save/validate.ts]
- [x] [Review][Patch] 貴客卡隱藏了體力獎勵，改成和一般單一樣顯示 🪙 ⚡ [src/features/orders/order-card.tsx]
