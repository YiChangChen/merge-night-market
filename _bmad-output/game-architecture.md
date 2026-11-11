---
title: 'Game Architecture'
project: 'merge-night-market'
date: '2026-11-08'
author: 'Admin'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Expo SDK 58 / React Native 0.88'
platform: 'iOS 16.4+ / Android 8+（直式）'

# Source Documents
gdd: '_bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/gdd.md'
epics: '_bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/epics.md'
brief: null
---

# Game Architecture

## Document Status

**狀態：** 完成（9/9 步）。這份文件是 AI agent 實作時必須遵守的規範。#4 夜市街渲染已於 2026-11-09 由 Spike A 暫定為純 RN + Reanimated（iPhone 量測，待 Android 中階機複驗）。

---

## Executive Summary

**夜市合成**沿用既有的 **Expo SDK 58 / React Native 0.88** 專案，目標平台為 **iOS 16.4+ / Android 8+**，僅支援直式。

**關鍵架構決策：**

- **純函式規則引擎 + Zustand 薄殼**：所有遊戲規則都寫成 `(state, ..., now) => state`，並用 Jest 窮舉測試。元件透過 selector 訂閱 state，棋盤拖曳時夜市街不會跟著重繪。
- **存檔 v2**：單一 JSON 加上版本遷移鏈。首次遷移前先備份 v1；遷移失敗時絕不覆寫原檔，也不會開新局。
- **型別化 GameEvent**：演出、音效、埋點共用同一組事件。廣告（AdMob 17.4）、埋點（PostHog）、崩潰回報（Sentry）都包在服務介面後面，Web 版一律 no-op。
- **4 個自訂模式**：拖放解析、人龍波次、阿嬤保底計數、激勵廣告交易。
- **夜市街渲染方式**：純 RN + Reanimated（Spike A 暫定結論；待 Android 中階機複驗，見 #4）。

**專案結構：** 先分層、層內再按功能。共有 14 個核心系統，分層邊界由 ESLint 強制。

**實作模式：** 6 類標準模式、4 個自訂模式、12 條一致性規則、9 條規則澄清。

**下一階段：** 執行 W1 Bootstrap Checklist，再進入 Epic 實作。

## Project Context

### Game Overview

**夜市合成（merge-night-market）**：台灣夜市題材的合成解謎遊戲，外加攤位建造的 meta 層。玩家在 7×8 棋盤上合成小吃、交付訂單、消化排隊人龍，再用金幣重開與升級 5 個攤位，並用跨鏈合成發明 10 道新菜。

### Technical Scope

**Platform:** iOS 16.4+ / Android 8+，只支援直式（目前另有 web 建置，僅供開發預覽，不上架）
**Genre:** Puzzle（合成）+ Simulation（建造與經濟）
**Project Level:** 中等。單機、無多人、無伺服器；一人開發，約 10 週。
**既有基礎:** Expo SDK 58 / RN 0.88.1 / Expo Router / Reanimated 4.7 / Gesture Handler 3.3 / AsyncStorage / Jest。另已安裝 expo-dev-client 並啟用 React Compiler。

### Core Systems

| 系統 | 複雜度 | GDD 出處 | 現況 |
|---|---|---|---|
| 棋盤合成與拖曳 | 中 | M1 | 已完成，需擴充 |
| 存檔與 v1→v2 遷移 | 中 | 技術規格、E1-1 | 只有 v1，載入時直接驗證 |
| 攤位狀態與產生器綁定 | 中 | M2、E1-2 | 新增；取代 unlockLevel 機制 |
| 夜市街畫面（橫向捲動、霓虹分段、鐵捲門動畫） | 高 | M2、E1-4/5/7 | 新增 |
| 底部分頁導覽（切換 ≤ 300 ms） | 低 | 操作、E1-3 | 目前只有單一 Stack |
| 排隊人龍（波次、冷卻、計量條） | 中 | M3、E2 | 新增，涉及時間 |
| 跨鏈發明（配方判定、發明菜疊加） | 高 | M4、E3 | 新增；新的棋子種類 |
| 貴客、線索單與阿嬤保底 | 中 | M5、E4 | 新增；訂單生成分支 |
| 卡牌與收藏冊 | 低 | M6、E5 | 新增；資料驅動 |
| 開幕週與每日上限 | 低 | M7、E6 | 新增，涉及時間與換日 |
| 激勵廣告 SDK | 高（整合風險） | M7、E6-3 | 新增；需要原生模組 |
| 數據埋點 | 中 | 成功指標、E7-1 | 新增；需要選定供應商 |
| 音效與背景音樂 | 低 | 美術與音效、E7-2 | 新增 |
| 教學手指引導 | 中 | E6-2 | 新增 |

### Technical Requirements

- **效能**：中階 Android（Pixel 6a）拖曳合成時維持 60 FPS；冷啟動 ≤ 3 秒；夜市街與棋盤互切 ≤ 300 ms。
- **離線**：沒有網路時遊戲仍可完整遊玩，只有廣告按鈕會隱藏。
- **存檔**：只存在本機；v1→v2 遷移成功率 100%，以自動化測試驗證。
- **穩定性**：crash-free sessions ≥ 99.5%。
- **建置**：加入廣告 SDK 後，改用 EAS 開發版建置，不能再用 Expo Go；之後以 EAS build/submit 送審。
- **網路**：沒有多人或伺服器同步；只有廣告和埋點需要對外連線。

### Complexity Drivers

**高複雜度**

1. **夜市街渲染**：橫向延伸的背景、5 攤 × 4 種外觀、霓虹分段亮燈、鐵捲門與煙火演出、人龍頭像排隊。這是新的「場景型」畫面，和棋盤共用同一份 state，但效能壓力不同。
2. **棋子模型擴充**：新增「發明菜」棋子（可疊 3 份、不能再合成）。`movePiece`、`canMerge`、`findMerges`、`findSpawns` 和訂單比對都得重新檢查。
3. **廣告 SDK**：原生模組、config plugin、iOS ATT、隱私權標示、無庫存與離線時的降級處理。

**新穎概念（沒有現成模式可套）**

- 跨鏈配方判定，並區分三種結果：「有效」「材料對但組合錯，會彈回並計入失敗」「完全不相關，照舊交換」。
- 人龍：把攤位等級轉成看得見的波次長度，搭配冷卻與完售演出。
- 阿嬤保底：每道配方各自累計失敗次數。

**時間型機制**（需要共用同一套「注入 now」模式）

體力回復（已有）、人龍冷卻 3 分鐘、線索單 10 分鐘後離開、開幕週 72 小時、廣告每日上限換日。

### Technical Risks

| 風險 | 影響 | 初步緩解 |
|---|---|---|
| v1 存檔遷移出錯 | 老玩家遺失進度 | 版本鏈遷移函式加 v1 樣本 fixture 測試；遷移失敗時保留原始存檔，不覆寫 |
| 廣告 SDK 與 Expo SDK 58 / RN 0.88 不相容 | 阻擋 E6 | E1 期間先做一個技術 spike，盡早用開發版建置驗證 |
| 夜市街在中階 Android 掉幀 | 違反效能需求 | 預算化：限制同時播放的動畫數；兩個分頁常駐並在背景暫停動畫 |
| 裝置時間被竄改 | 刷冷卻、刷每日上限 | 沿用 syncEnergy 的「時間倒退就重設」策略，不做伺服器驗證（單機、不影響付費） |
| `GameState` 單一大物件膨脹 | 每次操作都要重新序列化整份存檔、所有畫面都跟著重繪 | 在步驟 4 決定 state 的切分與 selector 策略 |
| 美術素材（54 張）趕不上進度 | 卡在關鍵路徑 | 架構上以資料驅動加上占位圖，讓程式不必等美術 |

## Engine & Framework

### Selected Engine

**Expo SDK 58（React Native 0.88）**：沿用既有專案（已定案，不換引擎）。所有套件版本一律以 `package.json` 為準。

**既有資產（agent 不得改寫其介面）**

| 模組 | 路徑 | 狀態 | 不可變更的部分 |
|---|---|---|---|
| 規則引擎 | `src/game/engine.ts`、`content.ts` | 已完成，有 Jest 測試 | 純函式 `(state, ...) => state`；seeded RNG 存在 state 裡；時間以參數注入 |
| 棋盤與拖曳 | `src/components/board.tsx` | 已完成，已調校（commit e4be9f6） | 手勢與動畫實作。不得為了套用新規則而重構 |
| 狀態與存檔 | `src/game/use-game.ts` | v1，AsyncStorage 單一 key | 由 #1、#2 決定如何演進 |

**效能基準：** 棋盤拖曳已實作，在開發機上手感流暢，但**尚未在 Pixel 6a 的 release build 上量測**。W1–2 的 spike 會一併量出這個基準。

### Project Initialization

不適用，專案已經存在。

### Engine-Provided Architecture

| 元件 | 解法 | 約束與現況 |
|---|---|---|
| 目標平台 | iOS 16.4+ / Android 8+，只支援直式 | iOS 16.4 是 SDK 58 的下限。Android 目前 minSdk 是 24（預設值），**待辦**：`npx expo install expo-build-properties`，並在 app.json 設定 `android.minSdkVersion: 26`。Web 不是目標平台；app.json 保留 web 設定只是為了開發預覽 |
| 渲染：棋盤與一般 UI | RN View/Image + `expo-image`，動畫用 Reanimated 4（UI-thread worklets） | 已實作 |
| 渲染：夜市街與特效 | **純 RN + Reanimated（#4 暫定）** | 不需要 Skia／Lottie；待 Android 複驗 |
| 輸入 | react-native-gesture-handler 3 | Pan、Tap |
| 場景與畫面管理 | Expo Router（路由放在 `src/app/`） | 分頁結構見 #3 |
| 建置與發佈 | EAS Build / Submit / Update，採 CNG | **待建立**：用 `npx eas-cli@latest build:configure` 產生 `eas.json`（development / preview / production），並在 app.json 設定 `runtimeVersion: { policy: "fingerprint" }`。**原生依賴有變動就必須重建，不能只推 OTA** |
| 開發版建置 | `expo-dev-client`（已安裝） | #5 的廣告與 #7 的音效預期都需要原生模組。只有原生依賴變動時才重建，JS 變更走 dev server |
| 編譯優化 | React Compiler（已啟用） | 和 Reanimated 搭配的寫法規則見 Implementation Patterns |
| 測試 | Jest + jest-expo | 規則引擎的單元測試 |

