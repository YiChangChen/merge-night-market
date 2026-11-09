---
title: 'S1.1 專案設定與規則護欄'
type: chore
ticket: ''
created: '2026-11-09'
status: ready-for-dev
baseline_revision: ''
route: full
route_source: auto
risk: medium
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 專案仍用靜態 `app.json`、沒有 `eas.json`，也沒有任何 lint 護欄。之後的 story（Spike A／B、分層搬遷）需要建置 profile、依 profile 注入的設定，以及在 AI agent 違反分層時直接報錯的規則。

**Approach:** 照 epics.md Story 1.1：把 `app.json` 改寫為 `app.config.ts`（加 `extra`、fingerprint runtimeVersion、`expo-build-properties` minSdk 26），手寫三個 profile 的 `eas.json`，用 `npx expo install --fix` 對齊相依版本，並在 `eslint.config.js` 加三條規則。

## Boundaries & Constraints

**Always:**
- 新增套件一律用 `npx expo install`（npm 專案，有 `package-lock.json`）。
- `app.config.ts` 保留 `app.json` 的所有既有欄位與值（名稱、slug、icon、splash、experiments、`extra.router`、`extra.eas.projectId`），直式鎖定不變（NFR7）。
- 程式碼不寫死任何金鑰；`extra` 的值一律來自環境變數，缺值時是 `undefined`，不能讓設定檔報錯。
- 分層規則的範圍、例外依架構〈Architectural Boundaries〉：只對 `src/game/**` 生效；`store.ts` 可以 import zustand（檔案尚未存在，規則先寫好）。

**Never:**
- 不搬檔、不建立 `store.ts`、`log.ts`、`src/services/*`（屬於 S1.2）。
- 不執行 `eas build:configure`、`eas build` 或任何需要登入 EAS 的命令。
- 不改任何遊戲行為；不碰 `src/components/board.tsx` 的拖曳實作。
- 不建立 `ios/`、`android/` 目錄。

**Decisions:**
- `src/game/use-game.ts` 暫時豁免三條新規則（`no-restricted-imports`、`no-restricted-syntax`、`no-console`），豁免區塊註明 `// TODO(S1.2): 移除豁免`；不搬檔、不改 `src/app/index.tsx`。
- plan 超過 1600 token，使用者選擇保留完整 plan，不拆分。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 本機開發 | 沒有設定 `APP_VARIANT` | profile 視為 `development`；`debugTools: true`；`adUnitIds` 用 Google 官方測試 ID | 無 |
| production 建置 | `APP_VARIANT=production`，金鑰環境變數未設定 | `debugTools: false`；`adUnitIds`／`posthogKey`／`sentryDsn` 為 `undefined`，設定檔照常求值 | 無 |
| 規則層用了 RN | `src/game/x.ts` 寫 `import { View } from 'react-native'` | `npx expo lint` 失敗 | lint 錯誤訊息指出分層規則 |
| 規則層讀時間 | `src/game/x.ts` 呼叫 `Date.now()` 或 `Math.random()` | lint 失敗 | 同上 |
| 任意檔案 `console.log` | `src/app/x.tsx` 呼叫 `console.log` | lint 失敗；`src/services/log.ts` 例外 | 同上 |

</frozen-after-approval>

## Code Map

- `app.json` -- 現有靜態設定；內容整份搬進 `app.config.ts` 後刪除。含 `extra.eas.projectId: c930d437-…`，必須保留。
- `package.json` -- npm 專案；`jest-expo ~58.0.13` 需升到 ~58.0.14；`expo-dev-client` 已安裝；沒有 `expo-build-properties`。
- `eslint.config.js` -- flat config：`eslint-config-expo/flat` + `ignores: ['dist/*']`。在後面追加規則區塊。
- `src/game/use-game.ts` -- 現有的違規來源：import react、react-native、AsyncStorage，呼叫 `Date.now`、`Math.random`、`console.warn`。S1.2 會改寫它。
- `src/game/engine.ts`、`content.ts`、`__tests__/engine-test.ts` -- 已經是純 TS，不受新規則影響（已確認沒有 `Date.now`、`Math.random`、`console`）。
- 基準（`e4be9f6`）：`npx expo lint`、`npx tsc --noEmit` 無錯誤；`npx jest` 43/43 通過。

## Tasks & Acceptance

