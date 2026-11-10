---
baseline_commit: 194119f
---

# Story 1.6: 產生器與訂單改由攤位控制

Status: done

## Story

As a 玩家,
I want 棋盤上的產生器和訂單只來自已經開張的攤位，而且攤位越高級，訂單給的錢越多,
So that 攤位的狀態和棋盤上的玩法是連動的。

## Acceptance Criteria

1. 玩家升級時 `applyLevelUps` 不再自動放上產生器（RC-1、FR11），體力 +20 照常發放。
2. `createOrder` 只從 `stalls[c].level ≥ 1` 的鏈抽選（RC-2、FR7）。
3. 一般訂單金幣 = 5 × 材料 baseCost 總和 × (1 + 0.1 × (攤位等級 − 1))，建立時鎖定，之後升級攤位不回溯（RC-3）；兩品項訂單分別以各自攤位的等級計算。
4. `completeOrder` 簽名改為 `(state, orderId, now)`，並 push `order_completed` 事件。
5. `engine-test.ts` 更新：升級不放產生器、鐵捲門攤位的鏈不出現在訂單、加成數值正確。
6. 新局只有 tea、fried 兩個產生器，訂單也只出現這兩條鏈。
7. （Sprint Change Proposal 新增）規則層提供 `expectedOrderCoins(playerLevel, stalls)`；`docs/balance.md` 列出 Lv1～Lv10、開局攤位狀態下的「各玩家等級每單期望金幣」表（由測試或腳本產生）。

## Tasks / Subtasks

- [x] T1 測試先行：更新 `engine-test.ts`、新增 `stall-orders-test.ts`，確認紅燈
- [x] T2 `applyLevelUps` 移除依等級放產生器（AC1）
- [x] T3 `openStallChains`、`orderCoins`、`createOrder` 改用攤位（AC2、AC3、AC6）
- [x] T4 `completeOrder(state, orderId, now)` 與 `order_completed` 事件；呼叫端更新（AC4）
- [x] T5 `expectedOrderCoins` 與 `docs/balance.md`，加上文件同步測試（AC7）
- [x] T6 驗證：lint、tsc、jest

## Dev Agent Record

### Implementation Plan

- **金幣公式**：`orderCoins(requirements, stalls)` 對每個需求計算 `round(5 × baseCost × (1 + 0.1 × (攤位等級 − 1)))` 再加總。用 `Math.round` 避免 `10 × 1.1 = 11.000000000000002` 這種浮點誤差。倍率常數 `stallOrderBonusPerLevel: 0.1` 放在 `balance.ts`。
- **鎖定時機**：`createOrder` 建立訂單時，用當下的 `state.stalls` 算好 `coins` 並寫進訂單，之後不再重算（RC-3）。
- **防呆**：攤位全部都是鐵捲門時（存檔驗證不保證至少開一攤），退回依玩家等級解鎖的鏈，避免抽籤落空。
- **期望值**：`expectedOrderCoins` 依 `createOrder` 的抽法計算數學期望值：鏈均勻抽、階數 2..maxLevel 均勻抽，Lv3 起品項數期望 1.4。用 3000 次抽樣驗證，誤差在 5% 以內。
- **文件同步**：`balance-doc-test.ts` 從規則層算出表格，和 `docs/balance.md` 標記之間的內容比對；執行 `UPDATE_BALANCE_DOC=1` 時會重新寫入文件。

### Debug Log

- engine-test 是 CRLF 換行，第一次用腳本做多行替換時沒有比對到；腳本在寫入前就停了，檔案沒被改動。統一換行後重做。
- `balance-doc-test` 第一版用 `import * as fs`，tsc 報錯，因為 tsconfig 只載入 jest 的型別。新增 `@types/node` 需要使用者同意，所以改用 `jest.requireActual` 搭配最小型別宣告，沒有新增依賴。
- 反向驗證：把 `orderCoinsPerBase` 暫時改成 6，`balance-doc-test` 失敗；還原後通過。

### Completion Notes

- AC1：`applyLevelUps` 只加 XP 和體力；engine-test 驗證升到 Lv3 後，棋盤上沒有麵線產生器，`pendingGenerators` 也是空的。
- AC2、AC6：
  - engine-test 驗證 Lv1–30 的大量訂單只出自 `stalls.level ≥ 1` 的鏈。
  - `stall-orders-test` 驗證重開麵線攤之後，麵線會出現在訂單裡，而蒸籠、甜品不會。
  - 新局只有 tea、fried 的產生器和訂單。
- AC3：`orderCoins` 的測試涵蓋：
  - Lv1 沒有加成；Lv2 = 11、Lv3 = 48（4 階 40 × 1.2）。
  - 兩品項訂單分別計算（32）。
  - 建立後攤位升級，金幣不變。
  - 連續 30 張新訂單的金幣都等於建立當下的公式結果。
- AC4：`completeOrder(state, orderId, _now)`。`now` 目前還沒用到，S2.1 的人龍會用到。交單成功時 push `{ type: 'order_completed', kind, coins }`，失敗時回傳原 state、不送事件。`GameEvent` 的 `order_completed.kind` 改成 `OrderKind`。
- AC5：engine-test 更新了 4 個既有測試，`completeOrder` 的 6 處呼叫都補上 `NOW`。
- AC7：`expectedOrderCoins` 加上 `docs/balance.md` 的表格（Lv1–Lv10，兩個欄位），由同步測試守住。
- **平衡上的發現（已寫進 docs/balance.md，不改數值）**：
  - 新手每單期望金幣：Lv1 是 10、Lv2 是 15、Lv3 是 21。存到第一次升級需要的 200 金幣，大約要 13–15 張訂單，S6.4 要求的「8 張以內」達不到，要在 S6.4 處理。
  - 重開攤位本身不會提高每單期望金幣，因為金幣只看階數。重開的價值在升級加成、人龍和發明菜。
- **過渡期的玩法變化**：S1.9（重開攤位）完成之前，新玩家升級時拿不到新的產生器，所以只能玩 tea 和 fried。這是 Epic 1 預期的順序；v1 遷移的玩家原本就有的產生器都保留。
- **測試**：新增 `stall-orders-test.ts`（12 個）和 `balance-doc-test.ts`（1 個），共 155 個測試通過；lint 和 tsc 也通過。

## File List

- src/game/engine.ts（修改：openStallChains、orderCoins、expectedOrderCoins、createOrder、applyLevelUps、completeOrder）
- src/game/content/balance.ts（修改：stallOrderBonusPerLevel）
- src/game/events.ts（修改：order_completed.kind 改用 OrderKind）
- src/app/index.tsx（修改：completeOrder 傳入 Date.now()）
- src/game/__tests__/engine-test.ts（修改）
- src/game/__tests__/stall-orders-test.ts（新增）
- src/game/__tests__/balance-doc-test.ts（新增）
- docs/balance.md（新增）
- _bmad-output/implementation-artifacts/1-6-stall-driven-generators-and-orders.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：完成 Story 1.6：產生器與訂單改由攤位控制、攤位金幣加成、order_completed 事件、期望金幣表。狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 194119f..main）

- [x] [Review][Patch] 攤位等級 0 時，`stallCoinMultiplier` 會變成 ×0.9；所有攤位都關閉時，`createOrder` 退回依玩家等級解鎖的鏈，但 `expectedOrderCoins` 卻回傳 0，兩邊不一致。倍率改成以 Lv1 為下限；存檔驗證要求至少有一攤開著，讓這個退回路徑實際上不可能發生 [src/game/engine.ts]
