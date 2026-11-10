---
project_name: 'merge-night-market'
user_name: 'Admin'
date: '2026-11-08'
sections_completed:
  ['technology_stack', 'engine_rules', 'performance_rules', 'organization_rules', 'testing_rules', 'platform_rules', 'anti_patterns']
status: 'complete'
rule_count: 91
optimized_for_llm: true
---

# Project Context for AI Agents

_本專案 AI agent 實作時必須遵守的關鍵規則。只收錄容易被忽略的細節；完整依據見 `_bmad-output/game-architecture.md`。_

**文件優先序：** `game-architecture.md` 與 `gdd.md` 優先於 `docs/DESIGN.md`。DESIGN.md 是早期文件，其中「iOS 先發」「用 Expo Go 測試」「首版不變現」都已作廢。

---

## Technology Stack & Versions

- Expo SDK 58（`expo ~58.0.22`）、React Native 0.88.1（New Architecture）、React 19.3、TypeScript 6.0（strict）
- expo-router ~58（typedRoutes）、react-native-reanimated 4.7.1 + react-native-worklets 0.13、react-native-gesture-handler ~3.3、expo-image ~58
- React Compiler 已啟用（`experiments.reactCompiler`）
- 狀態：zustand 5.1；存檔：@react-native-async-storage/async-storage 2.2
- 服務：react-native-google-mobile-ads 17.4、expo-tracking-transparency 58、posthog-react-native 4.85、@sentry/react-native 8.34、expo-audio 58
- 測試：Jest 30 + jest-expo ~58
- 平台：iOS 16.4+ / Android 8+（minSdk 26），只支援直式。Web 不是目標平台，只當開發預覽用。
- 版本以 `package.json` 為準。安裝套件一律用 `npx expo install`，不要用 npm/yarn add。

## Critical Implementation Rules

### Engine-Specific Rules

- **規則層**（`src/game/**`）是純 TS：
  - 不得 import `react`、`react-native`、`expo-*`、`@/services`、`@/features`、`@/ui`。
  - 唯一例外是 `store.ts`，它可以 import `zustand`。
- **規則函式**：
  - 簽名固定為 `(state, ...args, now?) => state`，`now` 一律放在最後一個參數。
  - 不合法的操作直接 `return state`，不要 throw，也不要 log。
- **規則層禁用 `Date.now()` 與 `Math.random()`**：
  - 時間一律從參數傳進來。
  - 亂數一律走 `random.ts` 的 seeded RNG，種子存在 state 裡。
- **時鐘倒退時**：只重設計時起點，不發獎勵、不歸零計數，也不拉長冷卻。這是沿用 `syncEnergy` 的做法。
- **元件讀寫 state**：
  - 只能用 selector 訂閱 store 的切片，例如 `useGameStore(s => s.state?.coins)`；物件切片要加 `useShallow`。**不得訂閱整個 state。**
  - 寫入只能透過 `apply(s => rule(s, ..., Date.now()))`。
- **副作用**（演出、音效、埋點）一律訂閱 `GameEvent`：
  - 規則層把事件 push 到 `state.events`。
  - 訂閱者不得同步呼叫 `apply`。
  - `events` 不寫入存檔。
- **Reanimated**：
  - render 中不讀 shared value。新程式碼用 `.get()`/`.set()`；既有 worklet 裡的 `.value` 不必改寫。
  - 從 worklet 回 JS 一律用 `scheduleOnRN`。
  - React Compiler 出問題的元件，在檔案頂部加 `'use no memo'` 並註明原因。
- **不得重構 `features/board/board.tsx` 已調校好的拖曳手勢**（commit e4be9f6）。拖曳過程中的暫態（懸停、抬起）留在 shared value；只有落子結果才呼叫 `applyDrop`。

### Performance Rules

- 目標：在 Pixel 6a 的 release build 上，拖曳與夜市街維持 60 FPS；冷啟動 ≤ 3 秒；分頁切換 ≤ 300 ms。
- **熱路徑不寫 log、不配置大物件、不 `setState`**。熱路徑包括：手勢 callback、worklet、每秒 tick、`syncAll`、render。
- 兩個分頁常駐並設 `freezeOnBlur`。所在分頁失焦時，循環動畫（霓虹、熱氣、人龍）要用 `useIsFocused` 暫停。
- 夜市街與特效一律用**純 RN + Reanimated** 實作（#4 閘門暫定結論，2026-11-09）：
  - 不得引入 Skia、Lottie、Rive。
  - 每攤最多畫 4 個頭像，超過的部分顯示 `+k`。
  - 這是 iPhone 上的暫定結論，Android 中階機複驗沒通過時會改變；改變時以 game-architecture.md 的 #4 為準。
- 素材：
  - 一律 WebP；品項與頭像 ≤ 512px，攤位 ≤ 1024px。
  - `expo-image` 設 `cachePolicy="memory-disk"`。
  - 只能在 `content/*.ts` 或 `services/assets.ts` 裡 `require` 素材。