### 分層規則

- **規則引擎**不得 import 任何 RN、Expo 或渲染模組。
- **渲染層**（RN 元件，以及任何渲染或動畫函式庫）只讀取 state、只 dispatch action，不得包含遊戲規則。
- **例外**：手勢進行中的暫態視覺狀態（拖曳位置、懸停格）留在 shared value 裡；只有落子的結果才 dispatch 給規則引擎。現有的 `board.tsx` 已經這樣做。

### 原生套件前置關卡

任何候選原生套件（廣告、特效、音效、埋點、崩潰回報）在進入 spike 之前，都必須先確認三件事：支援 New Architecture、相容 RN 0.88、`npx expo-doctor` 通過。三項有任何一項不過，就直接改用備案，不進 spike。

### Development Environment

- Node.js ≥ 22.13（SDK 58 的最低要求）
- **Expo MCP Server**（官方，遠端）：`claude mcp add --transport http expo https://mcp.expo.dev/mcp`
- **Context7**：查詢第三方函式庫的最新文件

### Remaining Architectural Decisions

除了 #4，其餘決策都已在 Architectural Decisions 一節定案：

| # | 決策 | 狀態 |
|---|---|---|
| 1 | 狀態管理與切分 | 已定：Zustand 薄殼加 selector（State Management） |
| 2 | 存檔格式與 v1→v2 遷移 | 已定：單一 JSON 加遷移鏈（Data Persistence） |
| 3 | 導覽結構與常駐 | 已定：Router Tabs，兩頁常駐並設 freezeOnBlur（Navigation） |
| 4 | **夜市街與特效渲染** | **暫定：純 RN + Reanimated**（2026-11-09 Spike A，iPhone 量測；待 Android 中階機複驗，見下方） |
| 5 | 激勵廣告 SDK | 已定：AdMob 17.4 加 UMP 與 ATT（Rewarded Ads）；仍需在 W1–2 做 spike 驗證 |
| 6 | 數據埋點 | 已定：PostHog |
| 7 | 音效引擎 | 已定：expo-audio 58.0.11 |
| 8 | 時間與換日 | 已定：UTC+8 換日，時間不回退 |
| 9 | 內容資料 | 已定：TS 常數模組 |
| 10 | 崩潰回報與效能量測 | 已定：Sentry；量測方法見 Architecture Validation |

**#4 決策閘門**
- 測試場景：在 Pixel 6a 的 release build 上，5 攤全開、20 個頭像、霓虹與鐵捲門同時播放，同時量出棋盤拖曳的基準。
- 門檻：60 FPS、街道與棋盤互切 ≤ 300 ms、冷啟動 ≤ 3 秒。
- 依序嘗試：純 RN → RN + Skia 特效層（@shopify/react-native-skia 2.14.0）→ RN + Lottie/Rive 預製動畫（lottie-react-native 7.5.0）→ 降級（頭像上限 10、霓虹改為靜態分段圖）。第一個通過門檻的方案就採用。
- 結果要回填到本表與 Architectural Decisions 的 Decision Summary #4。

**#4 閘門結果（第一階段，2026-11-09）**

| 項目 | 結果 |
|---|---|
| 量測裝置 | iPhone 16（60 Hz），以 Expo Go 搭配 `--no-dev --minify` 執行。使用者沒有 Android 手機、Mac 或 Apple Developer 付費帳號，無法照原規格在 Pixel 6a release build 上量測 |
| 場景 | 純 RN + Reanimated：5 攤 × 4 層（外觀、霓虹 3 段閃爍、鐵捲門循環、每攤 4 個頭像晃動），共 20 個頭像，每 5 秒放一次 30 粒子煙火；約 70 個 animated view 同時播放，量測時持續左右捲動 |
| FPS（30 秒 × 3 次，中位數） | UI 執行緒 60.1 FPS、卡頓 0.0%；JS 執行緒 60.1 FPS（3 次結果相同） |
| 進入夜市街（點擊到首次 onLayout，22 次中位數） | 72 ms |
| 冷啟動、記憶體 | 未量測：Expo Go 下沒有參考價值；沒有 Mac 就無法用 Instruments |
| **結論** | **暫定採用純 RN + Reanimated**，不引入 Skia 或 Lottie。頭像上限暫定每攤 N = 4（實測值） |
| 待辦 | 取得 Android 中階機後，用原本的方法（release build、Flashlight、`adb`）複驗 FPS、冷啟動和記憶體，最晚在 S7.6 之前完成。如果沒通過，再依序評估 Skia → Lottie → 降級。原型已在 S1.7 移除；複驗直接量測正式的夜市街畫面（`src/features/street/`） |

**限制：**iPhone 的效能高於 Pixel 6a，而且 Expo Go 不是真正的 release build，所以第一階段只能排除「純 RN 在高階機上就不夠」的情況，不能保證中階 Android 也能達標。

### 交接給後續章節

以下規則從本節移出，由指定的章節承接：

- **Implementation Patterns**：React Compiler × Reanimated 的寫法規則。render 階段不讀 shared value；新程式碼用 `.get()`/`.set()`；既有程式在 worklet 內使用的 `.value` 不必改寫；有問題的元件用 `'use no memo'` 豁免；動到手勢或動畫後要在實機上重測。
- **Cross-cutting**：OTA 不得阻塞啟動，以確保離線可玩、冷啟動 ≤ 3 秒；原生模組在 Web 上一律 no-op。
- **Validation**：每個 epic 結束時，在 Pixel 6a 的 release build 上量測冷啟動、切頁時間與 FPS。

## Architectural Decisions

### Decision Summary

| # | 類別 | 決策 | 版本 | 理由 |
|---|---|---|---|---|
| 1 | 狀態管理 | Zustand 薄殼包住純函式規則引擎，元件以 selector 訂閱 | zustand 5.1.0 | 兩個分頁常駐，必須按切片訂閱，避免拖曳時連帶重繪夜市街；規則引擎維持純函式 |
| 2 | 存檔 | 單一 JSON key + 遷移鏈 + v1 原檔備份 | AsyncStorage 2.2.0 | 存檔小於 20 KB；單一 key 天然具原子性；遷移可測試 |
| 3 | 導覽 | Expo Router Tabs（兩頁常駐、freezeOnBlur）+ 收藏冊 modal 路由 + 根層 Overlay Host | expo-router ~58 | 切換 ≤ 300 ms；全螢幕演出不污染導覽堆疊 |
| 4 | 夜市街渲染 | 純 RN + Reanimated（Spike A 暫定，待 Android 複驗；見 Engine & Framework #4 閘門結果） | react-native-reanimated 4.7.1（既有） | iPhone 實測：UI／JS 60 FPS、卡頓 0%、進入 72 ms；不需要新增原生依賴 |
| 5 | 激勵廣告 | Google Mobile Ads（AdMob）+ UMP + ATT，包在 `AdService` 介面後面 | react-native-google-mobile-ads 17.4.0、expo-tracking-transparency 58.0.2 | 有官方 Expo plugin；v17 符合 RN 0.88 + New Architecture；之後可在 AdMob 後台開 mediation |
| 6 | 埋點 | PostHog | posthog-react-native 4.85.3 | 無額外原生依賴；內建留存報表 |
| 7 | 崩潰回報 | Sentry | @sentry/react-native 8.34.0 | 直接提供 crash-free sessions 指標 |
| 8 | 時間與換日 | 固定以 UTC+8 午夜換日；計時一律存絕對時間戳；裝置時鐘倒退時不重置、不延長 | — | 不受時區影響；沿用 syncEnergy 的既有策略 |
| 9 | 內容資料 | TS 常數模組（`as const satisfies`）+ 資料完整性 Jest 測試 | — | 沿用 content.ts；型別安全；美術直接用 require |
| 10 | 素材載入 | 分段預載：splash 期間載棋盤素材，首幀後利用閒置時間載夜市街；WebP、限制最大尺寸 | expo-image ~58 | 冷啟動 ≤ 3 秒、切換 ≤ 300 ms |
| 11 | 音效 | `AudioService`：啟動時預載音效、背景音樂循環播放、尊重靜音開關 | expo-audio 58.0.11 | 第一方套件；expo-av 已停止維護 |
| 12 ⚠️ | 遊戲事件 | 規則引擎在 state 上產生暫態 `events`，store 分派給 FX、音效、埋點後清空，不寫入存檔 | — | 演出、音效、埋點共用同一個來源，不必再比對前後 state |
| 13 ⚠️ | 拖放判定 | 純函式 `resolveDrop(state, from, to)` 依序判定 `move` / `merge` / `stack` / `invent` / `reject` / `swap`，回傳第一個命中的結果（見 NP-1） | — | GDD 的三種結果加上疊加，全部集中在一處判定，可窮舉測試 |
| 14 ⚠️ | v1 開幕週 | v1 存檔遷移時，`firstLaunchAt = 遷移時間 − 72h`，視為開幕週已過 | — | 保守做法；v1 存檔只存在於開發與測試裝置上 |

已驗證版本：npm registry，2026-11-08。

### State Management

**Approach:** Zustand 薄殼 + 純函式規則引擎

