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
| 渲染：夜市街與特效 | **待決 #4** | 決定前不得實作 |
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

1. 狀態管理與切分
2. 存檔格式與 v1→v2 遷移
3. 導覽結構，以及兩頁是否常駐（和 #4 綁定，需一起決定）
4. **夜市街與特效渲染：W1–2 決策閘門**
   - 測試場景：Pixel 6a 的 release build 上，5 攤全開、20 個頭像、霓虹與鐵捲門同時播放，同時量棋盤拖曳的基準
   - 門檻：60 FPS、街道與棋盤互切 ≤ 300 ms、冷啟動 ≤ 3 秒
   - 依序嘗試：純 RN → RN + Skia 特效層 → RN + Lottie/Rive 預製動畫 → 降級（頭像上限 10、霓虹改為靜態分段圖）。哪一層先過門檻，就採用哪一層
5. 激勵廣告 SDK 與同意流程（ATT、UMP）：先過前置關卡，W1–2 再做 spike（用開發版建置，雙平台都要播出測試廣告），並事先寫好備案
6. 數據埋點供應商
7. 音效引擎
8. 時間、換日與防竄改策略
9. 遊戲內容資料（配方、卡牌、攤位）的定義方式
10. 崩潰回報與效能量測工具

### 交接給後續章節

以下規則從本節移出，由指定的章節承接：

- **Implementation Patterns**：React Compiler × Reanimated 的寫法規則。render 階段不讀 shared value；新程式碼用 `.get()`/`.set()`；既有程式在 worklet 內使用的 `.value` 不必改寫；有問題的元件用 `'use no memo'` 豁免；動到手勢或動畫後要在實機上重測。
- **Cross-cutting**：OTA 不得阻塞啟動，以確保離線可玩、冷啟動 ≤ 3 秒；原生模組在 Web 上一律 no-op。
- **Validation**：每個 epic 結束時，在 Pixel 6a 的 release build 上量測冷啟動、切頁時間與 FPS。
