---
baseline_commit: 022d0c0
---

# Story 2.2: 棋盤頂端的客流計量條

Status: review

## Story

As a 玩家,
I want 在棋盤畫面頂端看到「今晚客流 7/12」，每出一單就有一位客人離隊,
so that 消化人龍的爽感發生在我最常看的畫面上。

## Acceptance Criteria

1. `src/features/queue-meter/` 放在棋盤畫面頂端。ACTIVE 時顯示「今晚客流 已出單/length」，例如出到第 7 單時顯示「今晚客流 7/12」。
2. 每出一單：一個客人頭像做離隊動畫，數字跳動（UX-DR2、FR42）。
3. 剩最後 3 人時，計量條閃爍並加快脈動節奏（音效節奏加快的部分在 E7 接上）。
4. COOLDOWN 期間，計量條改為顯示「下一波 2:31」倒數（FR20）。
5. 波中升級讓 length 增加時，數字直接更新為新的分母，不會跳回 0。
6. 動畫只在 UI thread 執行，只訂閱 `queue` 切片；拖曳棋子時計量條不會重繪。

## Tasks / Subtasks

- [x] T1 規則層小工具：`queue.ts` 加上 `queueServed(queue)` = `length − remaining`、`isQueueFinalStretch(queue)`（ACTIVE 且 1 ≤ remaining ≤ 3），並在 `queue-test.ts` 測試（AC1、AC3、AC5）
- [x] T2 `src/features/queue-meter/queue-meter.tsx` 與 `index.ts`（AC1–AC6）
  - [x] 只訂閱 `store.state?.queue`；`timeOffsetMs` 只在冷卻倒數時用
  - [x] ACTIVE：左邊「今晚客流 x/y」與進度條；右邊排隊頭像（最多 5 個，超過顯示「+k」）
  - [x] 出單時：最前面的頭像用 Reanimated 的 `exiting` 動畫離隊，其他頭像用 `layout` 動畫往前補；數字用 shared value 做一次彈跳
  - [x] 最後 3 人：背景閃爍並加快脈動（`withRepeat`），不在最後 3 人時停止並回到原狀
  - [x] COOLDOWN：「完售！下一波 m:ss」，只在冷卻中每秒更新；時間 = `Date.now() + timeOffsetMs`（與 HUD 相同做法）
- [x] T3 棋盤畫面接上計量條：放在 HUD 與訂單之間；`NON_BOARD_HEIGHT` 加上計量條高度與間距，棋盤不能被擠出畫面（AC1）
- [x] T4 元件測試 `src/features/queue-meter/__tests__/queue-meter-test.tsx`（AC1、AC3–AC6）
  - [x] 新局顯示「今晚客流 0/12」；出單（`remaining − 1`）後顯示「1/12」
  - [x] 波中加長：7/12 → length 14、remaining 7 時顯示「7/14」
  - [x] 最後 3 人時標記為閃爍狀態（testID 或 accessibilityState），4 人時沒有
  - [x] 冷卻中顯示「下一波 2:31」，快轉 1 秒後顯示「2:30」
  - [x] 只改棋盤、金幣時計量條不重繪（`Profiler`，參考 `stall-view-test.tsx`）
- [x] T5 驗證：lint、tsc、jest
- [x] T6 **（使用者）** 實機：出單時頭像離隊與數字跳動、最後 3 人閃爍、完售後倒數、棋盤沒有被擠壓到太小；同時完成 S2.1 的 T10

## Dev Notes

### 現況

- 棋盤畫面在 `src/app/(tabs)/index.tsx`：`Hud`（等級、金幣、體力倒數）→ `Orders`（3 位客人）→ `InfoBar` → `Board`。棋盤格大小由 `windowHeight − insets.top − tabBarHeight − NON_BOARD_HEIGHT − 客人圖高 − ORDER_LABEL_HEIGHT` 推算。**新增計量條一定要把它的高度與一個 gap（10）加進 `NON_BOARD_HEIGHT`**，否則棋盤最下面一列會被分頁列蓋住（E1 的教訓）。
- iPhone 16 上，棋盤的寬與高兩個限制幾乎相等（每格約 52–53 pt）。計量條要做得矮（建議 28 pt），讓格子縮小不超過約 5 pt。
- `Hud` 的倒數用法是範本：`useState(Date.now())` + `setInterval` 1 秒，時間加上 `timeOffsetMs`。計量條只在冷卻中才開計時器。
- 客人美術 `CUSTOMERS`（12 張，340×258，含托盤的半身圖），在 `@/game/content`。小頭像用 `contentFit="cover"`、`contentPosition="top"` 裁出臉部，參考 `stall-view.tsx` 的老闆頭像。
- 頭像要穩定：第 i 位客人（本波第 i 個，0 起算）用 `CUSTOMERS[(wave × 5 + i) % 12]`，同一位客人在出單前後不會換臉。
- `queue` 物件只有在人龍變化時才是新的參考（`syncQueue` 沒有變化時回傳原 state；`movePiece` 不碰 queue），所以 `useGameStore((s) => s.state?.queue)` 就能滿足 AC6。

