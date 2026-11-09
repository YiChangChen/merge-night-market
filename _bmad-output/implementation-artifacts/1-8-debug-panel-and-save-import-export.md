---
baseline_commit: 02eeccf
---

# Story 1.8: 除錯面板與存檔匯入匯出

Status: review

## Story

As a 開發者與測試者,
I want 用除錯面板調整金幣、等級、攤位，並匯入匯出存檔,
So that 不必真的玩上好幾個小時，就能重現 bug、測試後期內容，或製作 fixture。

## Acceptance Criteria

1. development 或 preview 建置中，在設定畫面（S1.7）長按版本號 2 秒，開啟除錯面板。面板提供：加金幣、加體力、設定玩家等級、設定各攤位等級、時間快轉（把偏移量注入 `syncAll` 的 `now`）。
2. 「匯出存檔」把目前的存檔 JSON 複製到剪貼簿；「匯入存檔」從剪貼簿讀取，先執行遷移與驗證，失敗時拒絕匯入並顯示原因。
3. 所有除錯操作都透過 `apply` 呼叫規則層的函式，不直接修改 state。
4. production 建置看不到這個入口，`extra.debugTools = false` 時不會掛載相關程式碼。
5. Story 1.4 放在棋盤畫面上的 Spike B 暫時按鈕移進除錯面板，棋盤畫面上不再有任何 spike 按鈕。

## Tasks / Subtasks

- [x] T1 安裝 `expo-clipboard`（AC2 指定剪貼簿）
- [x] T2 規則層 `src/game/debug.ts`：加金幣、加體力、設定玩家等級、設定攤位等級；`engine.ensureGenerator`（AC1、AC3）
- [x] T3 store 時間快轉：`timeOffsetMs`、`advanceTime`、`resetTime`，偏移量加在 `syncAll` 的 `now`（AC1）
- [x] T4 `services/save-transfer.ts`：匯出、匯入（遷移加上驗證，失敗時拒絕）（AC2）
- [x] T5 `features/debug/DebugPanel`、`src/app/debug.tsx`（modal，關閉時導回首頁）；設定畫面長按版本號 2 秒（AC1、AC4）
- [x] T6 測試與驗證：規則、store、匯入匯出、面板、入口開關；lint、tsc、jest、打包

## Dev Agent Record

### Implementation Plan

- **規則層**（`src/game/debug.ts`，純函式）：
  - 不合法的輸入一律回傳原本的 state。
  - 設定玩家等級時，XP 歸零，不發升級獎勵，也不放產生器（產生器只跟著攤位走，RC-1）。
  - 把攤位從鐵捲門調高時，用新的 `engine.ensureGenerator` 補上該鏈的產生器；已經有的話不會重複放。`ensureGenerator` 之後 S1.9 的 `reopenStall` 也會用。
- **時間快轉**：
  - store 的 `currentTime()` = `Date.now()` + `timeOffsetMs`，所以 `apply`、`hydrate`、每秒 tick 的 `syncAll` 都會一起快轉。
  - `advanceTime` 會立刻結算一次，畫面馬上反映。
  - 偏移量不寫入存檔，App 重新啟動就歸零。
- **匯入匯出**：
  - 剪貼簿是 I/O，所以放在 services。
  - 匯入走 `parseSave`，和讀檔用的是同一套遷移與驗證：成功才 `hydrate` 取代目前的遊戲，之後由自動存檔寫入；失敗時目前的遊戲完全不變。
  - 讀檔還沒完成（`status` 不是 ready）時拒絕匯入。
- **入口與掛載**：
  - 設定畫面的版本號在 `debugTools` 為 false 時是 `disabled`，沒有長按行為。
  - `/debug` 路由在 `debugTools` 為 false 時直接導回首頁，只有開啟時才 `require` 面板模組。
  - `debugTools` 本身已經有執行期的 fail-closed 防護：只在開發模式或 preview 建置開啟。

### Debug Log

