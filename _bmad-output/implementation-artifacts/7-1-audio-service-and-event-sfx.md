---
baseline_commit: 7604ef9
---

# Story 7.1: 音效服務與事件音效

Status: done

## Story

As a 玩家,
I want 合成時聽到「滋～」的油鍋聲越炸越響，出餐有收銀機聲，拉鐵捲門、招牌通電、完售煙火也都有聲音,
so that 每一個動作都有夜市的手感。

## Acceptance Criteria

1. `src/services/audio.ts` 與 `audio.web.ts`（no-op），使用 expo-audio 58。App 啟動後，用 `createAudioPlayer` 預載約 12 個音效，並排入分段預載的第一段。
2. `setAudioModeAsync`：iOS 靜音開關打開時不發聲，並和其他 App 的音訊混音。
3. AudioService 訂閱 GameEvent，對應如下：
   - `item_merged`：合成音效；炸物鏈用油鍋聲，`playbackRate` 隨階數遞增
   - `order_completed`：收銀機
   - `stall_reopened`：鐵捲門
   - `stall_upgraded`：招牌通電「嗡」
   - `queue_sold_out`：煙火
   - `dish_invented`：第一次發明播鑼聲；已發現的配方再做出來時播合成音（E7 審查決策）
   - `invent_rejected`：輕的否定音
4. 人龍剩最後 3 人時，計量條的節奏音效加快（補完 Story 2.2）。
5. 音效載入或播放失敗時只記 `log.warn`，靜默跳過，不影響遊戲。
6. 在 iPhone 實機上連續快速合成時，拖曳仍維持 60 FPS。Android 效能統一在 S7.6 前複驗（E1 retro）；S7.6 依 E6 retro D1 延後。

## 範圍

- **正式音訊素材由使用者下載**（E6 retro D2，`docs/audio-manifest.md`）。這個 story 先用程式產生的**占位音效**把服務接好；素材交付後替換檔案，程式不必改。
- 靜音設定在 S7.2；這裡先留好「整體開關」的入口（`setSfxEnabled`）。

## Tasks / Subtasks

- [x] T1 安裝 `expo-audio`（`npx expo install`，SDK 58 相容版 58.0.12；它內建在 Expo Go 裡，只播放不需要 config plugin）
- [x] T2 占位音效：`art-source/scripts/make-placeholder-sfx.py` 產生 12 個短 WAV（不同音色，炸物是嘶嘶的雜訊），放進 `assets/audio/`；audio-manifest 標成「占位」
- [x] T3 測試先行：
  - `audio-test.ts`：`soundForEvent` 的對應（含炸物的速度與音量隨階數遞增、上下限）、`tickInterval`（剩 3／2／1 人）
  - 服務：只在首幀之後才預載；`setAudioModeAsync` 參數；事件播放；載入或播放失敗只 `log.warn` 一次、不丟例外；停用時不播；停止後不再反應
  - 節奏音：最後 3 人時依剩餘人數加快、冷卻或不在最後 3 人時停止、App 在背景時不播
- [x] T4 `src/services/audio-assets.ts`（音效 id → `require`）、`src/services/audio.ts`（`startAudioService`，回傳停止函式）、`audio.web.ts`（no-op）
- [x] T5 根層 `_layout.tsx` 啟動 AudioService；預載排在首幀之後（E6 retro A3：不拖慢冷啟動）
- [x] T6 反向驗證（E6 retro A5：每個新測試都要做）
- [x] T7 驗證：lint、tsc、jest、iOS 打包；比較冷啟動「棋盤第一次畫出來」（E6 基準 195 ms）
- [x] T8 **（使用者）** 實機：
  - 聽每個事件的音效。
  - 炸物越合越高。
  - 靜音開關打開時不出聲。
  - 開著音樂 App 時兩邊可以同時發聲。
  - 連續快速合成時拖曳不卡。
  - 人龍最後 3 人的節奏音。

### Review Findings（E7 程式碼審查，2026-11-15）

