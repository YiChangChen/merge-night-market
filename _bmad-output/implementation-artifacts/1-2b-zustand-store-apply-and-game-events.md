---
baseline_commit: e4be9f69dc90cda4a2eaf16a1cb3acfb69586a99
---

# Story 1.2b: Zustand store、apply 與 GameEvent

Status: review

## Story

As a 開發者,
I want 由 Zustand store 持有遊戲狀態，並有一條事件匯流排,
So that 兩個分頁都能用 selector 訂閱 state，演出、音效和埋點也有同一個事件來源。

## Acceptance Criteria

1. `src/game/store.ts` 提供 `useGameStore` 與 `apply(action)`；`apply` 依序執行：`syncAll(state, now)` → action → 分派 `state.events` → 清空 events。
2. `src/game/events.ts` 定義 `GameEvent` union，`gameEvents.subscribe` 可以訂閱。
3. `use-game.ts` 改成 store 的薄包裝，`index.tsx` 改用 selector 訂閱，畫面行為不變。
4. 拖曳的手感保持不變（不重構 e4be9f6 的拖曳實作）。

## Tasks / Subtasks

- [x] T1 安裝 zustand 5.1.0（架構 Decision #1）
- [x] T2 `src/game/events.ts`：`GameEvent` union 與 `gameEvents`（subscribe／emit），訂閱者丟出的錯誤不得中斷其他訂閱者（AC2）
- [x] T3 `src/game/time.ts`：`syncAll(state, now)`，目前只包含 `syncEnergy`（AC1）
- [x] T4 `src/game/store.ts`：`useGameStore`（`state`、`apply`、`hydrate`），`apply` 流程依 AC1（AC1）
- [x] T5 I/O 與計時搬出規則層（AC3）
  - [x] `src/services/save.ts`：讀檔、存檔（沿用 v1 key 與行為）
  - [x] `src/services/game-session.ts`：開機讀檔 → hydrate、debounce 存檔、1 秒 tick（條件與 v1 相同：體力未滿）、回到前景 `syncAll`、進背景立即存檔
  - [x] `src/app/_layout.tsx` 啟動時呼叫 game session
  - [x] `use-game.ts` 改成 store 的薄包裝，移除 lint 暫時豁免
- [x] T6 `index.tsx` 改用 selector 訂閱切片；Hud、Orders、InfoBar 各自訂閱需要的欄位（AC3）
- [x] T7 測試：`store-test.ts`、`events-test.ts`；lint、tsc、jest 全部通過；board.tsx 沒有任何修改（AC4）

## Dev Notes

- 架構依據：`game-architecture.md`〈State Management〉、〈Event System〉、〈Communication Patterns〉；`project-context.md`。
- GameState 仍是 v1。`events` 先加成**選填**欄位，不改存檔形狀；S1.5 的 v2 會把它變成必填，並在存檔前移除。
- 目前還沒有規則函式會 push 事件（`order_completed` 在 S1.6 加入），所以 `GameEvent` 先只定義現有型別能表達的事件，之後的 story 再擴充。
- `store.ts` 是規則層和 React 之間的薄殼，需要取得目前時間；lint 對它只解除 `Date.now` 的限制，`Math.random` 仍然禁止。
- 服務層的 `console.warn` 會在 S1.2c 換成 `log`；在那之前用單行 `eslint-disable-next-line` 並註明 S1.2c。

## Dev Agent Record

### Implementation Plan

- **規則層**（純 TS，可測試）：
  - `events.ts`：`createEventBus(onError)` 加上全域的 `gameEvents`。
  - `time.ts`：`syncAll`。
  - `store.ts`：Zustand store。
- **服務層**：`use-game.ts` 原本的 I/O 和計時拆成兩個服務。
  - `save.ts`：讀寫存檔。
  - `game-session.ts`：執行週期。

  兩者都由 `_layout.tsx` 的啟動序列呼叫，符合「服務接線只在 _layout」的規則。