- 為了排版執行 prettier 時用了預設設定，`store.ts` 的引號被改成雙引號。之後用 `--single-quote --print-width 100` 改回專案風格。
- 入口測試原本用 `require` 延後載入路由，lint 對此發出警告。改成一般 import 後，因為 `mockConfig` 還沒初始化而失敗，最後把 config 的 mock 改成 getter 延遲讀取。
- `/debug` 路由的延後 `require` 是刻意的，所以保留並加上註解說明原因。
- **反向驗證**：拿掉 `/debug` 的導回首頁之後，「關閉時直接開 /debug」的測試就失敗；還原後通過。

### Completion Notes

- AC1：面板有以下功能：
  - 金幣 +100／+1000、體力 +20／+100
  - 玩家等級 −／＋
  - 5 個攤位的等級 −／＋，範圍 0–3
  - 時間快轉 +2 分、+10 分、+1 小時、歸零，並顯示目前的偏移量

  入口是在設定畫面長按版本號 2 秒（`delayLongPress = 2000`）。
- AC2：匯出用 `serializeSave`，不含 events，並顯示字數。匯入時：
  - v2 存檔直接匯入；v1 存檔會先遷移，所以可以直接拿 v1 fixture 來測遷移。
  - 剪貼簿空的、不是 JSON、結構不合法、版本較新，都會拒絕匯入並顯示中文原因。
- AC3：面板的每個按鈕都是 `apply(s => debugXxx(s, …))`，時間快轉走 store 的 `advanceTime`。
- AC4：由 `debug-entry-test` 驗證三件事：
  - 開啟時長按會打開面板。
  - 關閉時版本號是 disabled。
  - 關閉時直接開 `/debug` 會導回首頁，面板不會掛載。
- AC5：**不適用**。S1.4（Spike B）因為設備限制延後了，目前沒有 Spike B 按鈕。S1.3 的 Spike A 按鈕已經在 S1.7 移除，棋盤畫面上沒有任何 spike 按鈕。S1.4 之後如果需要按鈕，就直接放進這個面板。
- **超出 AC 的架構項目**：清除人龍冷卻、發現配方、重置每日計數。這些機制還不存在，所以在架構文件〈Debug Tools〉標明由 S2.1、E3、S6.1 補上。
- **測試**：新增 27 個，共 188 個通過；lint、tsc 也通過，iOS 和 Android 打包成功。
  - `debug-test`（9 個）：規則函式
  - `store-test`（+3 個）：時間快轉
  - `save-transfer-test`（7 個）：匯入匯出
  - `debug-panel-test`（5 個）：面板
  - `debug-entry-test`（3 個）：入口開關
- **服務層測試的例外**：`save-transfer-test` 和 `save-test` 一樣屬於存檔資料安全的範圍，所以例外寫了測試。
- **實機的限制**：使用者的 iPhone 只能用 `--no-dev` 模式執行，這時除錯工具是關閉的，**實機上看不到面板**。面板的行為目前由自動測試保證；要等有 preview 建置或開發版之後，才能在實機上使用。

## File List

- package.json、package-lock.json（修改：expo-clipboard ~58.0.4）
- src/game/debug.ts（新增）
- src/game/engine.ts（修改：export ensureGenerator）
- src/game/store.ts（修改：timeOffsetMs、advanceTime、resetTime）
- src/game/__tests__/debug-test.ts（新增）、store-test.ts（修改）
- src/services/save-transfer.ts（新增）
- src/services/__tests__/save-transfer-test.ts（新增）
- src/features/debug/（新增：debug-panel.tsx、index.ts、__tests__/debug-panel-test.tsx、__tests__/debug-entry-test.tsx）
- src/features/settings/settings-screen.tsx（修改：長按版本號）
- src/app/debug.tsx（新增）
- src/app/_layout.tsx（修改：debug modal）
- _bmad-output/game-architecture.md（修改：Debug Tools 的實作狀態）
- _bmad-output/implementation-artifacts/1-8-debug-panel-and-save-import-export.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-10：完成 Story 1.8：除錯面板、時間快轉、存檔匯入匯出。狀態改為 review。
