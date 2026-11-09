---
baseline_commit: e72374b
---

# Story 1.2c: 日誌服務與 ErrorBoundary

Status: done

## Story

As a 開發者,
I want 統一的 log 介面，以及根層的錯誤防護,
So that 之後接 Sentry 時只要改一個地方，render 錯誤也不會讓 App 白屏。

## Acceptance Criteria

1. `src/services/log.ts` 提供 `log.debug/info/warn/error(scope, msg, data?)`，開發版輸出到 console；原本的 `console.warn` 全部改用 `log`（S1.2b 之後位於 `src/services/save.ts`）。
2. 根層 `_layout.tsx` 包上 ErrorBoundary：render 錯誤時顯示「重新載入」按鈕，不讓 App 白屏。
3. `npx expo lint`（含 `no-console` 規則）、`npx tsc --noEmit`、`npx jest` 全部通過。

## Tasks / Subtasks

- [x] T1 `src/services/log.ts`（AC1）
  - [x] `scope` 為字面量型別（架構〈Logging〉的清單）
  - [x] 開發版輸出到 console，格式 `[scope] message`；正式版先不輸出，留 `TODO(S7.4)` 給 Sentry breadcrumb／event
- [x] T2 `save.ts` 的兩處 `console.warn` 改用 `log.warn('save', ...)`，移除 `eslint-disable` 註解（AC1）
- [x] T3 錯誤畫面與根層 ErrorBoundary（AC2）
  - [x] `src/features/errors/`：錯誤畫面，顯示說明與「重新載入」按鈕（≥ 44 pt），出現時 `log.error`
  - [x] `src/app/_layout.tsx` export `ErrorBoundary`（Expo Router 機制），按鈕呼叫 `retry`
- [x] T4 驗證（AC3）：lint、tsc、jest；全專案沒有 `console.*` 與 `eslint-disable no-console`

## Dev Notes

- 架構依據：`game-architecture.md`〈Error Handling〉、〈Logging〉；`project-context.md`。
- Expo Router（SDK 58）：在路由檔 export `ErrorBoundary({ error, retry }: ErrorBoundaryProps)`；子路由沒有自己的 ErrorBoundary 時，錯誤往上交給最近的父層。`retry` 會清除錯誤狀態並重新渲染該路由，不會重新載入 bundle。
- Error boundary 只攔 render 期間的錯誤；事件處理、timer、Promise 的錯誤由服務層 try/catch 與之後的 Sentry 全域處理器負責（S7.4）。
- 依專案規則，服務層不寫單元測試。

## Dev Agent Record

### Implementation Plan

- `log.ts` 只有一個 `write(level, scope, message, data?)`，四個層級都呼叫它。之後接 Sentry（S7.4）只要改這一個函式。
- 根層錯誤防護採用 Expo Router 的機制：在 `_layout.tsx` export `ErrorBoundary`。錯誤畫面放在 `src/features/errors/`，出現時記一筆 `log.error`。
- 為了讓錯誤畫面記錄錯誤時有對應的 scope，`LogScope` 新增 `'render'`，架構文件〈Logging〉已經同步更新。

### Debug Log

- 查過 Expo Router 文件（error-handling）：
  - 子路由沒有自己的 `ErrorBoundary` 時，錯誤會交給最近的父層。
  - `retry` 會清除錯誤並重新渲染路由，不會重新載入整個 bundle。
  - 文件沒有說明 layout 自己的 render 錯誤會不會被攔下。目前 RootLayout 只包了 GestureHandlerRootView、StatusBar、Stack，風險很低。
- 想用 `expo-router/testing-library` 寫元件測試，但它需要 `@testing-library/react-native`，專案沒有安裝。依流程，新增依賴要先經過使用者同意，所以這次不加；ErrorBoundary 改由實機驗證。

### Completion Notes

- AC1：`src/services/log.ts` 提供 `log.debug/info/warn/error(scope, message, data?)`。開發版輸出 `[scope] message` 到對應的 console 方法；正式版先不輸出，留下 `TODO(S7.4)`。`save.ts` 的兩處 `console.warn` 改成 `log.warn('save', ...)`，兩行 `eslint-disable` 也一起移除。現在除了 `log.ts`，整個 src 沒有任何 `console.*`。
- AC2：`_layout.tsx` export `ErrorBoundary`，渲染 `ErrorScreen`，內容如下：
  - 標題「夜市暫時停電了」，說明進度都還在
  - 「重新載入」按鈕：至少 48 pt 高，按下呼叫 `retry`
  - 開發版另外顯示錯誤訊息
  - 出現時記一筆 `log.error('render', ...)`

  遊戲狀態存在 store 裡，重新載入不會遺失。
- AC3：`npx expo lint`、`npx tsc --noEmit`、`npx jest`（57 個）全部通過。
- **補上自動測試**：使用者同意後，安裝了 devDependencies `@testing-library/react-native` ^14.1.0 和 `test-renderer` ^1.3.1（RNTL 14 的 peer dependency），`npx expo install --check` 沒有警告。新增的測試：
  - `error-screen-test.tsx`（3 個）：說明文字與按鈕、按下按鈕呼叫 `onRetry`、記一筆 `log.error('render')`、開發版顯示錯誤訊息。
  - `root-error-boundary-test.tsx`（1 個）：用 `renderRouter` 載入真正的 `_layout.tsx`，子路由丟出錯誤時顯示錯誤畫面而不是白屏；按「重新載入」後恢復成原本的畫面。
  - **反向驗證**：拿掉 `ErrorBoundary` 後，整合測試確實會失敗，證明它真的在檢查錯誤防護。
- **Jest 設定**：
  - `package.json` 加上 `moduleNameMapper`，讓 `@/` 別名在 Jest 裡也能解析。
  - 新增 `jest.setup.js`，載入 gesture-handler 的 jestSetup 和 AsyncStorage 的官方 mock。
- **project-context.md** 的 Testing Rules 補上畫面元件與路由整合測試的寫法。
- 實機驗證改成選擇性：自動測試已經涵蓋「出錯時不白屏」和「按重新載入後恢復」。

## File List

- src/services/log.ts（新增）
- src/services/save.ts（修改：改用 log.warn）
- src/features/errors/error-screen.tsx（新增）
- src/features/errors/index.ts（新增）
- src/app/_layout.tsx（修改：export ErrorBoundary）
- src/features/errors/__tests__/error-screen-test.tsx（新增）
- src/features/errors/__tests__/root-error-boundary-test.tsx（新增）
- jest.setup.js（新增）
- package.json、package-lock.json（修改：RNTL、test-renderer、Jest 設定）
- _bmad-output/game-architecture.md（修改：LogScope 加上 render）
- _bmad-output/project-context.md（修改：Testing Rules）
- _bmad-output/implementation-artifacts/1-2c-log-service-and-error-boundary.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：完成 Story 1.2c：log 服務、根層 ErrorBoundary 與錯誤畫面、移除 save.ts 的 console。狀態改為 review。
- 2026-11-09：補上 ErrorScreen 元件測試與根層 ErrorBoundary 路由整合測試，新增 RNTL 14 測試基礎設施。
