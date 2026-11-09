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

**格式：** `log.<level>(scope, message, data?)`，`scope` 是字面量型別：`'save' | 'ads' | 'audio' | 'telemetry' | 'store' | 'boot' | 'fx'`。

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

**訂閱者**（只有這四個，新增需要更新本文件）：
- `FxController`：負責 Overlay Host 的演出
- `AudioService`
- `Telemetry`
- `HapticsService`（如果有實作）

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

**啟用方式：** 長按設定畫面的版本號 2 秒。只有在 `__DEV__` 或 development / preview profile 才渲染。production profile 透過 `extra.debugTools = false` 加上條件 import，把相關程式碼整段排除。

**效能量測：** 不內建 FPS 覆蓋層。W1–2 的 spike 和每個 epic 的驗收，改用 RN Dev Menu 的 Perf Monitor 做粗略觀察，正式數據則以外部工具在 Pixel 6a 的 release build 上量測（例如 Android GPU 呈現模式分析或 Flashlight）。量測方法在 Validation 章節定稿。