**Execution:**
- [ ] `app.config.ts` -- 新增，用 `import { ExpoConfig, ConfigContext } from 'expo/config'`，default export 一個函式；搬入 `app.json` 全部欄位；加上 `runtimeVersion: { policy: 'fingerprint' }`；在 plugins 加 `['expo-build-properties', { android: { minSdkVersion: 26 } }]`；依 `APP_VARIANT` 組出 `extra.adUnitIds`、`posthogKey`、`sentryDsn`、`debugTools`，並 export 這組 extra 的型別 -- 後續 `src/services/config.ts` 會用到
- [ ] `app.json` -- 刪除 -- 避免兩份設定互相蓋過
- [ ] `eas.json` -- 新增：`cli`（`version: ">= 16.0.0"`、`appVersionSource: "remote"`）；`development`（developmentClient、internal、`env.APP_VARIANT=development`）、`preview`（internal、`env.APP_VARIANT=preview`）、`production`（`autoIncrement: true`、`env.APP_VARIANT=production`）
- [ ] `package.json` / `package-lock.json` -- `npx expo install expo-build-properties`，再執行 `npx expo install --fix` -- 對齊 SDK 58 版本
- [ ] `eslint.config.js` -- 追加三個規則區塊：(1) `src/game/**`（排除 `store.ts`）的 `no-restricted-imports`，禁 `react`、`react-native`、`expo-*`、`@/services/*`、`@/features/*`、`@/ui/*`，以及 `@react-native-async-storage/*`；`store.ts` 另設一組，允許 zustand，禁止其他項。(2) `src/game/**` 的 `no-restricted-syntax`，禁 `Date.now()`、`Math.random()`。(3) 全專案 `no-console: error`，`src/services/log.ts` 例外 -- 錯誤訊息要寫明「規則層必須是純 TS，見 game-architecture.md Architectural Boundaries」
- [ ] `eslint.config.js` -- 對 `src/game/use-game.ts` 加暫時豁免區塊（見 Decisions），註明 `// TODO(S1.2): 移除豁免`

**Acceptance Criteria:**
- Given 本機沒有任何環境變數，when 執行 `npx expo config --type public`，then 輸出包含 `runtimeVersion.policy = fingerprint`、`orientation = portrait`、原有的 `extra.eas.projectId`，以及 `extra.debugTools = true`
- Given `APP_VARIANT=production`，when 執行同一個命令，then `extra.debugTools = false`，而且命令沒有報錯
- Given 完成本 story，when 執行 `npx expo install --check`，then 沒有版本警告
- Given 用 stdin 餵一段違規程式碼給 ESLint（不建立實體檔案），when 檔名分別假裝成 `src/game/probe.ts` 和 `src/app/probe.tsx`，then 每一種違規都會失敗；同樣的程式碼假裝成 `src/features/probe.tsx` 時，只有 `console` 那條會失敗
- Given 完成本 story，when 依序執行 `npx expo lint`、`npx tsc --noEmit`、`npx jest`，then 全部通過，jest 仍是 43/43

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

**為什麼用 `APP_VARIANT`，而不是 epics 寫的 `EAS_BUILD_PROFILE`：**Expo 文件記載的作法，是在 `eas.json` 每個 profile 的 `env` 設一個自訂變數，並保證 `eas build` 求值 app config 時讀得到；`EAS_BUILD_PROFILE` 在文件裡查不到。實作時讀 `process.env.APP_VARIANT ?? process.env.EAS_BUILD_PROFILE ?? 'development'`，兩種都相容。

**測試廣告 ID：**development 和 preview 直接寫 Google 公開的測試 rewarded ID（`ca-app-pub-3940256099942544/5224354917` Android、`/1712485313` iOS），這些不是秘密；production 從 `ADMOB_REWARDED_ANDROID`、`ADMOB_REWARDED_IOS` 環境變數讀。

**`appVersionSource: remote`：**一人開發，交給 EAS 管理 build number，搭配 production 的 `autoIncrement`，避免送審時手動改版本號。

## Verification

**Commands:**
- `npx expo config --type public` -- expected: 符合 AC 1
- `APP_VARIANT=production npx expo config --type public` -- expected: `debugTools: false`，沒有錯誤
- `npx expo install --check` -- expected: 沒有警告
- `printf "import { View } from 'react-native';\nexport const t = Date.now() + Math.random();\nconsole.log(t);\n" | npx eslint --stdin --stdin-filename src/game/probe.ts` -- expected: exit ≠ 0，三種違規都列出
- `printf "console.log(1);\n" | npx eslint --stdin --stdin-filename src/features/probe.tsx` -- expected: exit ≠ 0（no-console）
- `npx expo lint && npx tsc --noEmit && npx jest` -- expected: 全部通過，43/43
- `npx expo-doctor` -- expected: 沒有新的失敗項目（與基準比較）

