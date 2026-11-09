## Architectural Decisions

### Decision Summary

| # | 類別 | 決策 | 版本 | 理由 |
|---|---|---|---|---|
| 1 | 狀態管理 | Zustand 薄殼包住純函式規則引擎，元件以 selector 訂閱 | zustand 5.1.0 | 兩個分頁常駐，必須按切片訂閱，避免拖曳時連帶重繪夜市街；規則引擎維持純函式 |
| 2 | 存檔 | 單一 JSON key + 遷移鏈 + v1 原檔備份 | AsyncStorage 2.2.0 | 存檔小於 20 KB；單一 key 天然具原子性；遷移可測試 |
| 3 | 導覽 | Expo Router Tabs（兩頁常駐、freezeOnBlur）+ 收藏冊 modal 路由 + 根層 Overlay Host | expo-router ~58 | 切換 ≤ 300 ms；全螢幕演出不污染導覽堆疊 |
| 4 | 夜市街渲染 | W1–2 決策閘門（見 Engine & Framework #4）；本節只定元件骨架 | — | 等量測數據出來再決定 |
| 5 | 激勵廣告 | Google Mobile Ads（AdMob）+ UMP + ATT，包在 `AdService` 介面後面 | react-native-google-mobile-ads 17.4.0、expo-tracking-transparency 58.0.2 | 有官方 Expo plugin；v17 符合 RN 0.88 + New Architecture；之後可在 AdMob 後台開 mediation |
| 6 | 埋點 | PostHog | posthog-react-native 4.85.3 | 無額外原生依賴；內建留存報表 |
| 7 | 崩潰回報 | Sentry | @sentry/react-native 8.34.0 | 直接提供 crash-free sessions 指標 |
| 8 | 時間與換日 | 固定以 UTC+8 午夜換日；計時一律存絕對時間戳；裝置時鐘倒退時不重置、不延長 | — | 不受時區影響；沿用 syncEnergy 的既有策略 |
| 9 | 內容資料 | TS 常數模組（`as const satisfies`）+ 資料完整性 Jest 測試 | — | 沿用 content.ts；型別安全；美術直接用 require |
| 10 | 素材載入 | 分段預載：splash 期間載棋盤素材，首幀後利用閒置時間載夜市街；WebP、限制最大尺寸 | expo-image ~58 | 冷啟動 ≤ 3 秒、切換 ≤ 300 ms |
| 11 | 音效 | `AudioService`：啟動時預載音效、背景音樂循環播放、尊重靜音開關 | expo-audio 58.0.11 | 第一方套件；expo-av 已停止維護 |
| 12 ⚠️ | 遊戲事件 | 規則引擎在 state 上產生暫態 `events`，store 分派給 FX、音效、埋點後清空，不寫入存檔 | — | 演出、音效、埋點共用同一個來源，不必再比對前後 state |
| 13 ⚠️ | 拖放判定 | 純函式 `resolveDrop(source, target, state)` 回傳 `merge` / `invent` / `stack` / `reject` / `swap` 其中之一 | — | GDD 的三種結果加上疊加，全部集中在一處判定，可窮舉測試 |
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
  collection.tsx        收藏冊（presentation: 'modal'）
```

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

### Architecture Decision Records

- **ADR-01 規則引擎保持純函式，store 只是薄殼**：所有遊戲規則都能用 Jest 窮舉測試。渲染與服務層可以替換。這是既有程式碼已經證明可行的做法。
- **ADR-02 遷移失敗時絕不覆寫存檔**：老玩家的進度比任何功能都重要；寧可停在錯誤畫面，也不能用新局蓋掉舊檔。
- **ADR-03 演出、音效、埋點共用 GameEvent**：取代「比對前後 state」的推論方式（findMerges、findSpawns 保留給既有的棋盤動畫使用）。新功能一律從事件取得訊號，同一件事只定義一次。
- **ADR-04 廣告、埋點、崩潰回報一律包在服務介面後面**：web 版用 no-op；換供應商時只需要改一個檔案；規則引擎完全不知道這些服務存在。
- **ADR-05 衍生值不存檔**：星等、人龍長度上限、加成、體力上限都即時計算，數值調整不需要再寫一次遷移。