- **apply 的分派順序**：先 `set` 新 state，再分派事件，讓訂閱者讀到的是新 state。如果 action 回傳的是原本的 state 物件，就不觸發 store 更新。
- **畫面層**：`index.tsx` 的 Hud、Orders、InfoBar 各自用 selector 訂閱切片。Hud 用 `useShallow`。GameScreen 只訂閱 `board` 和 `apply`；點擊時才用 `getState()` 讀最新的 state。
- **型別放寬**：`msUntilNextEnergy`、`findOrderCells` 的參數從 `GameState` 改成 `Pick<...>`，只要求實際讀到的欄位，行為不變。這樣 selector 傳切片進去就好，不必訂閱整個 state。

### Debug Log

- 先寫 `events-test.ts`、`store-test.ts`，確認是紅燈（找不到模組），再實作到綠燈。
- `board.tsx` 和 HEAD 的 `src/components/board.tsx` blob hash 相同（`ddb7d3a6`），拖曳實作完全沒有修改。

### Completion Notes

- AC1：
  - `useGameStore` 提供 `state`、`apply`、`hydrate`。
  - `apply` 的流程是 `syncAll(state, now)` → action → `set` → 依序分派 events，store 裡的 state 不保留 `events`。
  - state 為 null 時不做任何事。
- AC2：`GameEvent` 目前定義 `item_merged`、`order_completed`、`queue_sold_out`、`stall_reopened`、`stall_upgraded`，都是現有型別能表達的事件；發明、卡牌、廣告事件由之後的 story 加入。`gameEvents.subscribe` 會回傳取消訂閱函式。某個訂閱者丟出錯誤時，其他訂閱者照常收到事件，錯誤延後重新丟出。
- AC3：
  - `use-game.ts` 改成 store 的薄包裝，並標為 deprecated，目前沒有呼叫端。
  - S1.1 留下的 lint 暫時豁免已經移除。
  - `index.tsx` 全部改成 selector 訂閱。
  - 執行週期的行為和 v1 相同：
    - 開機讀檔
    - 存檔延遲 500 ms
    - 體力未滿時每秒結算
    - 回到前景時結算
    - 進入背景時立刻存檔
- AC4：`board.tsx` 完全沒有修改。
- **測試**：新增 10 個，總數從 43 增加到 53，全部通過。
  - `events-test.ts`（4 個）：分派順序、取消訂閱、錯誤隔離、分派途中取消訂閱。
  - `store-test.ts`（6 個）：null 時不做事、hydrate 會結算、apply 先 syncAll、事件依序分派且之後清除、訂閱者讀到新 state、沒有變化時不更新。
- `npx expo lint`、`npx tsc --noEmit` 通過；`npx expo export --platform android` 打包成功（1736 個模組）。
- **lint 調整**：`store.ts` 放行 `Date.now`，因為它是規則層的邊界，要把時間交給 `syncAll`；`Math.random` 仍然禁止。
- **暫時寫法**：`services/save.ts` 裡兩處 `console.warn` 用單行 `eslint-disable` 標註 `TODO(S1.2c)`，S1.2c 會換成 `log`。
- **實機測試**：2026-11-09 由 Admin 在實機上手動測試，結果 OK（產生、合成、出單、賣出，以及背景切換後的存檔）。

## File List

- package.json、package-lock.json（修改：新增 zustand 5.1.0）
- eslint.config.js（修改：移除 use-game 豁免；store.ts 放行 Date.now）
- src/game/events.ts（新增）
- src/game/time.ts（新增）
- src/game/store.ts（新增）
- src/game/engine.ts（修改：`events?` 欄位；兩個函式的參數型別放寬）
- src/game/use-game.ts（修改：改成 store 薄包裝）
- src/game/__tests__/events-test.ts（新增）
- src/game/__tests__/store-test.ts（新增）
- src/services/save.ts（新增）
- src/services/game-session.ts（新增）
- src/app/_layout.tsx（修改：啟動 game session）
- src/app/index.tsx（修改：改用 selector 訂閱）
- _bmad-output/implementation-artifacts/1-2b-zustand-store-apply-and-game-events.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：完成 Story 1.2b：Zustand store、apply、GameEvent 匯流排、存檔與執行週期移到服務層、畫面改用 selector。狀態改為 review。
