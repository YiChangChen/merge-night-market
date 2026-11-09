---
baseline_commit: 75f15da
---

# Story 1.3: Spike A：夜市街效能閘門

Status: done

## Story

As a 開發者,
I want 用占位素材量出夜市街最重場景的效能,
So that 用數據決定夜市街的渲染方案（架構 #4），之後的畫面 story 不會蓋在錯誤的地基上。

## Acceptance Criteria（依 2026-11-09 使用者決定調整）

原 AC 要求在 Pixel 6a 的 release build 上，用 Flashlight 與 `adb` 量測。使用者目前**只有 iPhone、沒有 Mac、沒有 Apple Developer 付費帳號**，因此本 story 改為兩階段：

1. **原型畫面**：只在 `extra.debugTools = true`（development／preview）可進入。橫向捲動的夜市街，5 個攤位，每攤 4 層（外觀、霓虹 3 段、鐵捲門、頭像），共 20 個頭像，霓虹閃爍與鐵捲門動畫同時播放，外加煙火。
2. **App 內效能面板**：量測 30 秒，計算 UI 執行緒與 JS 執行緒的平均 FPS、卡頓幀比例（間隔超過 25 ms，也就是錯過一個 60 Hz 畫面）；量 3 次取中位數。同時提供棋盤↔夜市街的切換時間（點擊到首次 `onLayout`，10 次取中位數）。
3. **第一階段（暫定結論）**：在使用者的 iPhone 上，以 `npx expo start --no-dev --minify`（正式版 JS 模式）量測純 RN 方案；冷啟動以錄影計時。通過門檻就暫定採用純 RN，沒通過才依序評估 Skia → Lottie → 降級。
4. 結果回填到 `game-architecture.md`（Remaining Decisions #4、Decision Summary #4）與 `project-context.md` 的 Performance Rules，**明確標註「iPhone 暫定，待 Android 複驗」**。
5. **第二階段（延後）**：取得 Android 中階機後，用原本的方法（release build、Flashlight、`adb`）複驗；最晚在 S7.6 之前完成。記錄在 `deferred-work.md`。
6. 原型程式碼放在 `src/features/street/__spike__/`，結論出來後刪除，或改寫成 Story 1.7 的起點。
7. 如果採用的方案需要新的原生套件，該套件要先通過原生套件前置關卡。

## Tasks / Subtasks

- [x] T1 統計純函式 `stats.ts`（幀間隔 → 平均 FPS、卡頓比例；中位數）與單元測試
- [x] T2 `services/config.ts`：讀取 `extra.debugTools`（架構規定金鑰與設定一律經由 config 服務）
- [x] T3 原型夜市街畫面（純 RN + Reanimated）：5 攤 × 4 層、20 頭像、霓虹閃爍、鐵捲門循環、煙火
- [x] T4 效能面板：UI 執行緒（`useFrameCallback`）與 JS 執行緒（`requestAnimationFrame`）幀間隔收集、30 秒量測、3 次中位數
- [x] T5 路由 `src/app/spike-street.tsx`（debugTools 為 false 時導回首頁）；棋盤畫面角落的入口只在 debugTools 時顯示；切換時間量測
- [x] T6 量測說明文件 `docs/perf/spike-a.md`（步驟與結果表）
- [x] T7 驗證：lint、tsc、jest
- [x] T8 **（使用者）** 在 iPhone 上量測並回報數字
- [x] T9 依數字回填架構文件與 project-context；Android 複驗記入 deferred-work

## Dev Notes

- 架構依據：`game-architecture.md`〈Remaining Architectural Decisions〉#4 決策閘門、〈Night Market Street〉、〈Performance Measurement Method〉。
- **限制**：iPhone（尤其是 ProMotion 120 Hz 機種）效能高於 Pixel 6a，通過不代表 Android 中階機也能通過；`--no-dev --minify` 仍在開發用的 App 殼裡執行，不是真正的 release build。因此結論只是暫定。
- 素材一律用占位：攤位與霓虹用色塊，頭像沿用 `CUSTOMERS` 的 12 張客人圖（只能經由 `@/game/content` 取得 require 過的素材）。
- 不得修改 `board.tsx` 的拖曳手勢。

## Dev Agent Record

### Implementation Plan

### Debug Log

- 新增 `/spike-street` 路由後，tsc 報 typed routes 錯誤：`.expo/types` 的型別檔要啟動開發伺服器才會重新產生。短暫執行一次 `npx expo start --offline` 之後，tsc 就通過了；也確認開發伺服器沒有殘留在背景。
- `npx expo export --platform ios` 打包成功（1751 個模組），worklet 能正常編譯。
- 所有原生依賴都是 SDK 58 對應的版本（`expo install --check` 沒有警告），可以在 Expo Go 上執行。

### Completion Notes

- **量測結果（T8，2026-11-09）**：使用者在 iPhone 16（60 Hz）上，以 Expo Go 搭配 `--no-dev --minify` 量測。
  - FPS 量了 3 次：UI 執行緒每次都是 60.1 FPS、卡頓 0.0%；JS 執行緒每次都是 60.1 FPS。
  - 進入夜市街的時間，22 次的中位數是 72 ms。
  - 三項都通過門檻（≥ 58 FPS、卡頓 ≤ 5%、≤ 300 ms）。
  - 裝置：iPhone 16（使用者提供）。