- `src/game/store.ts`：store 只持有 `state: GameState | null` 和一個 `apply(action)`。`apply` 的流程固定為：
  1. `syncAll(state, now)`：結算所有時間型機制。
  2. 套用 action（純函式）。
  3. 取出 `state.events` 分派出去。
  4. 清空 `events`。
- 元件一律用 selector 訂閱切片，例如 `useGameStore(s => s.state?.coins)`；物件型切片要搭配 `useShallow`。**不准訂閱整個 state。**
- 計時：store 內只用一個 1 秒的 interval，而且只在「有待結算的時間型機制」時運作，包括體力未滿、人龍冷卻中、線索單倒數中；回到前景時立即呼叫 `syncAll`。
- 現有的 `useGame` hook 會改寫成這個 store 的薄包裝，讓 `index.tsx` 平滑遷移。

**GameState v2（形狀草案）**

```ts
type GameStateV2 = {
  version: 2;
  // —— v1 沿用 ——
  board: (Piece | null)[];             // Piece = Item | Generator | Dish
  orders: Order[];                      // Order 新增 kind: 'normal' | 'vip' | 'clue'
  energy: number; energyUpdatedAt: number;
  coins: number; level: number; xp: number;
  pendingGenerators: ChainId[];
  nextId: number; rngSeed: number;
  // —— v2 新增 ——
  stalls: Record<ChainId, { level: 0 | 1 | 2 | 3; signatureDish: RecipeId | null }>; // 0 = 鐵捲門
  queue: { wave: number; length: number; remaining: number;
           cooldownEndsAt: number | null; bonus: number };                         // bonus = 額外人潮接口，MVP 恆為 0
  inventions: Partial<Record<RecipeId, { discovered: boolean; made: number;
                                         failures: number; clueSeen: boolean }>>;
  meta: { firstLaunchAt: number; tutorialStep: number; hintedRecipes: RecipeId[] };
  daily: { dateKey: string; adEnergyUsed: number; adDoubleUsed: number };          // dateKey 以 UTC+8 計
  lastSellout: { wave: number; coins: number; energy: number; xp: number; doubled: boolean } | null; // 完售加倍用，見 NP-4
  events: GameEvent[];                  // 暫態，不寫入存檔
};

type DishPiece = { id: number; kind: 'dish'; recipe: RecipeId; count: 1 | 2 | 3 };
```

- **衍生值一律不存**：人龍長度上限、卡牌星等（由 `made` 推算）、攤位加成、貴客機率、體力上限（依 `firstLaunchAt` 判斷是否在開幕週內），全部用純函式即時計算。
- **規則引擎拆成多個模組**：`engine.ts`（棋盤與訂單，既有）、`stalls.ts`、`queue.ts`、`invention.ts`、`vip.ts`、`daily.ts`、`time.ts`（`syncAll`）。每個模組都是 `(state, ...) => state`，並各自有 Jest 測試。

### Data Persistence

**Save System:** 單一 JSON + 版本遷移鏈

- Keys：
  - `merge-night-market/save`：現行存檔
  - `merge-night-market/save.v1.bak`：第一次遷移前，原封不動備份的 v1 原始字串
  - `merge-night-market/settings`：靜音等設定，和遊戲存檔分開存放
- 讀檔流程：`parse` → 依序執行 `migrations[version]` 直到最新版 → 執行 `isValidSaveV2` 驗證。
  - 任何一步失敗：**不覆寫、不開新局**。顯示「存檔讀取失敗」畫面，保留原檔與備份，並回報 Sentry。
  - 只有在找不到任何存檔時，才開新局。
- 寫檔：沿用現有 500 ms debounce，App 進入背景時立即寫入；寫入前先剝除 `events`。
- **v1 → v2 遷移規則**：
  - 攤位：`CHAINS[c].unlockLevel ≤ level` 的鏈設為 Lv1，其餘設為 0（鐵捲門）。v1 棋盤上的產生器原樣保留。
  - 訂單：全部補上 `kind: 'normal'`。
  - 人龍：以遷移後的攤位等級開一波新的人龍。
  - 發明紀錄、每日紀錄：設為空值。
  - 開幕週：`firstLaunchAt = now − 72h`（決策 #14）。
- 測試：`__tests__/fixtures/save-v1-*.json` 至少準備 4 份（新局、Lv3、Lv7 滿鏈、棋盤滿加上待放產生器）。每份都驗證遷移後 `isValidSaveV2` 通過，且金幣、XP、棋盤內容不變。這是 GDD「遷移成功率 100%」的驗收依據。

### Navigation & Screen Structure

```
src/app/
  _layout.tsx           Stack + GestureHandlerRootView + <OverlayHost/> + 啟動序列
  (tabs)/_layout.tsx    Tabs（自訂 tab bar、freezeOnBlur: true、兩頁常駐）
  (tabs)/index.tsx      棋盤
  (tabs)/street.tsx     夜市街
  collection.tsx        收藏冊（presentation: 'modal'），入口在夜市街右上角
  settings.tsx          設定（presentation: 'modal'），入口在夜市街左上角；顯示版本號、音訊開關，長按版本號開啟除錯面板
```

- **分頁實作（S1.7）**：`import { Tabs } from 'expo-router/js-tabs'`（`expo-router` 的 `Tabs` 匯出已棄用）。自訂 tab bar 的 props 是 Expo Router 58 內建的介面：`state`、`emitter`、`navigateToTab(routeKey)`、`insets`，**沒有** React Navigation 的 `navigation` 物件。`lazy: false` 讓兩頁開機就掛載，`freezeOnBlur: true` 讓背景分頁凍結。
- **Overlay Host**：掛在根層。發明演出、完售煙火、攤位重開／升級面板、阿嬤提示、升星演出都在這裡以元件形式顯示，不走路由。
- 觸發來源只有兩種：使用者點擊（例如攤位面板），或 `GameEvent`（例如完售、首次發明）。
- 分頁失焦時，該頁的循環動畫（霓虹閃爍、熱氣、人龍）必須暫停。

### Night Market Street（場景骨架，渲染方式依閘門結果）

- `StreetScreen`：橫向 ScrollView，5 個 `StallView`，每個寬度固定。
- `StallView` 由下往上分成以下圖層：
  1. 外觀（依等級 0–3 切換圖片）
  2. 霓虹（3 段，依等級點亮）
  3. 鐵捲門（重開時播放動畫）
  4. 招牌菜（附星等徽章）
  5. 人龍：每攤最多畫 N 個頭像，超過的部分顯示 `+k`，N 由 spike 決定
- 人龍分配到各攤的方式，依 GDD「各攤人龍比例」寫成純函式 `distributeQueue(state)`，放在規則引擎內。

### Rewarded Ads

- **`AdService` 介面**（`src/services/ads.ts`，另有 `ads.web.ts` 做 no-op）：
  - `init()`
  - `isReady(placement)`
  - `show(placement): Promise<'earned' | 'dismissed' | 'unavailable'>`
- placement 只有 `'energy'` 和 `'sellout-double'` 兩種。
- **只有收到 SDK 的 `EARNED_REWARD` 才發獎勵**。發獎勵的 action 是純函式 `grantAdReward(state, placement, now)`，每日上限也在這個函式內檢查。
- **啟動順序**：UMP `gatherConsent` → iOS ATT 授權請求 → `mobileAds().initialize()` → 預載兩個 placement 的激勵廣告。整個流程在首幀之後於背景執行，不阻塞啟動。
- 開發版建置一律使用 `TestIds.REWARDED`。正式的 ad unit ID 透過 `app.config` 的 extra 依建置 profile 注入。
- 廣告載入失敗、沒有填充、或處於離線狀態時，`isReady` 回傳 false，UI 直接隱藏按鈕（E6-6）。

### Analytics & Crash Reporting

- **`Telemetry` 服務**（`src/services/telemetry.ts`）訂閱 `GameEvent`，轉送 PostHog。事件名稱採 `snake_case`，屬性採扁平結構。
  - 事件清單沿用 GDD：攤位重開與升級、完售、發明成功與失敗、提示觸發、升星、廣告觀看，再加上 `app_open`、`tutorial_step`。
- PostHog 關閉自動擷取 screen 與觸控，只送明確的事件。離線時由 SDK 暫存，上線後批次送出。
- Sentry 透過 config plugin 上傳 source map，release 名稱對應 EAS 的 build／update。
- web 版一律 no-op。

### Time & Day Rollover

- `time.ts` 提供以下函式：
  - `dateKeyUTC8(now)`
  - `syncAll(state, now)`：依序執行 syncEnergy、syncQueue、syncOrders（線索單到期）、syncDaily（換日歸零）
  - `needsTick(state, now)`：store 的 1 秒 tick 只在它回傳 true 時運作。條件是：體力 < `maxEnergy(state, now)`、人龍冷卻**到期**（`now ≥ cooldownEndsAt`）或時鐘倒退讓剩餘冷卻超過 3 分鐘（需要截短），或線索單**到期**／時鐘倒退需要截短（S4.2，和冷卻同一個原則；倒數由訂單卡自己計時）。冷卻倒數期間不必每秒結算（畫面自己計時）；體力滿時 `syncEnergy` 每次都會產生新 state，整段冷卻都 tick 會變成每秒存檔（E2 code review 2026-11-10）。新增任何倒數計時，都必須同步擴充這個函式，並遵守「只在需要改變 state 時回傳 true」。
- 所有倒數一律存成絕對時間戳 `endsAt`。
- 時鐘倒退的處理：
  - `now < 上次紀錄時間`：只重設起點，不發獎勵、不歸零計數。
  - `dateKey` 比上次小：視為未換日。

### Content Data

