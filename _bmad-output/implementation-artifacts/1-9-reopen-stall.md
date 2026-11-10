---
baseline_commit: cebce7d
---

# Story 1.9: 重開攤位

Status: done

## Story

As a 玩家,
I want 達到等級門檻並存夠金幣後，拉起麵線、蒸籠、甜品攤的鐵捲門,
So that 我可以解鎖新的產品線和新的訂單。

## Acceptance Criteria

1. 玩家在夜市街點一個鐵捲門攤位，攤位面板打開，顯示重開條件（麵線 Lv3 + 300、蒸籠 Lv5 + 600、甜品 Lv7 + 1000；開局只有 tea、fried 開著，FR9、FR10），未達成的條件會標示出來（UX-DR3）。
2. 條件都滿足時按下「重開」，執行 `reopenStall(state, stall, now)`：扣金幣、攤位設為 Lv1、把該鏈的產生器放上棋盤（棋盤滿時放進 `pendingGenerators`），並 push `stall_reopened`。
3. FxController 收到事件後播放鐵捲門拉起的動畫。
4. 條件不足時，`reopenStall` 回傳原本的 state，按鈕維持停用。
5. 重開之後，新的訂單就可能出現這條鏈。
6. `stalls-test.ts` 涵蓋：條件不足、金幣剛好夠、棋盤已滿、重複重開。

## Tasks / Subtasks

- [x] T1 測試先行：`stalls-test.ts`（AC6）
- [x] T2 `content/stalls.ts` 加上 `reopenCoins`；`src/game/stalls.ts`：`reopenCheck`、`reopenStall`（AC1、AC2、AC4）
- [x] T3 `features/overlays/`：overlay store、`FxController`、`StallPanel`、`OverlayHost`；根層 `_layout` 接上（AC1、AC3）
- [x] T4 `StallView` 可以點擊開啟面板；`RollingShutter` 鐵捲門拉起演出（AC1、AC3）
- [x] T5 畫面測試：面板開關、條件標示、重開流程、FxController、演出結束時清除
- [x] T6 驗證：lint、tsc、jest、iOS／Android 打包
- [ ] T7 **（使用者）** 實機檢查：點攤位開啟面板、條件顯示

## Dev Agent Record

### Implementation Plan

- **重開條件**：
  - 玩家等級門檻依 RC-1，沿用 `CHAINS[c].unlockLevel`（3／5／7）。
  - 金幣放在 `STALLS[c].reopenCoins`（300／600／1000）；tea、fried 是 `null`，代表開局就開著。
- **規則**：
  - `reopenCheck(state, chain)` 回傳需要的等級與金幣，並分別標示是否達成；已經開著的攤位回傳 null。參數只要求 `level`、`coins`、`stalls`，方便畫面傳入穩定的快照。
  - `reopenStall` 用 S1.8 的 `ensureGenerator` 放產生器，所以重複重開或已經有產生器時都不會多放。`now` 目前還沒用到，S2.1 的 `growActiveWave` 會用。
- **Overlay**：
  - 介面狀態放在 `useOverlayStore`，和遊戲 store 分開，不存檔。內容包括：目前開著的攤位面板，以及正在播鐵捲門演出的攤位。演出用遞增序號記錄，同一攤連續觸發時也會重播。
  - `FxController` 是 GameEvent 的訂閱者之一，收到 `stall_reopened` 時呼叫 `playShutter`，不會同步呼叫 apply。
  - `OverlayHost` 掛在根層 Stack 之上，顯示半透明背景加上置中的 `StallPanel`；點背景或「關閉」就關掉。
- **演出**：
  - `RollingShutter` 用 Reanimated 在 UI 執行緒把鐵捲門往上收、最後淡出，總長 1.1 秒。
  - 結束時用 JS 的 setTimeout 收尾，不從 worklet 回呼。
  - 只在攤位已經開著（level ≥ 1）時才蓋上去。

### Debug Log