- **結論（T9）**：暫定採用純 RN + Reanimated，不引入 Skia 或 Lottie，頭像上限暫定每攤 4 個。已回填以下文件：
  - `game-architecture.md`：文件狀態、Executive Summary、技術選型表、Remaining Decisions #4、新增「#4 閘門結果」小節、Decision Summary #4、W1 Checklist。
  - `project-context.md` 的 Performance Rules。
  - `docs/perf/spike-a.md` 的結果表。
- **Asset Management 的預算數字沒有更新**：記憶體這次量不到，留到 Android 第二階段。
- **Android 複驗**：已記入 `deferred-work.md`，最晚在 S7.6 之前完成。原型保留在 `__spike__/` 供複驗使用，S1.7 改寫成正式夜市街時移除，包括棋盤上的 Spike A 入口和 `/spike-street` 路由。
- **過程中的連線問題**：一開始用相機掃 QR code，網址被瀏覽器打開，出現 Gateway Timeout。改成在 Expo Go 裡開啟就解決了，`docs/perf/spike-a.md` 已經補上這個步驟。另外，Claude 自己開 tunnel 的請求被權限擋下（會把本機服務公開到網路），所以改成只在本機驗證伺服器與打包：manifest 0.6 秒，第一次打包 11 秒。
- **原型**：純 RN + Reanimated。
  - 5 攤 × 4 層：外觀色塊、3 段霓虹閃爍、鐵捲門上下循環、每攤 4 個頭像，頭像會上下晃動。
  - 量測期間每 5 秒放一次煙火（30 個粒子）。
  - 約 70 個 animated view 同時在 UI 執行緒上播放。
- **效能面板**：
  - UI 執行緒用 `useFrameCallback` 收集幀間隔；JS 執行緒用 `requestAnimationFrame`。
  - 每次量 30 秒，算出平均 FPS 和卡頓比例（間隔超過 25 ms 的幀），顯示每次結果與中位數。
- **進入時間**：從點擊入口按鈕，到 spike 畫面第一次 `onLayout`。這量的是畫面掛載的成本，不是 Tabs 的切換時間；正式的分頁切換時間在 S1.7 重量。
- **新增 `services/config.ts`**：依架構規定，設定一律經由 config 服務讀取。
- **測試**：新增 `stats-test.ts`（8 個），共 65 個測試通過；lint 和 tsc 也通過。
- **正式版的處理**：spike 的路由和程式碼會被打包進正式版，但 `debugTools = false` 時路由會導回首頁，入口按鈕也不會顯示。結論出來後會整個刪除。

## File List

- src/features/street/__spike__/stats.ts（新增）
- src/features/street/__spike__/__tests__/stats-test.ts（新增）
- src/features/street/__spike__/use-frame-recorder.ts（新增）
- src/features/street/__spike__/nav-timing.ts（新增）
- src/features/street/__spike__/spike-street-screen.tsx（新增）
- src/features/street/index.ts（新增）
- src/services/config.ts（新增）
- src/app/spike-street.tsx（新增）
- src/app/index.tsx（修改：debugTools 時顯示 Spike A 入口）
- docs/perf/spike-a.md（新增：量測步驟與第一階段結果）
- _bmad-output/game-architecture.md（修改：#4 暫定結論）
- _bmad-output/project-context.md（修改：Performance Rules）
- _bmad-output/deferred-work.md（修改：Android 複驗）
- _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：使用者只有 iPhone、沒有 Mac 和付費帳號，量測改成兩階段（iPhone 暫定、Android 複驗）。原型、效能面板和量測文件完成，等待量測數字。
- 2026-11-09：iPhone 量測通過（UI／JS 60 FPS、卡頓 0%、進入 72 ms），#4 暫定採用純 RN + Reanimated，回填架構文件，Android 複驗記入 deferred-work。狀態改為 review。

### Review Findings（code review 2026-11-09，範圍 e4be9f6..main）

- [x] [Review][Patch] 量測按鈕快速連點兩次，會啟動兩個 rAF 迴圈和兩個計時器，其中一個停不掉；量測中按「清除」，這一輪結果仍會被加回去。改用 ref 做防護 [src/features/street/__spike__/use-frame-recorder.ts:47-63]
- [x] [Review][Patch] project-context 規定「不能用 Expo Go」，但 S1.3、S1.5 的實機驗證都用 Expo Go；把這個例外和限制記進 project-context（原生設定沒有被驗證到）[_bmad-output/project-context.md]
- [x] [Review][Defer] 卡頓門檻固定 25 ms，在 120 Hz 螢幕會漏掉掉幀；JS 執行緒的卡頓比例沒有顯示；沒有量「回棋盤」方向 [src/features/street/__spike__/stats.ts:4] — deferred, 這次是 60 Hz 的 iPhone 16，結果有效；Android 複驗改用 Flashlight
- [x] [Review][Defer] Spike A 入口按鈕疊在棋盤右下角格子上 [src/app/index.tsx] — deferred, 暫時的除錯入口，S1.7 會和 spike 一起移除