- 啟動流程不得等待網路：OTA 設 `fallbackToCacheTimeout: 0`；廣告、PostHog、Sentry 都排在首幀之後初始化。

### Code Organization Rules

- 分層：
  - `src/app/`：路由，只負責組裝
  - `src/game/`：規則、內容、store
  - `src/features/<feature>/`：畫面
  - `src/services/`：I/O 與 SDK
  - `src/ui/`：共用元件
- 跨 feature 引用只能透過該 feature 的 `index.ts`。
- 服務的接線（初始化 SDK、訂閱事件）只在 `src/app/_layout.tsx` 的啟動序列中進行。
- 命名：
  - 檔名用 kebab-case。
  - 元件用 PascalCase。
  - 常數表用 UPPER_SNAKE。
  - ID 用 kebab-case 字面量，例如 `'tea-fried'`。
  - `GameEvent.type` 用 snake_case 過去式，例如 `stall_upgraded`，同時作為 PostHog 事件名。
- 平台專屬實作用 `*.web.ts` 後綴。每個原生服務都必須提供 web 版的 no-op。
- 內容與數值只放在 `src/game/content/*.ts`（`as const satisfies`）。元件與服務不得寫死數字或金鑰；金鑰一律透過 `services/config.ts` 讀 `expo-constants` 的 extra。
- 日誌只用 `log.<level>(scope, msg, data)`，`console.*` 會被 lint 擋下。log 不得包含完整存檔或個資。
- 樣式用 `StyleSheet.create`，放在檔案底部，沿用既有寫法。RN 0.88 已移除 `StyleSheet.absoluteFillObject`，一律用 `StyleSheet.absoluteFill`。

### Testing Rules

- 測試放在同層 `__tests__/`，檔名 `<module>-test.ts`。每個規則模式都要有對應測試。
- 測試用固定的 `const NOW = ...` 與固定 seed。用 `withBoard` 這類 helper 建構 state，不要依賴 `createGame` 的隨機結果。
- `drop-test.ts` 要窮舉 `resolveDrop` 的 6 種判定與優先序。
- **只要改到存檔形狀**，同一個 PR 內必須完成三件事：遞增 `version`、新增 `migrations[n]`、新增 `__tests__/fixtures/save-v<n>-*.json`。`migration-test.ts` 要驗證遷移後 `isValidSave` 通過，且金幣、XP、棋盤內容不變。
- `content-test.ts` 要驗證配方、卡牌、素材檔名（等於 `RecipeId`）一一對應。
- 服務層不寫單元測試。規則層不 mock 任何東西，因為它本來就是純函式。
  - 例外：`store.ts` 是規則層與外界的邊界，會自己讀 `Date.now()`，所以 `store-test.ts` 可以用 `jest.spyOn(Date, 'now')` 固定時間。其他規則層函式一律從參數傳入 `now`。
- 畫面元件測試用 `@testing-library/react-native` 14：
  - `render`、`fireEvent.*` 都是 async，一律要 `await`。
  - 放在該 feature 的 `__tests__/`，檔名 `<module>-test.tsx`。
  - 依賴服務層時，用 `jest.mock('@/services/…')` 隔離。
- 路由整合測試用 `expo-router/testing-library` 的 `renderRouter`。**測試檔不得放在 `src/app/`**，因為那裡的每個檔案都會被當成路由。
- **Reanimated 的 Jest 設定**（在 `jest.setup.js`，S1.7）：mock `react-native-worklets`、把 Reanimated 的 `initializers`（含 `.native` 與 `lib/module` 版本）換成空函式，再使用 `react-native-reanimated/mock`。原因是 jest-expo 以 iOS 平台解析，原生初始化會呼叫 JSReanimated 不支援的 `setCSSEventHandler`；原生版 `makeMutable` 搭配 Worklets mock 也沒有 `get`／`set`。動畫在測試裡會直接跳到目標值。
- `jest.setup.js` 已經 mock 了 AsyncStorage 和 gesture-handler；`@/` 別名由 `package.json` 的 `moduleNameMapper` 解析。
  - **陷阱**：AsyncStorage 官方 mock 的方法本身就是 `jest.fn`。要模擬失敗時用 `jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(...)`，**不要 `jest.spyOn` + `mockRestore`**，那會清掉 mock 的實作，讓後面的測試讀不到資料。
- **服務層測試的例外**：存檔的資料安全（先備份再寫入、失敗絕不覆寫）是 NFR5 的核心保證，所以 `src/services/__tests__/save-test.ts` 會用 AsyncStorage mock 驗證。其他服務仍然不寫單元測試。
- **完成定義：** `npx expo lint`、`npx tsc --noEmit`、`npx jest` 全部通過。

### Platform & Build Rules