```
src/game/content/
  chains.ts     （由現有 content.ts 拆出）
  customers.ts
  stalls.ts     攤位、老闆、重開與升級費用
  recipes.ts    10 道配方、線索台詞
  cards.ts      卡面、故事、星等門檻
  balance.ts    所有數值常數
  index.ts      re-export
```

- 各類 ID 一律使用字面量型別，例如 `RecipeId`、`StallId = ChainId`。
- `__tests__/content-test.ts` 驗證資料完整性：配方材料的鏈與階數都存在、每條鏈恰好出現在 4 道配方中、卡牌與配方一一對應、所有美術資源都已定義。
- 待定稿的內容（配方名稱、老闆、台詞）先用占位資料，標註 `// TODO(content)`。

### Asset Management

- **啟動序列**：
  1. splash 顯示
  2. 讀檔與遷移
  3. 預載棋盤素材（產生器、品項、客人）與音效
  4. 隱藏 splash
  5. 首幀之後利用閒置時間預載夜市街與卡牌素材
- **規格**：圖片一律使用 WebP。品項、頭像單張 ≤ 512 px；攤位外觀 ≤ 1024 px；夜市街背景依 spike 結果切塊。
- `expo-image` 使用 `cachePolicy="memory-disk"`。
- 預算：棋盤素材解碼後 ≤ 8 MB（數字待 spike 校正）。

### Audio

- **`AudioService`**（`src/services/audio.ts`）：
  - 啟動時以 `createAudioPlayer` 預載約 12 個音效。
  - 背景音樂單一 player 循環播放。
  - `setAudioModeAsync` 設為不在 iOS 靜音模式下發聲，並和其他 App 的音訊混音。
- 透過訂閱 `GameEvent` 播放音效。
- 合成音高隨階數遞增的效果，以 `playbackRate` 實作。
- 靜音設定存在 `settings` key。

### Rule Clarifications（驗證階段補上）

| # | 規則 | 實作位置 |
|---|---|---|
| RC-1 | **產生器改由攤位控制**（E1-2）：`applyLevelUps` 不再放產生器；`reopenStall` 才放產生器（棋盤滿時沿用 `pendingGenerators`）。`CHAINS[c].unlockLevel` 改作為攤位重開的玩家等級門檻 | `engine.ts`、`stalls.ts` |
| RC-2 | **訂單只從已開的攤位產生**：`createOrder` 的鏈池由 `unlockedChains(level)` 改成 `openStalls(state)` | `engine.ts` |
| RC-3 | **訂單金幣在建立時鎖定**：`Order.coins` 在建立時就套用當下的攤位加成，之後升級不回溯 | `engine.ts`、`stalls.ts` |
| RC-4 | **`movePiece` 由 `applyDrop` 取代**：UI 只呼叫 `applyDrop`。`movePiece` 保留為內部函式，只處理 move、swap、merge，讓既有測試繼續有效 | `drop.ts`、`engine.ts` |
| RC-5 | **既有規則函式補上事件**：`applyDrop`（merge）push `item_merged`；`completeOrder` push `order_completed`，簽名改為 `(state, orderId, now)` | `engine.ts` |
| RC-6 | **發明菜一次賣 1 份**：`sellPiece` 對 dish 只扣 1 份，`count` 歸 0 時清空格子。單價為兩個材料 baseCost 總和 × 1.5 | `engine.ts` |
| RC-7 | **Lv3 招牌菜由玩家選擇**：攤位面板列出棋盤上所有含該鏈的發明菜，玩家點選後呼叫 `upgradeStall(state, stall, now, recipe)`，從任一格扣 1 份，並設定 `signatureDish` | `stalls.ts`、`features/overlays/stall-panel` |
| RC-8 | **貴客單與 Lv3 消耗發明菜時一律扣 1 份**（`count − 1`），扣到 0 時清空格子 | `vip.ts`、`stalls.ts` |
| RC-9 | **線索單「請客人先走」**：`dismissOrder(state, orderId, now)` 只能用在 `kind: 'clue'`；移除後補一張新訂單，不扣人龍 | `orders.ts`（S4.2：放在 vip.ts 會和 engine 互相 import） |

### Architecture Decision Records

- **ADR-01 規則引擎保持純函式，store 只是薄殼**：所有遊戲規則都能用 Jest 窮舉測試。渲染與服務層可以替換。這是既有程式碼已經證明可行的做法。
- **ADR-02 遷移失敗時絕不覆寫存檔**：老玩家的進度比任何功能都重要；寧可停在錯誤畫面，也不能用新局蓋掉舊檔。
- **ADR-03 演出、音效、埋點共用 GameEvent**：取代「比對前後 state」的推論方式（findMerges、findSpawns 保留給既有的棋盤動畫使用）。新功能一律從事件取得訊號，同一件事只定義一次。
- **ADR-04 廣告、埋點、崩潰回報一律包在服務介面後面**：web 版用 no-op；換供應商時只需要改一個檔案；規則引擎完全不知道這些服務存在。
- **ADR-05 衍生值不存檔**：星等、人龍長度上限、加成、體力上限都即時計算，數值調整不需要再寫一次遷移。

## Cross-cutting Concerns

以下規則適用於所有系統，每一段實作都必須遵守。

### Error Handling

**策略：** 分層處理。規則引擎不拋例外；服務層自行吸收錯誤並降級；根層用 ErrorBoundary 加 Sentry 做全域攔截。

**各層規則**

| 層 | 遇到錯誤時 | 玩家看得到嗎 |
|---|---|---|
| 規則引擎（`src/game/**`） | 不合法的操作**直接回傳原本的 state**，不 throw、不 log。例如體力不足、格子不對、配方兩攤未達 Lv2 | 否。UI 依 state 沒有變化來判斷，例如播放彈回動畫 |
| 服務層（`src/services/**`） | 每個對外呼叫都包 `try/catch` → `log.warn` → 降級：廣告改為 `isReady=false`、音效靜默跳過、埋點丟棄、存檔寫入失敗就下次再試 | 否。功能自動隱藏或靜默 |
| 存檔讀取與遷移 | `log.error`，並保留原始存檔與備份 | **是**：顯示「存檔讀取失敗」畫面（見 ADR-02） |
| React 渲染 | 根層 `ErrorBoundary` 攔截，回報 Sentry，顯示「重新載入」按鈕 | **是** |
| 未處理的 Promise 或全域例外 | Sentry 全域處理器負責回報 | 依情況而定 |

**範例**

```ts
// 規則引擎：不合法 → 回傳原 state
export function upgradeStall(state: GameState, stall: StallId): GameState {
  const cost = upgradeCost(state, stall);
  if (!cost || state.coins < cost.coins) return state;
  // ...
}

// 服務層：吸收錯誤並降級
async function show(placement: Placement): Promise<AdResult> {
  try {
    return await showRewarded(placement);
  } catch (error) {
    log.warn('ads', 'show failed', { placement, error });
    return 'unavailable';
  }
}
```

### Logging

**格式：** `log.<level>(scope, message, data?)`，`scope` 是字面量型別：`'save' | 'ads' | 'audio' | 'telemetry' | 'store' | 'boot' | 'fx' | 'render'`（`render` 給根層 ErrorBoundary 使用，S1.2c 加入）。

**輸出目的地：**
- 開發版：輸出到 console。
- 正式版：`warn` 以上記成 Sentry breadcrumb；`error` 另外送一筆 Sentry event。

| 層級 | 用途 |
|---|---|
| `debug` | 開發時的細節，正式版完全不輸出 |
| `info` | 里程碑，例如啟動完成、遷移完成、廣告 SDK 初始化完成 |
| `warn` | 預期內的失敗，系統已經降級處理 |
| `error` | 資料可能受損，或流程中斷 |

**規則：**
- 直接呼叫 `console.*` 時 lint 會報錯（`no-console`）；只有 `log.ts` 可以豁免。
- **熱路徑一律不寫 log**，包括拖曳手勢、worklet、每秒 tick、`syncAll`、render。
- log 內容不得包含個資。存檔只記摘要，例如 level、coins，不得記完整 JSON。

**範例**

```ts
log.info('save', 'migrated', { from: 1, to: 2, level: save.level });
log.warn('ads', 'load failed', { placement: 'energy', code: error.code });
log.error('save', 'validation failed after migration', error);
```

### Configuration

| 類型 | 位置 | 修改方式 |
|---|---|---|
| 遊戲常數與平衡數值 | `src/game/content/balance.ts` 等 TS 常數 | 改程式碼後推 OTA，不需重建 |
| 內容資料（配方、卡牌、攤位） | `src/game/content/*.ts` | 同上 |
| 玩家設定（靜音） | AsyncStorage `merge-night-market/settings` | 遊戲內設定 |
| 環境與建置設定（ad unit ID、PostHog key、Sentry DSN、是否顯示除錯面板） | `app.config.ts` 的 `extra`，依 EAS 建置 profile 的環境變數注入；執行時以 `expo-constants` 讀取 | 改 `eas.json` 或環境變數後**重建** |

- 程式碼不得寫死任何金鑰或 ad unit ID，一律透過 `src/config.ts` 取得。
- 遇到 `__DEV__` 或 development profile 時，ad unit ID 強制使用 `TestIds`。

### Event System

**模式：** 型別化的同步事件（ADR-03）。規則引擎把事件 push 到 `state.events`；store 在每次 `apply` 之後依序同步分派給訂閱者，然後清空。

**命名：**
- `GameEvent` 是 discriminated union，以 `type` 欄位區分，值採 `snake_case` 的過去式，例如 `stall_upgraded`。
- 同一個名稱直接沿用為 PostHog 的事件名，不另做對照表。

**訂閱者**（只有這三個，新增需要更新本文件）：
- `FxController`：負責 Overlay Host 的演出
- `AudioService`
- `Telemetry`

**範例**