- 第一版 `StallPanel` 在 `useShallow` 的 selector 裡回傳 `reopenCheck(...)` 的新物件，這樣每次快照都不一樣，會讓 zustand／React 不斷重繪。改成只訂閱 `level`、`coins`、`stalls` 這些穩定的值，在 render 時才算出重開條件，同時把 `reopenCheck` 的參數放寬成 `Pick`。
- 用腳本替 `content/stalls.ts` 補 `reopenCoins` 時，正規表示式沒有比對到，腳本在寫檔前就停了；改用 Edit 工具逐攤修改。

### Completion Notes

- AC1：點 `StallView`（整個攤位都可以按）會打開面板，顯示「重開條件」：
  - 玩家等級 Lv3 和金幣 300，各自附上目前的數值。
  - 達成的條件打綠色 ✓；沒達成的打紅色 ✗，數值也標紅。
  - 已經開著的攤位顯示「營業中。升級功能即將開放。」，S1.10 會補上升級。
- AC2：`reopenStall` 扣金幣、攤位設為 Lv1、`ensureGenerator`，並 push `{ type: 'stall_reopened', stall, level: 1 }`；重開後的存檔通過 `isValidSaveV2`。
- AC3：`FxController` 觸發 `RollingShutter`；測試驗證演出出現，並在 1.1 秒後自動清除。
- AC4：條件不足時規則回傳原 state，面板按鈕 `disabled`，文字顯示「條件不足」。
- AC5：測試驗證重開麵線攤之後，60 張新訂單以內一定會出現麵線。
- AC6：`stalls-test.ts`（10 個）涵蓋：
  - 條件數值、`reopenCheck` 分項標示、已開攤位
  - 等級不足、金幣不足、金幣剛好夠、棋盤已滿、重複重開、開局攤位不能重開
  - 重開後訂單會出現新鏈
- **測試**：新增 `stalls-test`（10 個）和 `stall-panel-test`（7 個），共 205 個通過；lint、tsc 也通過，iOS 和 Android 打包成功。
- **實機的限制**：要實際重開麵線攤，需要玩家 Lv3 加上 300 金幣。iPhone 上的除錯面板關閉了，沒辦法直接加金幣，所以實機上只能先檢查「點攤位會打開面板、條件標示正確」；重開的完整流程由自動測試保證。

## File List

- src/game/stalls.ts（新增）
- src/game/content/stalls.ts（修改：reopenCoins）
- src/game/__tests__/stalls-test.ts（新增）
- src/features/overlays/（新增：overlay-store.ts、fx-controller.ts、stall-panel.tsx、overlay-host.tsx、index.ts、__tests__/stall-panel-test.tsx）
- src/features/street/stall-view.tsx（修改：可點擊、鐵捲門演出）
- src/features/street/rolling-shutter.tsx（新增）
- src/app/_layout.tsx（修改：OverlayHost、startFxController）
- _bmad-output/implementation-artifacts/1-9-reopen-stall.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-10：完成 Story 1.9：重開攤位規則、攤位面板、Overlay Host、FxController 與鐵捲門演出。狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 194119f..main）

- [x] [Review][Patch] 攤位面板開著時按 Android 返回鍵，面板不會關閉，而是切換分頁或直接離開 App；加上 BackHandler，按返回鍵時先關閉面板 [src/features/overlays/overlay-host.tsx]
- [x] [Review][Patch] 攤位在重開演出途中又被調回 Lv0（除錯或匯入）時，演出的狀態不會被清除，之後再次開啟時會莫名重播；攤位關閉時一併清除它的演出狀態 [src/features/street/stall-view.tsx]
- [x] [Review][Patch] 已經關閉的開局攤位，面板會顯示「已經是最高等級的大店」；改成顯示「暫停營業」[src/features/overlays/stall-panel.tsx]
- [x] [Review][Patch] 重開之後霓虹會亮起第一段，但沒有播放通電演出（FR14「每次升級都播放通電演出」）；FxController 收到 stall_reopened 時，除了鐵捲門，也一併播放通電 [src/features/overlays/fx-controller.ts]
- [x] [Review][Defer] T7 的實機檢查（點攤位開啟面板）沒有另外記錄 — deferred, 在 S1.10 的實機檢查時一起看過夜市街；重開的完整流程要等玩家實際玩到 Lv3 才能測
