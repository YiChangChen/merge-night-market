---
baseline_commit: 4fbd6a0
---

# Story 7.3: 數據埋點（PostHog）

Status: done

## Story

As a 開發者,
I want 匿名收集攤位、完售、發明、提示、升星、廣告等事件，並計算留存,
so that 封閉測試和上架後，我知道玩家在哪裡卡住、為什麼沒有回來。

## Acceptance Criteria

1. `src/services/telemetry.ts` 與 `telemetry.web.ts`（no-op），使用 posthog-react-native 4.85（實際安裝 4.86.0，`npx expo install` 選的 SDK 58 相容版）。App 首幀之後完成初始化。
2. Telemetry 訂閱 GameEvent，用同樣的 `type` 名稱送到 PostHog，屬性維持扁平結構（FR45）。
3. 另外補送：
   - `app_open`（附上距離首次啟動的天數）
   - `tutorial_step`
   - `ad_shown`
   - `ad_rewarded`
   
   用來支援 D1／D7／D30 留存，以及 GDD 指標：「第 1 天第一次升級率」「第 3 天首次發明率」「每位 DAU 每日看廣告數」。
4. 關閉自動擷取（screen、觸控）；只使用匿名 ID，不收集任何個資。
5. 離線時由 SDK 暫存，連上網路後批次送出；初始化失敗時靜默降級。
6. API key 從 `extra.posthogKey` 讀取；每個事件附上 `env`（建置 profile），報表篩選 production；開發與測試的資料也送進同一個專案（E7 審查決策：目前只能用 Expo Go 測試）。
7. 在 PostHog 建好留存與漏斗報表，報表連結記錄在 README。

## Tasks / Subtasks

- [x] T1 安裝 `posthog-react-native`，以及 `expo-file-system`、`expo-application`、`expo-device`、`expo-localization`（PostHog 的 Expo 安裝方式；都內建在 Expo Go 裡）。`expo-doctor` 要全過
- [x] T2 設定：`app.config.ts` 加上 `posthogHost`（`POSTHOG_HOST`，預設 US）；`config.ts` 讀 `posthogKey`／`posthogHost`，**只接受 `phc_` 開頭的 key**（Project API Key），其他一律視為沒有 key、停用埋點
- [x] T3 測試先行 `telemetry-test.ts`：
  - `eventProperties` 扁平化（陣列轉成數量與逗號字串）
  - `daysSinceFirstLaunch`
  - 沒有 key 或 key 不是 `phc_` 時不初始化
  - 首幀之後才初始化，選項是：不擷取 App 生命週期、不擷取 geoip、`personProfiles: 'never'`、`persistence: 'file'`
  - GameEvent 用同名送出
  - 讀檔完成後送一次 `app_open`
  - 教學步驟改變時送 `tutorial_step`
  - `trackAdShown` 送 `ad_shown`
  - 初始化或送出失敗只 `log.warn`
  - 停止時取消訂閱並 `flush`
- [x] T4 `src/services/telemetry.ts`（`startTelemetry`、`trackAdShown`）、`telemetry.web.ts`（no-op）；`ads.ts` 在播放廣告時呼叫 `trackAdShown`；根層啟動
- [x] T5 jest 全域 mock（`posthog-react-native`）
- [x] T6 反向驗證（E6 retro A5）
- [x] T7 驗證：lint、tsc、jest、iOS 打包；比較冷啟動
- [x] T8 **（使用者）**
  - `.env.local` 換成 `phc_` 開頭的 Project API Key，告訴我資料區域（US／EU）。
  - 實機玩一下，到 PostHog 後台的 Activity 看到事件。
  - 在 PostHog 建立留存（D1／D7／D30）與漏斗報表，連結寫進 README（AC7）。
  - 量 iPhone 效能數字（E6 retro A8）。

### Review Findings（E7 程式碼審查，2026-11-15）