- [x] [Review][Decision] AC3 措辭與實作不一致：`dish_invented` 只有第一次發明播鑼聲，之後播合成音（Dev Notes 有記錄理由）— 改 AC 措辭，或改成每次都播鑼聲 — 決策：改 AC 措辭配合實作（已改 AC3 與 epics.md）
- [x] [Review][Patch] App 在背景時仍會呼叫 play：事件音效、完售語音的延遲計時器沒檢查前景；play 檢查前景即可擋住兩者 [src/services/audio.ts:play]
- [x] [Review][Patch] 最後衝刺連續快速出餐時，節奏音每次被重設，可能一聲都不響；換節奏時要保留相位（距上一聲已超過新間隔就立刻響） [src/services/audio.ts:tick]
- [x] [Review][Patch] stop 之後，還在等 seekTo 的 then 仍會對已釋放的 player 呼叫 play；加 stopped 旗標 [src/services/audio.ts:play]
- [x] [Review][Patch] process-e7-audio.py：ffmpeg 失敗或全靜音時 `re.search(...).group` 丟 AttributeError，改成清楚的錯誤訊息 [art-source/scripts/process-e7-audio.py:53]
- [x] [Review][Defer] 首幀後同一個 callback 同步建立約 26 個 player（AC1 寫約 12 個並排入分段預載）；實機量測 +234 ms 沒有退步 [src/services/audio.ts:load] — deferred，等 E8 效能預算（A8）時改成分批或延遲建立
- [x] [Review][Defer] `mixWithOthers` 會讓背景音樂疊在玩家自己的音樂上（AC2 指定此模式） [src/services/audio.ts:setAudioModeAsync] — deferred，上架前評估「其他 App 在播就不播背景音樂」
- [x] [Review][Defer] 服務層的音訊與 SDK 調校常數沒有放在 `src/game/content/` [src/services/audio-map.ts、audio.ts、telemetry.ts] — deferred，屬調校值而非遊戲數值，project-context 規則要不要加例外留到 retro

## Dev Notes

### 目前狀態

- **事件**（`src/game/events.ts`）：`item_merged`、`order_completed`、`queue_sold_out`、`dish_invented { first }`、`invent_rejected`、`card_starred`、`hint_shown`、`stall_reopened`、`stall_upgraded`、`ad_rewarded`。
- **訂閱者模式**：FxController（`features/overlays/fx-controller.ts`）在 `_layout` 啟動並回傳停止函式。訂閱者只讀，出錯由 `gameEvents.setErrorHandler` 記 `log.error`（game-session）。
- **人龍最後 3 人**：`isQueueFinalStretch(queue)`（`queue.ts`）；計量條在 S2.2 已經會閃爍。
- **啟動量測**：`markStartup`（E6 retro A3）；App 自己的部分約 195 ms，Expo Go 的冷啟動約 3 秒主要花在 JS 之前。

### 設計

- **對應表**（純函式 `soundForEvent`，方便測試）：
  - `item_merged`：炸物用 `sfx-merge-fried`，速度 `1 + 0.08 × (階數 − 2)`、音量 `0.6 + 0.06 × (階數 − 2)`，速度限制在 0.9–1.5、音量上限 1。其他鏈用 `sfx-merge`。
  - `order_completed` → `sfx-cash`；`stall_reopened` → `sfx-shutter`；`stall_upgraded` → `sfx-neon`；`queue_sold_out` → `sfx-fireworks`；`invent_rejected` → `sfx-reject`。
  - `dish_invented`：第一次發明 → `sfx-gong`。已發現的配方又做出一份 → `sfx-merge`，鑼聲太隆重，不適合每次都播。
  - 另外三個（約 12 個的其餘部分，audio-manifest 有列）：`card_starred` → `sfx-star`；`hint_shown` → `sfx-hint`；`ad_rewarded` → `sfx-reward`。
