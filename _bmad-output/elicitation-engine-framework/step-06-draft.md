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
    │   └── collection.tsx                    # 收藏冊（modal）
    ├── game/                                 # 【規則層】純 TS，禁止 import RN/Expo/services
    │   ├── engine.ts                         # 既有：棋盤、訂單、產生器
    │   ├── drop.ts                           # resolveDrop：merge/invent/stack/reject/swap
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