```ts
export type GameEvent =
  | { type: 'item_merged'; chain: ChainId; level: number }
  | { type: 'dish_invented'; recipe: RecipeId; first: boolean }
  | { type: 'invent_rejected'; recipes: RecipeId[] }
  | { type: 'order_completed'; kind: OrderKind; coins: number }
  | { type: 'queue_sold_out'; wave: number; length: number }
  | { type: 'stall_reopened' | 'stall_upgraded'; stall: StallId; level: number }
  | { type: 'card_starred'; recipe: RecipeId; stars: number }
  | { type: 'hint_shown'; recipe: RecipeId }
  | { type: 'ad_rewarded'; placement: Placement };

// 規則引擎內
return { ...next, events: [...next.events, { type: 'stall_upgraded', stall, level }] };

// 訂閱端（只讀，不得回頭改 state）
gameEvents.subscribe((e) => { if (e.type === 'queue_sold_out') fx.play('fireworks'); });
```

- 訂閱者**不得**在處理事件時同步呼叫 `apply`，以免產生遞迴。真的需要時，放進 `queueMicrotask`。
- 拖曳過程中的視覺暫態，例如懸停、抬起，不走事件系統，留在 shared value（見分層規則的例外）。

### Startup, OTA & Offline（承接 Engine & Framework 的交接）

- 啟動序列（見 Asset Management）**不得等待網路**。EAS Update 設定 `checkAutomatically: "ON_LOAD"` 加 `fallbackToCacheTimeout: 0`：先用快取的 bundle 啟動，新版本在背景下載，下次啟動才生效。
- 廣告、埋點、Sentry 初始化都排在首幀之後，任何一項失敗都不影響遊戲。
- 離線時遊戲功能完整可玩，只有廣告按鈕會隱藏。
- **原生模組在 Web 上一律 no-op**：所有服務都要提供 `*.web.ts` 實作，或在模組頂層用 `Platform.OS === 'web'` 直接回傳空實作。Web 不是目標平台，但 `npx expo start --web` 開發預覽不能因此壞掉。

### Debug Tools

**提供的工具：**
- **除錯面板**：加金幣、加體力、設定玩家等級、設定攤位等級、清除人龍冷卻、直接發現指定配方、時間快轉（偏移注入給 `syncAll` 的 `now`）、重置每日計數。
- **存檔匯入／匯出**：把目前存檔 JSON 複製到剪貼簿，或從剪貼簿貼上載入。貼上的資料要先跑一次遷移與驗證，失敗時拒絕載入。也用來製作 v1 fixture。

**實作狀態（S1.8）：**
- 已完成：加金幣、加體力、設定玩家等級、設定攤位等級、時間快轉、存檔匯入／匯出。
- 規則函式在 `src/game/debug.ts`；時間快轉是 store 的 `timeOffsetMs`；剪貼簿 I/O 在 `src/services/save-transfer.ts`；面板是 `src/app/debug.tsx`（modal）。
- 待補：清除人龍冷卻（S2.1）、直接發現指定配方（E3）、重置每日計數（S6.1）。這三項由各自的 story 隨機制一起加入。

**啟用方式：** 在設定畫面（`settings.tsx`，入口在夜市街左上角，E1 S1.7 建立）長按版本號 2 秒。只有在 `__DEV__` 或 development / preview profile 才渲染。production profile 透過 `extra.debugTools = false` 加上條件 import，把相關程式碼整段排除。

**效能量測：** 不內建 FPS 覆蓋層。W1–2 的 spike 和每個 epic 的驗收，改用 RN Dev Menu 的 Perf Monitor 做粗略觀察，正式數據則以外部工具在 Pixel 6a 的 release build 上量測（例如 Android GPU 呈現模式分析或 Flashlight）。量測方法在 Validation 章節定稿。

## Project Structure

### Organization Pattern

**模式：** 先分層，層內再按功能分。

**理由：** 分層邊界（規則引擎、服務、畫面）是這個專案最重要的承重牆，用資料夾劃分就能讓 ESLint 強制執行。層內按功能分，是為了讓夜市街、棋盤、收藏冊這些畫面元件各自集中，不會全部擠進同一個 `components/`。

### Directory Structure

```
merge-night-market/
├── app.config.ts                # 由 app.json 改寫；extra 依 EAS profile 注入金鑰與 ad unit ID
├── eas.json                     # development / preview / production（待建立）
├── eslint.config.js             # 含分層邊界規則（見 Architectural Boundaries）
├── tsconfig.json                # 路徑別名 @/* → src/*，@/assets/* → assets/*
├── AGENTS.md
├── assets/                      # 只放會被 require 的正式素材，一律 WebP
│   ├── images/
│   │   ├── items/<chain>/       # 既有：品項圖，依鏈分資料夾
│   │   ├── generators/          # 既有
│   │   ├── customers/           # 既有：12 種客人 + 3 位貴客
│   │   ├── dishes/              # 新增：10 道發明菜圖示
│   │   ├── street/              # 新增：background-*.webp（切塊）
│   │   ├── stalls/<chain>/      # 新增：shutter / lv1 / lv2 / lv3 + neon-1..3
│   │   ├── cards/               # 新增：<recipe-id>.webp + frame-normal / frame-gold
│   │   ├── owners/              # 新增：5 位老闆頭像
│   │   ├── characters/          # 新增：grandma.webp（阿嬤提示）
│   │   └── ui/                  # 圖示、按鈕、tab bar
│   ├── audio/
│   │   ├── sfx/                 # merge-*.m4a、serve.m4a、shutter.m4a、neon-hum.m4a、fireworks.m4a、gong.m4a…
│   │   ├── voice/               # 叫賣語音
│   │   └── music/               # bgm-night-market.m4a
│   ├── fx/                      # Lottie 或 Rive 檔（只有閘門選到第 3 層時才會用到）
│   └── expo.icon                # 既有
├── art-source/                  # 不打包：原始稿、AI 生圖原檔、草稿（W1 從 assets/images 根層搬過來）
├── docs/                        # 既有：DESIGN.md
├── _bmad-output/                # 規劃文件（GDD、架構）
└── src/
    ├── app/                                  # 【路由層】只負責組裝畫面，不放邏輯
    │   ├── _layout.tsx                       # Stack + GestureHandlerRootView + 啟動序列 + <OverlayHost/>
    │   ├── (tabs)/_layout.tsx                # Tabs（自訂 tab bar、freezeOnBlur）
    │   ├── (tabs)/index.tsx                  # 棋盤分頁
    │   ├── (tabs)/street.tsx                 # 夜市街分頁
    │   ├── collection.tsx                    # 收藏冊（modal）
    │   └── settings.tsx                      # 設定（modal）
    ├── game/                                 # 【規則層】純 TS，禁止 import RN/Expo/services
    │   ├── engine.ts                         # 既有：棋盤、訂單、產生器
    │   ├── drop.ts                           # resolveDrop：move/merge/stack/invent/reject/swap
    │   ├── stalls.ts                         # 重開、升級、等級加成
    │   ├── queue.ts                          # 人龍波次、完售、冷卻、distributeQueue
    │   ├── invention.ts                      # 配方判定、發明菜、失敗計數、阿嬤提示
    │   ├── vip.ts                            # 貴客單、線索單
    │   ├── cards.ts                          # 星等推算、加成
    │   ├── daily.ts                          # 開幕週、每日廣告上限、grantAdReward
    │   ├── time.ts                           # syncAll、dateKeyUTC8
    │   ├── events.ts                         # GameEvent 型別
    │   ├── types.ts                          # GameState v2、Piece、Order 等型別
    │   ├── random.ts                         # mulberry32（從 engine.ts 拆出）
    │   ├── save/
    │   │   ├── schema.ts                     # isValidSaveV2
    │   │   └── migrations.ts                 # migrations[1] → v2
    │   ├── content/                          # 內容資料（TS 常數）
    │   │   ├── chains.ts  customers.ts  stalls.ts  recipes.ts  cards.ts  balance.ts
    │   │   └── index.ts
    │   ├── store.ts                          # Zustand 薄殼（唯一允許 import zustand 的規則層檔案）
    │   └── __tests__/
    │       ├── fixtures/save-v1-*.json
    │       ├── engine-test.ts                # 既有
    │       ├── drop-test.ts  stalls-test.ts  queue-test.ts  invention-test.ts
    │       ├── vip-test.ts  daily-test.ts  time-test.ts  content-test.ts
    │       └── migration-test.ts
    ├── features/                             # 【畫面層】按功能分，只讀 store、只呼叫 apply
    │   ├── board/                            # board.tsx（從 components/ 搬來）、拖曳、合成動畫
    │   ├── orders/                           # customer-tray.tsx（搬來）、訂單卡、貴客／線索卡
    │   ├── queue-meter/                      # 棋盤頂端的人龍計量條
    │   ├── street/                           # street-screen、stall-view、neon、shutter、queue-avatars
    │   ├── collection/                       # 收藏冊、卡牌、升星
    │   ├── overlays/                         # overlay-host、fx-controller、invention-show、sellout-fireworks、stall-panel、grandma-hint
    │   ├── settings/                         # 設定畫面、音訊開關
    │   ├── tutorial/                         # 手指引導
    │   └── debug/                            # 除錯面板、存檔匯入匯出（只在 dev/preview 掛載）
    ├── services/                             # 【服務層】所有 I/O 與第三方 SDK
    │   ├── save.ts                           # AsyncStorage 讀寫、備份、debounce
    │   ├── ads.ts / ads.web.ts               # AdService
    │   ├── consent.ts / consent.web.ts       # UMP + ATT
    │   ├── audio.ts / audio.web.ts           # AudioService
    │   ├── telemetry.ts / telemetry.web.ts   # PostHog
    │   ├── crash.ts / crash.web.ts           # Sentry 初始化
    │   ├── log.ts                            # log.<level>(scope, …)
    │   ├── assets.ts                         # 分段預載清單與預載流程
    │   ├── settings.ts                       # 靜音等玩家設定
    │   └── config.ts                         # 讀取 expo-constants extra
    └── ui/                                   # 【共用 UI】跨功能元件與主題
        ├── theme.ts                          # 顏色、字級、間距
        └── button.tsx  panel.tsx  coin-label.tsx …
```

