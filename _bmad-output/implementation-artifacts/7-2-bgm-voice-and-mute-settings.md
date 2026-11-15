---
baseline_commit: 3c86618
---

# Story 7.2: 背景音樂、叫賣語音與靜音設定

Status: done

## Story

As a 玩家,
I want 有循環播放的夜市環境音樂，新一波客人來和完售時聽到叫賣，也可以把聲音關掉,
so that 我在通勤時也能安靜地玩。

## Acceptance Criteria

1. 已有 S7.1 的 AudioService。遊戲在前景時，背景音樂 `bgm-night-market` 循環播放；App 進入背景時暫停，回到前景時繼續。
2. 新一波人龍開始時，從 2 句叫賣中隨機播放一句；完售時在煙火之後播 1 句道謝（共 3 句，FR44；E7 審查決策）。
3. 在 S1.7 的設定畫面加上「音樂」和「音效」兩個開關。設定存在 `merge-night-market/settings`，不寫進遊戲存檔；重新啟動後設定不變。
4. 所有音訊素材都確認是可商用的授權，授權來源記錄在 `art-source/LICENSES.md`。

## 範圍

- 背景音樂與叫賣語音的正式素材還沒交付（E6 retro D2）。這個 story 先用**占位音檔**把程式接好，素材交付後由 `process-e7-audio.py` 處理成同名檔案替換。AC4 在素材交付時完成。

## Tasks / Subtasks

- [x] T1 規則：人龍開新一波時送出 `wave_started { wave, length }`（`queue.ts` 的 `startNextWave`）；`queue-test` 補測
- [x] T2 測試先行：
  - `settings-test.ts`：預設兩個都開；讀取、寫入、壞掉的 JSON 或缺欄位時用預設值；寫入失敗只 `log.warn`。
  - `audio-test`：
    - 背景音樂：首幀後建立、`loop`、音樂開啟且在前景才播放；背景暫停、回前景繼續；關閉音樂時暫停。
    - 叫賣：新一波隨機播一句（隨機數可以注入）；完售播完售叫賣，延遲在煙火之後；音效關閉時不播叫賣。
    - 設定改變即時生效。
  - 設定畫面：兩個開關的狀態與切換。
- [x] T3 `src/services/settings.ts`：zustand store（`music`、`sfx`、`loaded`）、`loadSettings()`、`setMusicEnabled`／`setSfxEnabled`（寫入 AsyncStorage）
- [x] T4 音效服務：背景音樂 player（`loop`、音量 0.35）、叫賣 3 句、訂閱設定；`setSfxEnabled` 改由設定驅動
- [x] T5 設定畫面加上「音樂」「音效」開關；根層啟動時讀取設定
- [x] T6 占位音檔：背景音樂（約 8 秒、可循環）與 3 句叫賣，用 ffmpeg 合成；`audio-manifest` 標成占位
- [x] T7 反向驗證（E6 retro A5）
- [x] T8 驗證：lint、tsc、jest、iOS 打包
- [x] T9 **（使用者）** 實機（2026-11-15 確認通過；正式背景音樂與叫賣語音之後交付，交付時完成 AC4）：
  - 背景音樂循環播放，回桌面時停止、回來時繼續。
  - 新一波與完售時的叫賣。
  - 關閉音樂或音效，重開 App 後設定還在。
  - 找到背景音樂、錄好叫賣後交付。

### Review Findings（E7 程式碼審查，2026-11-15）

- [x] [Review][Decision] AC2 措辭與實作不一致：完售時固定播「voice-sold-out」一句，沒有從 2–3 句隨機挑（Dev Notes 有記錄設計）— 改 AC 措辭，或補完售語音的第二句 — 決策：改 AC 措辭配合實作（已改 AC2 與 epics.md）
- [x] [Review][Patch] `bgmPlaying` 旗標在 iOS 來電中斷、拔耳機後和原生狀態脫節，背景音樂一直不恢復；改看 `player.playing`，播放失敗時還原 [src/services/audio.ts:updateBgm]
- [x] [Review][Patch] 設定讀取完成前切換開關，會被讀到的舊值蓋掉、儲存也可能覆寫另一個欄位；讀取期間的變更要保留 [src/services/settings.ts:loadSettings、save]
- [x] [Review][Patch] settings-test 用 `await Promise.resolve()` 等 AsyncStorage 寫完，依賴 mock 內部的 promise 層數；改用 waitFor [src/services/__tests__/settings-test.ts:38]
- [x] [Review][Defer] 背景音樂用 MP3 循環，接縫處會有編碼器補的空白 [src/services/audio-assets.ts:BGM_ASSET] — deferred，等使用者交付正式背景音樂時一起改成 m4a（AAC gapless）

## Dev Notes

### 目前狀態

- **AudioService**（S7.1，`src/services/audio.ts`）：
  - 首幀之後建立 player，常用音效有多個 player 輪流。
  - `setSfxEnabled` 是模組層的開關，目前沒有接任何設定。
  - 有 AppState 監聽（節奏音用）。
- **人龍**：`syncQueue` 在冷卻結束時呼叫 `startNextWave`，目前不送事件；完售送 `queue_sold_out`。
- **儲存**：遊戲存檔在 `merge-night-market/save`（`services/save.ts`）；設定要用另一個 key `merge-night-market/settings`（架構〈Data Persistence〉）。
- **設定畫面**（`features/settings/settings-screen.tsx`）：只有版本號與除錯資訊。

