---
baseline_commit: 55e1f8b
---

# Story 4.3: 貴客與線索的訂單卡

Status: review

## Story

As a 玩家,
I want 貴客單和線索單在訂單列上一眼就跟一般單分得出來,
so that 我知道哪張值得留發明菜，哪張只是在給提示。

## Acceptance Criteria

1. `src/features/orders/` 的訂單列出現貴客單時，卡片用貴客客人（富豪、藝人、YouTuber 其中一位），有醒目的外框，顯示指定的發明菜和高價金幣；棋盤上有這道菜時，「出餐」按鈕可以按。
2. 線索單用對話框顯示線索台詞，附上剩餘時間倒數和「請客人先走」按鈕（≥ 44 pt）。
3. 一般單的外觀和行為保持不變。
4. 客人由訂單 id 決定，讀檔後不會換人（沿用 `customerForOrder` 的做法，貴客改從 3 位貴客中挑選）。

## Tasks / Subtasks

- [x] T1 內容：`VIP_CUSTOMERS`（富豪、藝人、YouTuber，沿用現有美術）；`customerForOrder` 對貴客單改從這 3 位挑（`id % 3`），一般單與線索單照舊（AC4）
- [x] T2 `features/orders/order-card.tsx`：一張訂單卡，依 `kind` 分三種；`ORDER_LABEL_HEIGHT` 搬到這裡匯出，棋盤畫面的版面計算沿用（AC1–AC3）
  - [x] 一般單：和現在完全相同（客人、托盤上的品項、品名、獎勵／「點我出餐！」）
  - [x] 貴客單：金色外框與「貴客」徽章；托盤上放指定的發明菜；標籤「菜名」＋「🪙金幣」；有那道菜時變成「點我出餐！」
  - [x] 線索單：客人頭上的白色對話框顯示台詞；標籤區是「請客人先走」按鈕（觸控區 ≥ 44 pt），上方顯示剩餘時間 m:ss（只有線索卡掛每秒計時器，時間加上除錯快轉偏移量）
- [x] T3 `CustomerTray` 支援在托盤上放發明菜（`dish` prop）
- [x] T4 棋盤畫面改用 `OrderCard`；「請客人先走」呼叫 `apply((s, now) => dismissOrder(s, id, now))`
- [x] T5 元件測試：三種卡片的內容、貴客出餐、線索倒數與請走、讀檔後客人不變（AC1–AC4）
- [x] T6 驗證：lint、tsc、jest、iOS 打包
- [x] T7 **（使用者）** 實機：貴客卡、線索卡（倒數、請走）、一般卡沒變

## Dev Notes

- **現況**：訂單列寫在 `(tabs)/index.tsx` 的 `Orders`，卡片內容直接寫在裡面；S4.1、S4.2 只在標籤上加了「貴客：菜名」與線索台詞（最小 UI）。這個 story 把卡片抽成 `OrderCard`，`Orders` 只保留排列與進出場動畫（`FadeInRight`、`ZoomOut`、`LinearTransition` 不動）。
- **版面**：卡片高度不能變（棋盤高度依 `artSize.height + ORDER_LABEL_HEIGHT` 推算，E1 的教訓）。對話框疊在客人圖的上半部（絕對定位）；「請客人先走」的視覺高度是標籤高度 40 pt，用 `hitSlop` 讓觸控區到 48 pt。
- **客人**：一般單的客人池（12 位，含富豪等 3 位）不改，否則既有存檔的一般單會換人。貴客單用 `VIP_CUSTOMERS[id % 3]`。
- **倒數**：沿用 HUD／計量條的寫法（`useState(Date.now())` ＋ 1 秒 `setInterval` ＋ `timeOffsetMs`），只在線索卡裡掛。到期移除由規則層（`syncOrders` ＋ `needsTick`）負責，畫面不自己移除。
- **E3 retro A5**：卡片的狀態一律跟著 `order.id`（React key），不用位置。

### Project Context Rules

- 元件只用 selector 訂閱切片；寫入只能透過 `apply`。
- 熱路徑不 `setState`：倒數計時器只在線索卡掛。
- 觸控目標 ≥ 44 pt。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: 貴客與線索的訂單卡]
- [Source: _bmad-output/implementation-artifacts/4-1-vip-order-rules.md]、[4-2-clue-orders-and-dismiss.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- RNTL：同一個測試裡 render 兩次，`screen` 只指向最後一次，拆成兩個測試。

### Completion Notes List

- 內容：`VIP_CUSTOMERS`（富豪、藝人、YouTuber，沿用現有美術）。`customerForOrder` 對貴客單用 `VIP_CUSTOMERS[id % 3]`；一般單與線索單的 12 位客人池不變，既有存檔的一般單不會換人。
- `OrderCard`（`features/orders/order-card.tsx`）：
  - 一般單：和原本相同（客人、托盤上的品項、品名、獎勵或「點我出餐！」）。
  - 貴客單：金色外框與左上角「貴客」徽章，托盤上放指定的發明菜，標籤是菜名與「🪙金幣」（深金底），有那道菜時變成「點我出餐！」。
  - 線索單：客人頭上的白色對話框顯示台詞（最多 3 行）與「⏳ m:ss」倒數；標籤區換成深藍色的「請客人先走」按鈕，視覺高度 40 pt，加上下 hitSlop 4 共 48 pt。倒數只在線索卡掛計時器，時間含除錯快轉；到期移除仍由規則層處理。
- `CustomerTray` 支援 `dish`；`ORDER_LABEL_HEIGHT` 搬到 orders feature 匯出，棋盤高度的計算不變。
- 棋盤畫面：`Orders` 只保留排列與進出場動畫，卡片交給 `OrderCard`；「請客人先走」呼叫 `apply((s, now) => dismissOrder(s, id, now))`。
- 驗證：lint 0、tsc 0、jest 475 通過（新增 order-card-test 6 個、engine-test 1 個）、iOS 打包成功。
- T7：使用者實機確認通過（2026-11-11）。

### File List

- `src/features/orders/order-card.tsx`、`src/features/orders/__tests__/order-card-test.tsx`（新增）
- `src/features/orders/customer-tray.tsx`、`src/features/orders/index.ts`（修改）
- `src/game/content/customers.ts`、`src/game/engine.ts`、`src/game/__tests__/engine-test.ts`（修改）
- `src/app/(tabs)/index.tsx`（修改）

## Change Log

- 2026-11-11：貴客與線索的訂單卡；狀態改為 review。