- [x] [Review][Decision] AC6：development profile 沒有任何限制，Expo Go 的資料直接進正式專案 730825；但目前只能用 Expo Go 測試（E6 retro D1）— 送出但標記環境、另開測試專案，或開發時預設不送 — 決策：送出但每個事件附 `env`，已改 AC6 與 epics.md
- [x] [Review][Decision] AC4：`disableGeoip` 只擋地理解析，IP 仍會存在 `$ip`；要在 PostHog 專案設定開「Discard client IP data」（使用者操作）。SDK 自動附的 `$device_name`（Android 可能含使用者取的名字）、`$locale`、`$timezone` 是否接受 — 決策：使用者在 PostHog 開啟丟棄 IP；查 SDK 原始碼確認 `$device_name` 是 expo-device 的 modelName（機型），不含使用者取的名字，不需改程式
- [x] [Review][Decision] 每個 GameEvent 都送，含高頻的 `item_merged`；免費額度每月 1M 事件 — 全送，或排除 `item_merged` — 決策：排除 `item_merged`（`EXCLUDED_EVENTS`）
- [x] [Review][Patch] iOS 進背景後，背景寬限期內的 store 更新會在背景送出 app_open，玩家真正回來時反而不送，留存少算；只在前景送 [src/services/telemetry.ts:trackAppOpen]
- [x] [Review][Patch] 教學一次跳兩步時，中間那一步的 tutorial_step 不送；步驟倒退（除錯面板開新局、匯入）後會重複送；改成逐步補送、只送超過最高紀錄的步驟 [src/services/telemetry.ts:tutorial_step]
- [x] [Review][Patch] AC3「第 1 天第一次升級率」「第 3 天首次發明率」缺天數依據：每個事件都附 `days_since_first_launch` [src/services/telemetry.ts:capture]
- [x] [Review][Patch] `posthog-react-native` 版本範圍用 `^`，改成 `~` 與其他套件一致 [package.json:25]
- [x] [Review][Defer] 接上真的 AdMob 後，Android 全螢幕廣告會讓 AppState 進出背景，多送 app_open、背景音樂停一下 [src/services/telemetry.ts、audio.ts] — deferred，7.4–7.7 接真廣告時處理
- [x] [Review][Defer] 設定畫面沒有「分析資料」開關 [src/features/settings/settings-screen.tsx] — deferred，上架前隱私權政策與商店隱私標籤一起評估

## Dev Notes

### 目前狀態

- `app.config.ts` 已經注入 `extra.posthogKey`（`POSTHOG_KEY`，S1.1）。
- `.env.local` 已設定 `POSTHOG_KEY`。不過值是 `phs_` 開頭的 **Secret API Key**，不能打包進 App，已經請使用者換成 `phc_` 開頭的 Project API Key。程式只接受 `phc_`，避免放錯 key 時把密鑰打包出去。
- GameEvent 訂閱者有三個：FxController、AudioService，以及這次的 Telemetry；訂閱者只讀事件。
- 事件目前共 11 種：`item_merged`、`order_completed`、`queue_sold_out`、`wave_started`、`dish_invented`、`invent_rejected`、`card_starred`、`hint_shown`、`stall_reopened`、`stall_upgraded`、`ad_rewarded`。
- 廣告：`src/services/ads.ts` 是假的實作（E5 retro D1），`show` 是唯一的播放入口。

### 設計

- **初始化**：
  - 在首幀之後（`requestAnimationFrame`）建立 `new PostHog(key, options)`，避免拖慢冷啟動（E6 retro A3）。
  - 初始化之前的事件不送，直接略過（只有讀檔時的結算可能產生事件，數量很少）。
- **選項**：
  - `host`：預設 `https://us.i.posthog.com`，用 `POSTHOG_HOST` 設定。
  - `captureAppLifecycleEvents: false`：自己送 `app_open`。
  - 不使用 `PostHogProvider`，所以沒有畫面與觸控的自動擷取。
  - `persistence: 'file'`：離線暫存。
  - `disableGeoip: true`、`personProfiles: 'never'`：只用匿名 ID，不建立個人資料。
  - `flushAt: 20`、`flushInterval: 30000`。
- **屬性扁平化**：
  - 事件物件去掉 `type`，其餘是數字、字串、布林就照送。
  - 陣列（`invent_rejected.recipes`）改成 `recipes`（逗號字串）和 `recipes_count`。
- **`app_open`**：
  - store 讀檔完成（`status: ready`）後送一次，`days_since_first_launch = floor((now − firstLaunchAt) / 1 天)`。
  - App 從背景回到前景時也送一次，D1／D7 留存才算得出來。
- **`tutorial_step`**：訂閱 store，`meta.tutorialStep` 變大時送 `{ step }`。讀檔時的第一次不算改變。
- **`ad_shown`**：`ads.show` 開始播放時送 `{ placement }`。`ad_rewarded` 本來就是 GameEvent。
- **失敗**：建立或送出時的例外都包起來，只 `log.warn('telemetry', …)` 一次。

### Project Context Rules