### 設計

- **`wave_started`**：在 `startNextWave` 送出（syncAll 的熱路徑；只在真的開新一波時才產生新 state）。讀檔時的結算也可能送出，那時音效還沒載入，直接略過，沒有問題。
- **設定**：
  - `{ music: boolean; sfx: boolean }`，預設都開。
  - 讀取失敗、JSON 壞掉或欄位不是 boolean 時用預設值。
  - 寫入失敗只 `log.warn`，畫面上的狀態照樣改。
- **背景音樂**：音量 0.35；只在「音樂開啟、App 在前景、已經載入」時播放。
- **叫賣**：
  - 新一波人龍：從 `voice-call-1`、`voice-call-2` 隨機一句。
  - 完售：`voice-sold-out`，延遲 700 ms 播放，等煙火響過。
  - 叫賣屬於音效，跟著「音效」開關。
  - 隨機數由 `startAudioService({ random })` 注入，方便測試；服務層可以用 `Math.random`。

### 會佔位的機制（E4 retro A3）

沒有。

### Project Context Rules

- 規則層純 TS，事件只由規則層送出。
- 新增 GameEvent 時，FxController 的 switch 有 default，不受影響。
- 換行用 LF；每個新測試都做反向驗證。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2]（FR44）
- [Source: _bmad-output/game-architecture.md]（Data Persistence：`merge-night-market/settings`）
- [Source: docs/audio-manifest.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- RN 的 `AppState.addEventListener` 是 jest mock，被其他測試 spy 再還原後會回傳 `undefined`，後面的測試停止服務時就壞了。現在每個測試前都把它設回「回傳可以移除的訂閱」。
- 背景音樂原本可能在設定讀完前就開始播（上次關掉音樂的玩家會先聽到一下），改成等設定讀完（`loaded`）才決定。
- 反向驗證（E6 retro A5）：
  - 會讓測試失敗的：新一波不送事件、叫賣不隨機、完售道謝沒延後、背景音樂不循環、設定沒讀完就播、背景時仍播、音效關閉仍播、設定欄位型別不檢查、音樂開關沒作用。
  - 「停止時沒清掉延後的叫賣」「停止時沒取消設定訂閱」一開始測不到（player 已清空，聽不到差別）。改成檢查停止後沒有剩下的計時器、取消訂閱函式有被呼叫，之後都會失敗。
- 寫反向驗證腳本時，用 Python 產生含 `
` 的程式字串，寫出的檔案壞掉兩次；已記進 memory，這種檔案改用 Write 工具。

### Completion Notes List

- 規則：`startNextWave` 送出 `wave_started { wave, length }`（新增事件，7.3 埋點也會用）。
- `src/services/settings.ts`：
  - zustand store（`music`、`sfx`、`loaded`），存在 `merge-night-market/settings`，和遊戲存檔分開。
  - JSON 壞掉或欄位型別不對時用預設值（都開）。
  - 讀寫失敗只 `log.warn`。
- 音效服務：
  - 音效（含叫賣）跟著「音效」開關；模組層的 `setSfxEnabled` 移除，改讀設定。
  - 背景音樂：首幀後建立，`loop`、音量 0.35；設定讀完、音樂開啟、在前景時才播；進背景暫停、回前景繼續；開關即時生效。
  - 叫賣：新一波隨機一句（亂數可注入）；完售延後 700 ms 道謝；停止時清掉延後的計時器。
- 設定畫面：「音樂」「音效」兩個開關。根層啟動時 `loadSettings()`。
- 占位音檔（`art-source/scripts/make-placeholder-e7-2.py`）：背景音樂 8 秒五聲音階琶音（可循環）；3 句叫賣是不同的音型（不是人聲）。AC4 等正式素材交付時完成。
- 驗證：
  - jest 49 suites／777 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功，16 個 mp3 已打包。

### File List

- `src/game/queue.ts`、`src/game/events.ts`、`src/game/__tests__/queue-test.ts`
- `src/services/settings.ts`、`src/services/__tests__/settings-test.ts`（新增）
- `src/services/audio.ts`、`audio.web.ts`、`audio-map.ts`、`audio-assets.ts`、`__tests__/audio-test.ts`
- `src/features/settings/settings-screen.tsx`、`__tests__/settings-screen-test.tsx`（新增）
- `src/app/_layout.tsx`
- `assets/audio/bgm-night-market.mp3`、`voice-call-1.mp3`、`voice-call-2.mp3`、`voice-sold-out.mp3`（占位，新增）
- `art-source/scripts/make-placeholder-e7-2.py`（新增）
- `docs/audio-manifest.md`

## Change Log

- 2026-11-15：S7.2 實作完成（背景音樂、叫賣、音樂與音效開關、`wave_started`），先用占位音檔；狀態改為 review，等實機確認與正式素材（T9）。
- 2026-11-15：使用者實機確認通過（T9）；正式背景音樂與叫賣語音之後補上，屆時以 `process-e7-audio.py` 處理並完成 AC4。
- 2026-11-15：E7 程式碼審查（三層依序）；決策 1 項、修正 3 項、延後 1 項，狀態改為 done。