- 開發一律使用 `expo-dev-client` 開發版建置。
  - 例外（2026-11-09）：使用者目前只有 iPhone，沒有 Mac 和 Apple Developer 付費帳號，所以實機驗證和效能量測暫時用 Expo Go，啟動指令固定為 `npx expo start --go --tunnel --no-dev --minify`。開發模式的路由 bundle 每個 4–7 MB，經過 tunnel 會逾時，手機上會出現 Gateway Timeout，網頁上會出現 Failed to fetch。這個模式下 `__DEV__` 是 false，除錯工具（含分頁切換計時）預設不會出現；要在手機上用除錯面板時，在 `.env.local` 設定 `EXPO_GO_DEBUG_TOOLS=1` 再重開 dev server（E1 retro A1）。量效能時建議關掉，避免除錯工具影響數字。前提是所有原生依賴都是 SDK 對應版本（`npx expo install --check` 沒有警告）。
  - Expo Go **不會**驗證到原生設定（`expo-build-properties`、config plugin、`runtimeVersion`），也不能用 Expo Go 不支援的原生套件（例如 AdMob）。這些要等開發版或 preview 建置再驗證。
- **新增或升級原生依賴時，必須重建開發版**（`npx eas-cli@latest build --profile development`），不能只推 OTA。`runtimeVersion` 採 fingerprint 策略。
- 不得手動建立或修改 `ios/`、`android/`（CNG）。原生設定一律寫在 `app.config.ts` 與 config plugin。
- 新的原生套件要先通過三項檢查才能採用：支援 New Architecture、相容 RN 0.88、`npx expo-doctor` 通過。
- 廣告：
  - development 與 preview 建置一律用 `TestIds.REWARDED`。
  - 啟動順序固定為 UMP → ATT → `mobileAds().initialize()`。
- 除錯面板與存檔匯入匯出只在 `__DEV__` 或 development/preview profile 下渲染。一律讀 `config.debugTools`（`services/config.ts`），它在執行期還會再檢查一次：只有開發模式或 preview 建置才會開啟。所以就算 OTA 更新漏設 `APP_VARIANT`，正式版也看不到除錯工具。唯一例外是 `extra.expoGoDebugTools`：只有在執行期確認是 Expo Go 或 dev client（`ExecutionEnvironment.StoreClient`）時才生效，正式版的執行環境是 standalone，不會符合。
- 只支援直式單手操作，可點擊目標至少 44 pt。

### Critical Don't-Miss Rules

- **拖放結果只能由 `resolveDrop` 判定**。判定順序：move → merge → stack → invent → reject → swap。UI 只能呼叫 `applyDrop`，不得直接呼叫 `movePiece`。
- **獎勵只能在規則層增加**（金幣、體力、XP）。廣告獎勵只能經由 `grantAdReward`，而且只在收到 SDK 的 `EARNED_REWARD` 後呼叫。
- **衍生值不存檔**：星等、人龍上限、攤位加成、貴客率、體力上限一律即時計算。
- 產生器只在 `reopenStall` 時放上棋盤，`applyLevelUps` 不放產生器（RC-1）。訂單只從已開的攤位產生（RC-2）。
- `Order.coins` 在建立時就鎖定，攤位之後升級也不回溯（RC-3）。
- 發明菜的規則：
  - 疊加上限 3 份，多出來的留在原格。
  - 賣出、交付貴客單、Lv3 升級，每次都只扣 1 份；`count` 歸 0 才清空格子。
  - Lv3 的招牌菜由玩家在面板上選。
- 人龍：
  - 波次進行中升級攤位，`length` 與 `remaining` 同時增加 Δ。
  - 冷卻期間升級，要等下一波才生效。
  - 冷卻期間完成的訂單不計入人龍。
  - 線索單不扣人龍。
- 無效的發明嘗試（reject）**不消耗任何東西**，只會讓 `affected` 裡每道未發現配方的 `failures` 各 +1。累積到 5 次時，每道配方只提示一次。
- 換日一律以 **UTC+8** 午夜為準（`dateKeyUTC8`），不使用裝置時區。
- 存檔讀取或遷移失敗時，**絕不覆寫存檔、絕不開新局**。顯示錯誤畫面，保留原檔與 `save.v1.bak`。
- 廣告、音效、埋點失敗時一律靜默降級（隱藏按鈕或不播放），不能讓遊戲流程中斷，也不能卡住玩家。

---

## Usage Guidelines

**給 AI agent：**

- 實作任何遊戲程式碼之前，先讀這份檔案。
- 所有規則都要照文件執行。
- 拿不準時，選比較嚴格的做法。
- 出現新模式時，回頭更新這份檔案。

**給人類：**

- 內容只放 agent 需要的資訊，保持精簡。
- 技術棧有變動時要更新。
- #4 決策閘門有結論後，要更新 Performance Rules。
- 已經變得理所當然的規則就刪掉。

Last Updated: 2026-11-08