- **播放**：每個音效一個 player。重播時 `seekTo(0)` 再 `play()`。炸物的 player 設 `shouldCorrectPitch = false`，速度變快時音高跟著升高。
- **預載時機**：`startAudioService` 先訂閱事件，`requestAnimationFrame` 之後才設定音訊模式與建立 player。預載完成前的事件直接略過。
- **節奏音**：訂閱 store 的人龍狀態，最後 3 人時用計時器播 `sfx-queue-tick`，間隔依剩餘人數：3 人 900 ms、2 人 650 ms、1 人 420 ms。冷卻中、不在最後 3 人、App 在背景時停止。
- **失敗**：建立 player、播放、設定模式都包在 try/catch。每個音效只 `log.warn` 一次，避免連續合成時洗版。

### 會佔位的機制（E4 retro A3）

沒有。節奏音計時器在離開最後 3 人、App 進背景或服務停止時清掉。

### Project Context Rules

- 服務層可以 import `@/game`（store、events），但規則層不能 import 服務。
- 服務的 web 版用 `.web.ts` 檔，Metro 會自動選擇。
- 新增套件一律用 `npx expo install`。
- 換行用 LF。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1]
- [Source: docs/audio-manifest.md]
- [Source: epic-6-retro-2026-11-12.md]（D1、D2、A3、A5）
- expo-audio 58 型別定義（`node_modules/expo-audio/build/*.d.ts`）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- `root-error-boundary-test` 會載入整個 `_layout`，jest 裡沒有 expo-audio 的原生模組。在 `jest.setup.js` 加上全域的假 player；`audio-test` 用自己的 mock 檢查呼叫內容。
- 測試裡每個 `require` 的音檔都回傳同一個值，不能用來源區分 player。改成在假的 `createAudioPlayer` 裡依呼叫順序記下音效 id。
- 反向驗證（E6 retro A5，每個新測試都做）：
  - 油鍋聲速度沒有上限、每次發明都敲鑼、剩 1 人沒加快、沒等首幀就預載、靜音開關打開也發聲、油鍋聲做音高校正、每次失敗都 warn、停止時沒釋放 player、背景也播節奏音、沒設定播放速度、音效關閉仍然播放、停止時沒取消訂閱。
  - 以上都會讓測試失敗。
  - 「停止後仍然播放」的 `stopped` 檢查測不到：停止時已經取消訂閱、清空 player，那道檢查走不到，所以拿掉。「沒取消訂閱」原本也測不到，改成直接檢查取消訂閱的函式有被呼叫。
- 安裝 expo-audio 後，`expo-doctor` 提示缺少它的 peer dependency `expo-asset`，用 `npx expo install` 補上。兩者只播放、不錄音，不需要 config plugin（專案用 `app.config.ts`，安裝程式提示的 plugin 沒有加）。
- `expo-doctor` 另外有 8 個 Expo 套件的修補版落差（expo 58.0.23 → 58.0.25 等），不是這次造成的。使用者決定執行 `npx expo install --fix`：套件都升級了，之後 `expo-doctor` 20 項全過。指令最後的錯誤是它想把 plugin 寫進設定檔，但專案用 `app.config.ts` 沒辦法自動修改；再跑一次顯示已是最新。

### Completion Notes List

- `src/services/audio-map.ts`（純函式，原生版與網頁版共用）：
  - `soundForEvent`：10 種事件對應 12 個音效。炸物合成用油鍋聲，速度 `1 + 0.08 × (階數 − 2)`（0.9–1.5）、音量 `0.6 + 0.06 × (階數 − 2)`（上限 1）。第一次發明敲鑼，又做出一份用合成音。
  - `tickInterval`：最後 3 人 900／650／420 ms。