### 動畫

- 離隊：頭像清單用 key = `${wave}-${index}`，出單時最前面的 key 消失，觸發 `exiting`（例如 `FadeOutLeft` 或 `SlideOutLeft` 加淡出），其他頭像用 `layout={LinearTransition}` 往前補；新的頭像從右邊 `entering`。這些都是 Reanimated 的 layout animation，在 UI 執行緒執行。
- 數字跳動：`useSharedValue(1)` 的 scale，在 `served` 改變時 `withSequence(withTiming(1.25), withTiming(1))`。
- 最後 3 人：背景透明度或邊框顏色 `withRepeat(withSequence(...), -1, true)`，節奏比一般狀態快；離開最後 3 人時 `cancelAnimation` 並回到原值。
- 新的一波開始時，頭像整排重新進場即可，不用特別演出（完售演出在 S2.4）。

### 和其他 story 的界線

- 完售的煙火與獎勵面板在 S2.4；這裡完售後只切換成「完售！下一波 m:ss」。
- 音效（最後 3 人加快節奏）在 E7。
- 夜市街的排隊頭像在 S2.3（`distributeQueue`）。

### 測試要求

- RNTL 14：`render`、`fireEvent`、`act` 都要 await。
- Reanimated 的 layout animation 在 jest 是 mock，只驗證文字與狀態，不驗證動畫過程。
- 時間用 `jest.spyOn(Date, 'now')` 固定，冷卻倒數用 `jest.advanceTimersByTime` 或直接改 `timeOffsetMs`（參考 `debug-panel-test.tsx`）。

### Project Context Rules

- 元件只用 selector 訂閱切片；寫入只能透過 `apply`（這個 story 不寫入）。
- 熱路徑（render、每秒 tick）不寫 log、不配置大物件。
- 數值放在 `src/game/content/balance.ts`；只屬於版面的常數（高度、頭像數）可以放在元件裡。
- 不得重構 `features/board/board.tsx` 的拖曳手勢。
- RN 0.88 沒有 `absoluteFillObject`，用 `StyleSheet.absoluteFill`。
- 測試檔不能放在 `src/app/`。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: 棋盤頂端的客流計量條]
- [Source: _bmad-output/planning-artifacts/epics.md — UX-DR2、FR42]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/gdd.md#M3 排隊人龍]
- [Source: _bmad-output/implementation-artifacts/2-1-queue-wave-rules.md]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-11-10.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 兩個測試寫法錯誤：`toHaveTextContent` 是完整比對（要包含「完售！」），以及 RNTL 14 沒有 `toHaveAccessibilityState`（改讀 `props.accessibilityState`）。元件本身沒有改。

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `queue.ts`：新增 `queueServed`、`isQueueFinalStretch`（純函式，計量條與之後的音效都會用到）。
- `QueueMeter`：只訂閱 `state.queue`。ACTIVE 時是半透明膠囊條：背景的進度填色、「今晚客流 x/y」（數字每出一單彈一下）、右側最多 5 個客人頭像加「+k」。頭像 key 是 `${wave}-${index}`，所以出單時最前面那位用 `FadeOutLeft` 離隊、其他人用 `LinearTransition` 往前補。最後 3 人時橘色光暈 `withRepeat` 快速閃爍（`accessibilityState.busy` 標記，供測試）。冷卻中改成「完售！下一波 m:ss」，只有這時才掛每秒計時器，時間加上除錯快轉偏移量。
- 棋盤畫面：計量條放在 HUD 與訂單之間，`QUEUE_METER_SPACE`（28 + 10）加進棋盤高度的計算。iPhone 16 上每格估計從約 52.7 縮到約 48 pt。
- 驗證：lint 0、tsc 0、jest 281 通過（新增 queue-test 2 個、queue-meter-test 5 個）、iOS 打包成功。
- T6：使用者實機確認通過（2026-11-10）。

### File List

- `src/features/queue-meter/queue-meter.tsx`（新增）
- `src/features/queue-meter/index.ts`（新增）
- `src/features/queue-meter/__tests__/queue-meter-test.tsx`（新增）
- `src/game/queue.ts`（修改）
- `src/game/__tests__/queue-test.ts`（修改）
- `src/app/(tabs)/index.tsx`（修改）

## Change Log

- 2026-11-10：棋盤頂端的客流計量條；狀態改為 review。