- 服務層可以用 `Date.now`；規則層不行。
- 新增套件一律用 `npx expo install`。
- 機密不進版控；`.env.local` 已經被 git 忽略。
- 換行用 LF；每個新測試都做反向驗證。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3]（FR45）
- [Source: epic-6-retro-2026-11-12.md]（A3、A7、A8）
- posthog-react-native 4.86.0 型別定義（`node_modules/posthog-react-native/dist/posthog-rn.d.ts`）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- `.env.local` 的 `POSTHOG_KEY` 是 `phs_` 開頭的 Secret API Key。我只檢查了前 4 個字元與長度，沒有讀取或印出完整的值。
  - 原本的 `app.config.ts` 不管是什麼 key 都會注入 `extra`，只要啟動 Expo 就會送到手機上。
  - 修正：`app.config.ts` 與 `config.ts`（`resolveTelemetry`）都只接受 `phc_` 開頭的 key。
  - 確認目前 `expo config --type public` 與 iOS 打包結果裡都找不到 `phs_`。
- 測試裡載入 `app.config.ts` 時，用 `jest.isolateModules` 加 `jest.requireActual`，避免 lint 的 no-require-imports 警告。
- 反向驗證（E6 retro A5）：以下 12 項都會讓測試失敗。
  - app.config 注入任何 key、執行期接受任何 key
  - 擷取 geoip、建立個人資料
  - 沒等首幀就初始化
  - 陣列沒有數量
  - app_open 重複送、回到前景不算新的一次開啟
  - 教學步驟沒變也送
  - 每次失敗都 warn
  - 停止時沒取消訂閱
  - 沒有廣告也送 ad_shown

### Completion Notes List

- `src/services/telemetry.ts`：
  - `startTelemetry`：沒有 `phc_` key 時什麼都不做；首幀之後才建立 PostHog。
  - PostHog 選項：
    - 不擷取 App 生命週期、不用 Provider，所以沒有畫面與觸控的自動擷取。
    - `persistence: 'file'`：離線暫存。
    - `personProfiles: 'never'`、`disableGeoip: true`：只用匿名 ID。
    - `flushAt` 20、`flushInterval` 30 秒。
  - 送出的事件：
    - GameEvent 同名送出，屬性扁平；陣列改成逗號字串加 `_count`。
    - `app_open`（`days_since_first_launch`）：讀檔完成送一次；進背景時先 flush，回到前景算新的一次。
    - `tutorial_step`：教學步驟變大時送。
    - `trackAdShown`：送 `ad_shown`。
  - 送出或初始化失敗只 `log.warn` 一次；停止時取消訂閱並 flush。
  - 網頁版 `telemetry.web.ts` 是 no-op。
- `ads.show`：真的開始播放時呼叫 `trackAdShown`。
- 設定：`app.config.ts` 新增 `posthogHost`（`POSTHOG_HOST`，預設 `https://us.i.posthog.com`）；`config.telemetry` 由 `resolveTelemetry` 決定。
- 套件：`posthog-react-native` 4.86.0，以及 `expo-file-system`、`expo-application`、`expo-device`、`expo-localization`（`npx expo install`）。`expo-doctor` 20 項全過。
- jest 全域 mock：`posthog-react-native`。
- 驗證：
  - jest 51 suites／800 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功。
- T8（使用者，2026-11-15 完成）：
  - `.env.local` 已換成 `phc_` 的 Project API Key，資料區域 US。
  - 實機事件已送進 PostHog；留存與新手漏斗報表已建立，連結寫在 README（AC7）。
  - iPhone 效能（Expo Go，加入埋點後）：JS 開始到棋盤畫出來 +234 ms（根畫面 +64、存檔讀完 +120），與 7.3 之前的 195–239 ms 相同，埋點沒有拖慢啟動；分頁切換 5 次中位數 45 ms。

### File List

- `src/services/telemetry.ts`、`telemetry.web.ts`（新增）
- `src/services/__tests__/telemetry-test.ts`、`app-config-test.ts`（新增）
- `src/services/config.ts`、`src/services/__tests__/config-test.ts`
- `src/services/ads.ts`、`src/services/__tests__/ads-test.ts`
- `src/app/_layout.tsx`
- `app.config.ts`
- `jest.setup.js`
- `package.json`、`package-lock.json`
- `README.md`（報表連結）

## Change Log

- 2026-11-15：S7.3 實作完成（PostHog 埋點、只接受 phc_ key 的防護），狀態改為 review，等使用者設定正確的 key 與實機確認（T8）。
- 2026-11-15：T8 完成（實機事件進 PostHog、報表連結寫進 README、效能數字記錄）。
- 2026-11-15：E7 程式碼審查（三層依序）；決策 3 項、修正 4 項、延後 2 項，狀態改為 done。