- `src/services/audio.ts`：
  - `startAudioService`：事件訂閱馬上生效；`requestAnimationFrame` 之後才設定音訊模式並建立 12 個 player（不拖慢冷啟動）。
  - 音訊模式：`playsInSilentMode: false`（遵守 iOS 靜音開關）、`interruptionMode: 'mixWithOthers'`。
  - 油鍋聲的 player 設 `shouldCorrectPitch = false`，速度變快時音高跟著升高。
  - 失敗處理：每個音效只 `log.warn` 一次，不丟例外。
  - 節奏音：最後 3 人依剩餘人數加快；冷卻中、App 在背景時停止。
  - `setSfxEnabled` 給 S7.2 的設定畫面用。
  - 網頁版 `audio.web.ts` 是 no-op。
- `src/services/audio-assets.ts`：12 個音效 id 與檔案。
- 占位音效：`art-source/scripts/make-placeholder-sfx.py`，只用標準函式庫產生 12 個短 WAV（共約 408 KB），放在 `assets/audio/`。正式素材交付後替換同名檔案即可。
- 根層 `_layout.tsx` 啟動音效服務。
- **正式音效（2026-11-15）**：使用者交付 11 個 Pixabay 音效與 Kenney Interface Sounds（CC0）。
  - `art-source/scripts/process-e7-audio.py`（ffmpeg 由 `imageio-ffmpeg` 透過 uv 臨時提供）處理流程：去開頭靜音 → 截取 → 淡出 → 單聲道 mp3 96 kbps → 依平均音量調整。
  - limiter 壓在 −4 dB（mp3 編碼的瞬間過衝約 2–3 dB），輸出的實際峰值都在 −1.4 dB 以下。
  - 合成的「啵」用 Kenney `pluck_001`。
  - 12 個 mp3 共 196 KB，取代占位的 wav（占位腳本已刪除）。
  - 授權記在 `art-source/LICENSES.md`；Pixabay 來源是依檔名推定，請使用者確認。
  - 新增測試：每個音效 id 都有對應的 mp3。
- **實機回饋：連續合成時有時沒聲音。**
  - 原因：每個音效只有一個 player，上一次還在播時又觸發，`seekTo(0)` 與 `play()` 同時呼叫會互相干擾，那一次就被吞掉。
  - 修正：常連續觸發的音效準備一組 player 輪流用（`poolSize`：合成與油鍋聲 4 個；出餐、節奏音、領獎勵、否定音 2 個；其他 1 個）；每次都等 `seekTo(0)` 完成後才 `play()`。
  - 測試：連續 6 次合成分給 4 個 player；`seekTo` 沒完成前不播放。
  - 反向驗證：只有一個 player、沒有輪流、沒等回到開頭、停止時只釋放每組的第一個，都會讓測試失敗。
- 驗證：
  - jest 47 suites／754 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功，wav 已打包進去（`metadata.json`）。
  - 冷啟動比較待實機量（T8）。

### File List

- `src/services/audio.ts`、`audio.web.ts`、`audio-map.ts`、`audio-assets.ts`（新增）
- `src/services/__tests__/audio-test.ts`（新增）
- `src/app/_layout.tsx`
- `assets/audio/sfx-*.mp3`（12 個音效，新增）
- `art-source/scripts/process-e7-audio.py`（新增）、`art-source/audio/`（原始素材）、`art-source/LICENSES.md`
- `jest.setup.js`（expo-audio 的全域 mock）
- `package.json`、`package-lock.json`（expo-audio、expo-asset；`npx expo install --fix` 升級 8 個 Expo 套件的修補版）
- `docs/audio-manifest.md`（進度）

## Change Log

- 2026-11-15：S7.1 實作完成（音效服務、事件對應、炸物變調、節奏音、占位音效），狀態改為 review，等實機確認（T8）。
- 2026-11-15：換上使用者交付的正式音效（處理腳本、授權紀錄）；`npx expo install --fix` 升級 8 個 Expo 套件的修補版。
- 2026-11-15：實機回饋修正：連續合成時有時沒聲音（player 輪流用、等回到開頭才播放）。
- 2026-11-15：使用者實機確認通過（T8）。
- 2026-11-15：E7 程式碼審查（三層依序）；決策 1 項、修正 4 項、延後 3 項，狀態改為 done。