### System Location Mapping

| 系統 | 位置 | 職責 |
|---|---|---|
| 棋盤規則與訂單 | `src/game/engine.ts` | 產生、合成、交換、出餐、升級 |
| 拖放判定 | `src/game/drop.ts` | 五種拖放結果的唯一判定點 |
| 攤位 | `src/game/stalls.ts`，畫面在 `src/features/street/` | 重開、升級、加成；夜市街渲染 |
| 人龍 | `src/game/queue.ts`，畫面在 `features/queue-meter/`、`features/street/` | 波次與完售；計量條與排隊頭像 |
| 跨鏈發明 | `src/game/invention.ts` | 配方、失敗計數、阿嬤提示 |
| 貴客與線索 | `src/game/vip.ts`，畫面在 `features/orders/` | 機率、線索單到期 |
| 卡牌 | `src/game/cards.ts`，畫面在 `features/collection/` | 星等推算與加成；收藏冊 |
| 開幕週與每日 | `src/game/daily.ts` | 體力上限、廣告每日上限 |
| 時間結算 | `src/game/time.ts` | `syncAll`、UTC+8 換日 |
| 狀態容器 | `src/game/store.ts` | Zustand、apply、事件分派 |
| 存檔與遷移 | 規則在 `src/game/save/`，I/O 在 `src/services/save.ts` | 遷移與驗證是純函式；讀寫與備份屬於 I/O |
| 演出 | `src/features/overlays/` | Overlay Host、FxController 訂閱 GameEvent |
| 廣告 | `src/services/ads.ts`、`consent.ts` | AdService、UMP、ATT |
| 埋點、崩潰回報、日誌 | `src/services/telemetry.ts`、`crash.ts`、`log.ts` | PostHog、Sentry、log |
| 音效 | `src/services/audio.ts` | AudioService 訂閱 GameEvent |
| 素材預載 | `src/services/assets.ts` | 分段預載 |
| 教學 | `src/features/tutorial/`；進度存在 `state.meta.tutorialStep` | 手指引導 |
| 除錯工具 | `src/features/debug/` | 除錯面板、存檔匯入匯出 |

### Naming Conventions

#### Files

- 原始碼檔案一律使用 **kebab-case**：`stall-view.tsx`、`use-game.ts`、`queue-meter.tsx`。
- 平台專屬實作使用 `name.web.ts`、`name.ios.ts` 後綴，交給 Metro 自動解析。
- 測試檔放在同層的 `__tests__/`，命名為 `<module>-test.ts`（沿用既有慣例）。
- 存檔 fixture 命名為 `save-v<版本>-<情境>.json`，例如 `save-v1-lv7-full-board.json`。

#### Code Elements

| 元素 | 慣例 | 範例 |
|---|---|---|
| React 元件 | PascalCase | `StallView`、`QueueMeter` |
| Hook | camelCase，以 `use` 開頭 | `useGameStore`、`useStallLevel` |
| 規則函式 | camelCase 動詞開頭，簽名為 `(state, ...) => state` | `upgradeStall`、`resolveDrop`、`syncAll` |
| 衍生值函式 | camelCase 名詞或 `get`/`is`/`can` 開頭 | `queueCapacity`、`cardStars`、`canInvent` |
| 型別 | PascalCase | `GameState`、`RecipeId`、`GameEvent` |
| 常數表 | UPPER_SNAKE | `RECIPES`、`BALANCE`、`STALLS` |
| ID（字面量） | kebab-case 字串 | `'tea-fried'`、`'energy'`、`'sellout-double'` |
| GameEvent `type` | snake_case 過去式 | `stall_upgraded`、`queue_sold_out` |
| log scope | 小寫單字 | `'save'`、`'ads'` |

#### Game Assets

- 素材檔名使用 **kebab-case 英文**，格式為 WebP（圖）或 m4a（音），例如 `stalls/tea/lv2.webp`、`stalls/tea/neon-2.webp`、`cards/tea-fried.webp`、`sfx/merge-fried-3.m4a`。
- 卡面與發明菜圖示的檔名必須和 `RecipeId` 相同，`content-test.ts` 會檢查兩者是否一一對應。
- 所有素材都只在 `src/game/content/*.ts` 或 `src/services/assets.ts` 裡 `require`，元件不得直接 require 圖片。

### Architectural Boundaries

由 ESLint 的 `no-restricted-imports` 規則強制執行，違反時 lint 會失敗：

| 層 | 可以 import | 不可以 import |
|---|---|---|
| `src/game/**`（不含 `store.ts`） | `src/game/**`、純 TS 函式庫 | `react`、`react-native`、`expo-*`、`@/services/*`、`@/features/*`、`@/ui/*` |
| `src/game/store.ts` | `src/game/**`、`zustand` | `react-native`、`expo-*`、`@/services/*`、`@/features/*`、`@/ui/*` |
| `src/services/**` | `src/game/**` 的型別與純函式、第三方 SDK | `@/features/*`、`@/app/*` |
| `src/features/**` | `@/game/*`、`@/services/*`、`@/ui/*`、同一個 feature 內的檔案 | 其他 feature 的內部檔案（要跨 feature 使用，必須經由該 feature 的 `index.ts`） |
| `src/ui/**` | `react`、`react-native`、`expo-image` | `@/game/*`、`@/services/*`、`@/features/*` |
| `src/app/**` | 全部 | 不得包含遊戲邏輯，只能組裝 features |

- 服務的接線（訂閱 GameEvent、初始化 SDK）**只在** `src/app/_layout.tsx` 的啟動序列中進行。
- 既有檔案的搬遷（`components/board.tsx` 搬到 `features/board/`、`components/customer-tray.tsx` 搬到 `features/orders/`、`content.ts` 拆分）在 W1 一次完成，只改路徑，不改行為。搬完要通過既有測試與 typecheck。

## Implementation Patterns

以下模式用來確保所有 AI agent 寫出的程式碼彼此一致、可以互相銜接。

### Novel Patterns

#### NP-1 拖放解析（Drop Resolution）

**目的：** 一次拖放只會產生 5 種結果之一，而且判定只在一個地方做。這樣 UI 動畫、阿嬤保底和埋點看到的結果才會一致。

**元件：**
- `resolveDrop(state, from, to)`：純函式，只判定結果，不改 state。
- `applyDrop(state, from, to, now)`：依照判定結果套用變更，並 push 對應的事件。
- `board.tsx`：放開時先用 `resolveDrop` 查一次判定，決定放開後的動畫（合成特效、搖頭彈回、交換滑回），再呼叫 `apply((s, now) => applyDrop(s, from, to, now))`。兩次結果一定一致：`apply` 之前的 `syncAll` 只動體力與人龍，不會改棋盤、攤位或發明紀錄（S3.3，E3 code review 2026-11-11）。全螢幕演出與音效仍然依事件播放。

**判定順序（由上往下，先命中的優先）：**

| # | 條件 | 結果 | 事件 |
|---|---|---|---|
| 1 | 目標是空格 | `move` | — |
| 2 | 同一條鏈、同一階、未達最高階 | `merge` | `item_merged` |
| 3 | 兩邊都是同一道發明菜，且目標格未滿 3 份 | `stack`：目標格最多到 3 份，多出的留在來源格 | — |
| 4 | 兩邊是不同鏈的品項，`(A,B)` 剛好是某道配方，而且該配方的兩個攤位都已達 Lv2 | `invent` | `dish_invented`（帶 `first` 旗標） |
| 5 | 兩邊是不同鏈的品項，各自都是某道「兩攤皆達 Lv2」的配方材料，但兩者湊不成同一道配方，而且受影響的配方裡還有尚未發現的 | `reject`：不消耗任何東西，播放彈回動畫 | `invent_rejected`（帶受影響的配方） |
| 6 | 其他情況 | `swap` | — |

```ts
export type DropResult =
  | { kind: 'move' } | { kind: 'swap' }
  | { kind: 'merge'; chain: ChainId; level: number }
  | { kind: 'stack'; moved: number }
  | { kind: 'invent'; recipe: RecipeId }
  | { kind: 'reject'; affected: RecipeId[] };

// 材料比對不分拖曳方向
function findRecipe(a: ItemPiece, b: ItemPiece): RecipeDef | undefined {
  return RECIPES.find((r) =>
    (matches(r.a, a) && matches(r.b, b)) || (matches(r.a, b) && matches(r.b, a)));
}
```

**邊界情況：**
- 產生器不參與合成或發明，碰到時一律走 `swap`。
- 已經發現過的配方仍然可以 `invent`，用來製作更多份並累計星等，事件的 `first` 為 false。
- 第 5 項的 `affected`：所有尚未發現、兩攤都已達 Lv2、且材料包含兩個品項其中至少一個的配方。這份清單交給 NP-3 使用。
- `affected` 為空（相關配方都發現過）時不走 reject，改走 `swap`：彈回已經沒有提示意義，還會讓這兩個品項永遠無法互換位置（E3 code review 2026-11-11，使用者決定）。
- 同鏈的兩個品項不走 reject（同階是 merge，其餘 swap），整理棋盤時不會被算成發明失敗。

#### NP-2 人龍波次（Queue Wave）

**目的：** 把「攤位實力」轉換成看得見的波次。完售、冷卻、波中升級和時鐘倒退都要有明確的規則。

**狀態機：**

