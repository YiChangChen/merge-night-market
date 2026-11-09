## Engine & Framework

### Selected Engine

**Expo SDK 58（React Native 0.88.1）**，沿用現有專案

**Rationale:** 核心合成、拖曳和存檔都已經在 Expo/RN 上完成。這是 2D 直式遊戲，沒有物理也沒有 3D。一人開發、時程 10 週，換引擎就等於重寫。EAS 可以一條龍處理建置、簽章和送審。

**已驗證：** 棋盤拖曳在 RN + Reanimated 4 上能維持 60 FPS。

**尚未驗證：** 夜市街（5 攤、20 個排隊頭像、霓虹、鐵捲門）、煙火、全螢幕慶祝。W1–2 必須先完成效能 spike：在 Pixel 6a 的 release build 上，讓 5 攤全開、20 個頭像、霓虹與鐵捲門同時播放，畫面維持 60 FPS，街道與棋盤互切 ≤ 300 ms。spike 結果用來決定 #3 和 #4；結果出來之前，不實作夜市街特效。

### Project Initialization

不適用，專案已經存在。開發環境需求如下：

- Node.js ≥ 22.13.x（SDK 58 的最低要求）。
- 使用 `expo-dev-client` 開發版建置。SDK 58 的 Expo Go 還沒上架，而且廣告 SDK 需要原生模組。只有原生依賴改變時才重建，JS 變更一律走 dev server。
- 安裝套件一律用 `npx expo install`，由它解析和 SDK 相容的版本。

### Engine-Provided Architecture

| 元件 | 解法 | 備註 |
|---|---|---|
| 目標平台 | iOS 16.4+ / Android 8+（minSdk 26），只支援直式 | iOS 下限依 SDK 58 實際值（ExpoModulesCore podspec）。Android 用 `expo-build-properties` 設定 minSdk 26。Web 不是目標平台，廣告、埋點等原生模組在 Web 上一律 no-op |
| 渲染：棋盤與一般 UI | RN View/Image + `expo-image` 3.x；動畫用 Reanimated 4.7（UI-thread worklets） | 已驗證 |
| 渲染：夜市街與特效 | **待決 #4** | 決定之前不得實作 |
| 物理 | 不需要 | — |
| 輸入 | react-native-gesture-handler 3.3 | Pan / Tap |
| 場景與畫面管理 | Expo Router 58（路由放在 `src/app/`） | 分頁結構待決 #3 |
| 建置與發佈 | EAS Build / Submit / Update，搭配 CNG | profile 分成 development / preview / production。`runtimeVersion` 採用 fingerprint 策略。**改動原生依賴就必須重建，不能只推 OTA**。OTA 不得阻塞啟動，以確保離線可玩、冷啟動 ≤ 3 秒 |
| 編譯優化 | React Compiler（已啟用） | shared value 一律用 `.get()`/`.set()` 存取，不在 render 中讀取。遇到問題的元件用 `'use no memo'` 豁免。動到手勢或動畫後，要在實機上重測拖曳 FPS |
| 測試 | Jest + jest-expo | 規則引擎的單元測試。每個 epic 結束時，在 Pixel 6a 的 release build 上量測冷啟動、切頁時間與 FPS |

### 分層規則

- **規則引擎**（`src/game/engine.ts` 及其相關模組）是純 TS，形式為 `(state, ...) => state`，使用 seeded RNG，時間由參數注入。**不得 import 任何 RN、Expo 或渲染模組。**
- **渲染層**（RN、Skia、動畫）只讀取 state、只 dispatch action，不得包含遊戲規則。這樣渲染方案就可以替換。

### Development Environment

- **Expo MCP Server**（官方，遠端）：用 `claude mcp add --transport http expo https://mcp.expo.dev/mcp` 加入，以 OAuth 登入，免費方案即可使用。可以查詢最新的 Expo 文件；搭配執行中的 dev server 時，還能截圖、操作 UI、使用 DevTools。
- **Context7**（upstash/context7）：查詢 Reanimated、廣告 SDK 等第三方函式庫的最新文件。

### Remaining Architectural Decisions

1. 狀態管理與切分
2. 存檔格式與 v1→v2 遷移
3. 導覽結構，以及兩頁是否常駐（**和 #4 綁定，需要一起決定**）
4. 夜市街與特效的渲染方式：純 RN、RN + Skia 特效層，或 RN + Lottie/Rive 預製動畫。由 W1–2 的 spike 決定，約束條件是 60 FPS、切頁 ≤ 300 ms、冷啟動 ≤ 3 秒
5. 激勵廣告 SDK 與同意流程（ATT、UMP）：W1–2 先做 spike，用開發版建置在雙平台播出測試廣告，並先寫好行不通時的備案
6. 數據埋點供應商
7. 音效引擎（候選為 `expo-audio`，屬於原生模組，需要重建開發版）
8. 時間、換日與防竄改策略
9. 遊戲內容資料（配方、卡牌、攤位）的定義方式
10. 崩潰回報與效能量測工具（用來量測 crash-free ≥ 99.5%）