```
        開新波（length = capacity(state)）
  ┌─────────────────────────────────────┐
  ▼                                     │
ACTIVE（remaining > 0, cooldownEndsAt = null）
  │  completeOrder → remaining − 1
  │  reopen/upgrade 攤位 → length、remaining 同時 + Δ（上限 20）
  ▼ remaining == 0
SOLD_OUT → 發放完售獎勵，寫入 lastSellout，cooldownEndsAt = now + 3 分鐘，事件 queue_sold_out
  ▼
COOLDOWN（cooldownEndsAt ≠ null）
  │  訂單照常可以完成，只給基本獎勵，不計入人龍
  │  升級攤位不影響目前狀態（下一波開始時重算 length）
  ▼ syncQueue：now ≥ cooldownEndsAt
開新波：wave + 1，清除 lastSellout
```

```ts
export function queueCapacity(state: GameState): number {
  const levels = sumOpenStallLevels(state);
  return Math.min(BALANCE.queueBase + BALANCE.queuePerLevel * levels, BALANCE.queueMax)
    + state.queue.bonus;
}

// 在 reopenStall / upgradeStall 的最後呼叫：波中立刻加長
export function growActiveWave(state: GameState): GameState {
  const q = state.queue;
  if (q.cooldownEndsAt !== null) return state;
  const delta = Math.max(0, queueCapacity(state) - q.length);
  return delta === 0 ? state
    : { ...state, queue: { ...q, length: q.length + delta, remaining: q.remaining + delta } };
}
```

**規則：**
- 完售獎勵以本波的**最終** `length` 計算（金幣 5 × length、體力 +10、XP + length）。
- 時鐘倒退時，`cooldownEndsAt − now` 不得超過 3 分鐘；超過就截成 `now + 3 分鐘`，冷卻不會被拉長。
- 人龍頭像分配到各攤的方式，由 `distributeQueue(state)` 依各攤等級比例決定。這是純函式，畫面只負責畫出來。

#### NP-3 阿嬤保底計數（Pity Counter）

**目的：** 讓玩家「亂合也不會卡關」。每次被拒絕的發明嘗試，會同時替多道配方累計失敗次數，第 5 次時給出直白提示。

**資料流：** `applyDrop` 判定為 `reject` → 對 `affected` 裡的每道配方執行 `inventions[r].failures += 1` → 如果某道配方的 `failures ≥ 5` 且不在 `meta.hintedRecipes` 裡 → 把它加入 `hintedRecipes`，並 push `hint_shown` → `FxController` 顯示阿嬤，說出兩個材料名稱。

```ts
function recordRejection(state: GameState, affected: RecipeId[]): GameState {
  let next = state;
  for (const id of affected) {
    const rec = next.inventions[id] ?? EMPTY_INVENTION;
    next = setInvention(next, id, { ...rec, failures: rec.failures + 1 });
    if (rec.failures + 1 >= BALANCE.hintAfterFailures && !next.meta.hintedRecipes.includes(id)) {
      next = withEvent(addHinted(next, id), { type: 'hint_shown', recipe: id });
    }
  }
  return next;
}
```

**規則：**
- 每道配方的提示只出現一次。
- 教學提示（手搖飲與炸物兩攤都升到 Lv2 時，阿嬤說出配方 #1）走同一條路徑：直接把 `'tea-fried'` 加入 `hintedRecipes`，並 push 同一個事件。
- 配方被發現之後，不再累計失敗次數。

#### NP-4 激勵廣告交易（Ad Reward Transaction）

**目的：** 只有真正看完廣告才發獎勵，而且不能重複領取。每日上限一律由規則引擎判斷，UI 不自行判斷。

**流程：**

```
UI 按鈕可見條件 = canWatchAd(state, placement)   // 規則層：每日上限、體力不足、lastSellout 未加倍
               && ads.isReady(placement)         // 服務層：已載入、有網路
點擊 → await ads.show(placement)
  'earned'      → apply(s => grantAdReward(s, placement, Date.now()))
  'dismissed'   → 不做任何事
  'unavailable' → 不做任何事（按鈕會因為 isReady 變成 false 而自動隱藏）
```

```ts
export function grantAdReward(state: GameState, placement: Placement, now: number): GameState {
  const s = syncDaily(state, now);
  if (!canWatchAd(s, placement)) return s;            // 重複呼叫是安全的
  if (placement === 'energy') {
    return withEvent(
      { ...s, energy: s.energy + BALANCE.adEnergy, daily: { ...s.daily, adEnergyUsed: s.daily.adEnergyUsed + 1 } },
      { type: 'ad_rewarded', placement });
  }
  const sellout = s.lastSellout!;                     // canWatchAd 已確認存在且尚未加倍
  return withEvent(
    { ...s, coins: s.coins + sellout.coins, energy: s.energy + sellout.energy, xp: s.xp + sellout.xp,
      lastSellout: { ...sellout, doubled: true },
      daily: { ...s.daily, adDoubleUsed: s.daily.adDoubleUsed + 1 } },
    { type: 'ad_rewarded', placement });
}
```

- 完售加倍會把整份完售獎勵（金幣、體力、XP）再發一次。只能在下一波開始之前領取，每一波最多一次。
- 因此 GameState v2 要新增欄位：`lastSellout: { wave: number; coins: number; energy: number; xp: number; doubled: boolean } | null`。
- 獎勵發放的唯一入口是 `grantAdReward`。UI 不得自行加金幣或體力。

### Communication Patterns

**模式：** 狀態往下流（selector 訂閱），意圖往上走（`apply(action)`），副作用往外送（GameEvent）。元件之間不互相 import，也不互相呼叫。

```ts
// 讀
const level = useGameStore((s) => s.state?.stalls[stall].level ?? 0);
// 寫
const apply = useGameStore((s) => s.apply);
onPress={() => apply((s) => upgradeStall(s, stall, Date.now()))}
// 副作用（只在服務或 FxController 裡）
gameEvents.subscribe((e) => e.type === 'stall_upgraded' && audio.play('neon-hum'));
```

### Entity Patterns

**建立方式：** 只能透過規則層的工廠函式建立。工廠函式回傳 `[piece, nextState]`，並由它遞增 `nextId`。元件和服務一律不得自己組 Piece 物件。

```ts
export function createDish(state: GameState, recipe: RecipeId): [DishPiece, GameState] {
  return [{ id: state.nextId, kind: 'dish', recipe, count: 1 }, { ...state, nextId: state.nextId + 1 }];
}
```

- 棋盤格子一律用 `index = row * 7 + col` 表示，沿用 `BALANCE.boardColumns`。
- 合成會產生新的 id，舊的 id 就消失，`findMerges` 和動畫都依賴這個行為。疊加（stack）則保留目標格原本的 id。

### State Patterns

**模式：** 用明確的欄位表示狀態，不用布林旗標組合。生命週期寫成狀態機（例如 NP-2），以純函式推進。

- 攤位用 `level: 0 | 1 | 2 | 3` 表示，0 代表鐵捲門。不另設 `open` 布林值。
- 訂單用 `kind: 'normal' | 'vip' | 'clue'` 表示；線索單另有 `expiresAt`。
- 會受時間影響的規則函式，`now` 一律放在**最後一個參數**。函式內不得呼叫 `Date.now()` 或 `Math.random()`；隨機數一律走 `random.ts` 的 seeded RNG。
- 不得把衍生值寫進 state（見 ADR-05）。

```ts
// ✅ 正確
export function reopenStall(state: GameState, stall: StallId, now: number): GameState
// ❌ 錯誤：內部取時間、用布林旗標
export function reopenStall(state: GameState, stall: StallId) { const now = Date.now(); state.stalls[stall].open = true; }
```

### Data Patterns

**存取方式：** 內容與數值一律從 `@/game/content` 的常數表讀取，並透過查詢函式取得，不得在元件或服務裡寫死數字。

```ts
import { STALLS, RECIPES, BALANCE } from '@/game/content';
export const upgradeCost = (state: GameState, stall: StallId) => STALLS[stall].levels[state.stalls[stall].level + 1];
```

- 素材只能透過內容表裡的 `art` 欄位取得，元件不得自行 `require` 圖片。
- 在規則層中，state 一律以 immutable spread 更新，不得直接改寫原物件。

### React / Reanimated Patterns（承接 Engine & Framework 的交接事項）

- render 階段不讀 shared value。新程式碼使用 `.get()` / `.set()`；既有 worklet 裡的 `.value` 不需要改寫。
- 從 worklet 回到 JS 一律使用 `scheduleOnRN`（`react-native-worklets`），沿用 `board.tsx` 的寫法。
- React Compiler 造成問題的元件，在檔案頂部加上 `'use no memo'`，並註明原因。
- 畫面元件中的循環動畫（霓虹、熱氣、人龍），在所在分頁失焦時要暫停（用 `useIsFocused`）。
- 修改手勢或動畫之後，必須在實機上重新測試拖曳 FPS。

### Consistency Rules

| 模式 | 慣例 | 強制方式 |
|---|---|---|
| 分層 import | 依照 Architectural Boundaries 表 | ESLint `no-restricted-imports` |
| 時間與隨機 | 規則層不得出現 `Date.now()` 或 `Math.random()` | ESLint `no-restricted-syntax`（只套用在 `src/game/**`） |
| 規則函式簽名 | `(state, ...args, now?) => state`，遇到不合法操作時回傳原本的 state | Code review 與單元測試 |
| 日誌 | 只用 `log.*`，熱路徑不寫 log | ESLint `no-console` |
| 事件命名 | snake_case 過去式，型別定義在 `events.ts` | TypeScript union |
| 拖放判定 | 只在 `resolveDrop` 判定 | Code review；`drop-test.ts` 窮舉測試 |
| 獎勵發放 | 金幣、體力、XP 只能在規則層增加 | Code review |
| 廣告獎勵 | 只在 `grantAdReward` 發放 | Code review |
| 存檔變更 | GameState 形狀改變時，必須同時遞增 version、新增 migration、新增 fixture | `migration-test.ts` |
| 內容完整性 | 配方、卡牌、素材一一對應 | `content-test.ts` |
| 套件安裝 | 一律使用 `npx expo install`；原生依賴改變時必須重建開發版 | AGENTS.md |
| 完成定義 | `npx expo lint`、`npx tsc --noEmit`、`npx jest` 全部通過 | AGENTS.md |

## Architecture Validation

### Validation Summary

| 檢查 | 結果 | 說明 |
|---|---|---|
| 決策相容性 | PASS | 引擎、狀態、存檔、導覽、服務之間沒有衝突。AdMob 17 要求 RN ≥ 0.86 且使用 New Architecture，本專案符合；iOS 16.4 下限已同步回 GDD |
| GDD 涵蓋度 | PASS | M1–M7 和技術規格都有對應的架構支援。驗證時發現 9 處規則有歧義，已補成 RC-1 到 RC-9 |
| 模式完整度 | PASS | 6 類標準模式加上 4 個新模式（NP-1 到 NP-4），每一個都附範例 |
| Epic 對應 | PASS | E1 到 E7 都有對應的程式位置與模式 |
| 文件完整度 | PASS | 沒有遺留占位符。唯一刻意延後的是 #4 夜市街渲染，已附決策閘門與理由 |

### Coverage Report

**系統涵蓋：** 14/14（Project Context 的核心系統表）
**模式：** 標準 6 類、新模式 4 個、一致性規則 12 條
**決策：** 14 項決策、5 條 ADR、9 條規則澄清，另有 1 項刻意延後（#4，由閘門決定）

**GDD 對應**

| GDD | 架構支援 |
|---|---|
| M1 棋盤合成 | `engine.ts`（既有）、NP-1、RC-1、RC-4 |
| M2 夜市街與攤位 | `stalls.ts`、`features/street/`、RC-1、RC-2、RC-3、RC-7 |
| M3 排隊人龍 | `queue.ts`、NP-2、`features/queue-meter/` |
| M4 發明菜 | `invention.ts`、`drop.ts`、NP-1、RC-6、RC-8 |
| M5 貴客、線索、阿嬤 | `vip.ts`、NP-3、RC-9 |
| M6 卡牌 | `cards.ts`、`features/collection/`、ADR-05 |
| M7 開幕週、激勵廣告 | `daily.ts`、NP-4、`services/ads.ts`、`services/consent.ts` |
| 60 FPS、冷啟動 ≤ 3 秒、切換 ≤ 300 ms | #4 決策閘門、分段預載、freezeOnBlur、量測方法（見下方） |
| 存檔 v2 遷移成功率 100% | Data Persistence、`migration-test.ts` 搭配 4 份以上 fixture |
| crash-free ≥ 99.5% | Sentry release health |
| 離線可玩 | 啟動不等網路、服務降級、OTA 不阻塞 |
| 埋點事件 | GameEvent 直接轉送 PostHog（事件名稱一致） |

**Epic 對應**

| Epic | 主要位置 | 模式與決策 |
|---|---|---|
| E1 夜市街與攤位 | `game/stalls.ts`、`game/save/`、`features/street/`、`(tabs)/` | #4 閘門、Navigation、Data Persistence、RC-1 到 RC-3 |
| E2 排隊人龍 | `game/queue.ts`、`features/queue-meter/`、`features/overlays/` | NP-2、GameEvent |
| E3 跨鏈發明 | `game/drop.ts`、`game/invention.ts` | NP-1、RC-4、RC-6、RC-7、RC-8 |
| E4 貴客與線索 | `game/vip.ts`、`features/orders/` | NP-3、RC-9 |
| E5 卡牌 | `game/cards.ts`、`features/collection/`、`collection.tsx` | ADR-05 |
| E6 新手與廣告 | `game/daily.ts`、`services/ads.ts`、`services/consent.ts`、`features/tutorial/` | NP-4、Rewarded Ads |
| E7 上架準備 | `services/telemetry.ts`、`services/audio.ts`、`services/crash.ts`、`eas.json` | Analytics、Audio、量測方法 |

### Performance Measurement Method

（承接 Cross-cutting 的交接事項）

| 指標 | 工具 | 條件 | 門檻 |
|---|---|---|---|
| FPS（拖曳、夜市街捲動與演出） | Flashlight（Android），量測 UI 與 JS thread 的 FPS | Pixel 6a、**release build**、腳本化操作 30 秒、量 3 次取中位數 | 平均 ≥ 58 FPS，掉幀的幀數 ≤ 5% |
| 冷啟動 | `adb shell am start -W`，取 TotalTime | 殺掉程序後啟動，量 5 次取中位數 | ≤ 3,000 ms |
| 分頁切換 | 開發版的效能標記（點擊到首幀 `onLayout`），只在 preview profile 輸出 | 來回切換 10 次取中位數 | ≤ 300 ms |
| 記憶體 | `adb shell dumpsys meminfo` | 夜市街全開之後 | 在 spike 中建立基準，之後不超過基準 +20% |

- 時間點：W1–2 的 spike 建立基準；**每個 Epic 結束時**重量一次，結果寫在該 Epic 的 retro。
- iOS 只在送審前，用 Xcode Instruments（Time Profiler、Core Animation FPS）抽查一次。

### W1 Bootstrap Checklist

這份清單彙整各節散落的待辦，W1 的第一個 story 就照這份清單執行：

- [ ] `app.json` 改寫為 `app.config.ts`；設定 `extra`（ad unit ID、PostHog key、Sentry DSN、`debugTools`）與 `runtimeVersion: { policy: "fingerprint" }`
- [ ] `npx expo install expo-build-properties`，設定 `android.minSdkVersion: 26`
- [ ] `npx eas-cli@latest build:configure`，建立 development / preview / production 三個 profile
- [ ] `npx expo install --fix`（`jest-expo` 升到 ~58.0.14）
- [ ] 搬檔：`components/*` 搬到 `features/*`；`content.ts` 拆成 `game/content/*`；`random.ts` 從 `engine.ts` 拆出。只改路徑，跑過既有測試
- [ ] 把 `assets/images/` 根層的原始稿搬到 `art-source/`
- [ ] ESLint 加上分層規則：`no-restricted-imports`、`no-restricted-syntax`（`src/game/**` 禁用 `Date.now` 與 `Math.random`）、`no-console`
- [ ] 安裝 `zustand` 5.1，建立 `store.ts`，`useGame` 改成包在 store 外面的薄層
- [ ] 原生套件前置關卡：`react-native-google-mobile-ads`、`@sentry/react-native`、`expo-audio`、候選特效套件，逐一確認 New Architecture 支援與 `expo-doctor` 通過
- [x] **Spike A**：夜市街效能閘門（#4）：iPhone 暫定通過（純 RN），待 Android 複驗
- [ ] **Spike B**：AdMob 激勵廣告，在雙平台以開發版建置播放測試廣告，並走完 UMP 與 ATT 流程

### Issues Resolved

1. 「引擎與框架」一節的待決事項 1–10 改成狀態表，只有 #4 刻意延後，並附上決策閘門。
2. 補上 Executive Summary。
3. 補上 RC-1、RC-2：產生器改由攤位控制，訂單只從已重開的攤位產生（GDD E1-2）。
4. 補上 RC-4、RC-5：`movePiece` 與 `applyDrop` 的關係，以及既有函式要補發的事件。
5. 刪除沒有出處的 `HapticsService` 訂閱者。
6. 依使用者決定補上 RC-3（訂單金幣在建立時鎖定）、RC-6（發明菜一次賣 1 份）、RC-7（玩家自選招牌菜）。
7. 補上 RC-8、RC-9：發明菜的消耗規則，以及「請客人先走」。
8. 定下效能量測方法（承接 Cross-cutting），並彙整出 W1 Bootstrap Checklist。

### Validation Date

2026-11-08

## Development Environment

### Prerequisites

- Node.js ≥ 22.13（SDK 58 最低要求；本機目前為 24.22.1）
- Expo 帳號與 EAS CLI（以 `npx eas-cli@latest` 執行）。專案已綁定 EAS projectId
- Apple Developer 帳號、Google Play 開發者帳號（送審用）
- 實機：Pixel 6a 等級的 Android（效能量測用）、一台 iOS 16.4 以上的裝置
- PostHog 專案、Sentry 專案、AdMob 帳號（每個平台各一個 App ID 和激勵廣告的 ad unit）

### AI Tooling (MCP Servers)

| MCP Server | 用途 | 安裝方式 |
|---|---|---|
| Expo MCP Server（官方，遠端） | 查最新的 Expo 文件；搭配 dev server 可以截圖、操作 UI、使用 DevTools | `claude mcp add --transport http expo https://mcp.expo.dev/mcp`（OAuth 登入） |
| Context7（upstash/context7） | 查第三方函式庫的最新文件，例如 Reanimated、AdMob、PostHog、Sentry | 依 Context7 官方說明加入 MCP client |

### Setup Commands

```bash
npm install
npx expo install --fix
npx eas-cli@latest build --profile development --platform android   # 原生依賴有變動時才需要重建
npx expo start --dev-client
npx expo lint && npx tsc --noEmit && npx jest                          # 完成定義
```

### First Steps

1. 完成 Architecture Validation 一節裡的 **W1 Bootstrap Checklist**：設定檔、搬移檔案、ESLint 分層規則、Zustand。
2. 執行 **Spike A**（夜市街效能閘門）和 **Spike B**（AdMob 激勵廣告），並把 #4 的結論回填到本文件。
3. 依上表設定 MCP Server。
4. 從 E1 Story 1「存檔 v2 與遷移」開始實作。先準備 v1 fixture 和 `migration-test.ts`。

