# Deferred Work

## Deferred from: code review of 5-3-card-shows-and-signature-stars (2026-11-11)

- 美術腳本 `art-source/scripts/process-e5-art.py` 先把卡面與卡框寫進 `assets/images/cards/`，之後才執行 `check_inset`；檢查失敗時，壞掉的素材已經蓋掉原檔。下次換卡框前，先在記憶體裡檢查，通過後再寫檔。
- 匯入存檔（`save-transfer.ts`，從除錯面板觸發）沒有呼叫 `useOverlayStore.reset()`，和 overlay-store 的註解不一致；這是 E5 之前就有的問題。

## Deferred from: code review of Epic 6（6-1，2026-11-12）

- ~~時鐘曾調到未來時，`daily.dateKey` 會停在未來的日期，次數一直不歸零；反過來往前調一天又能重置次數。~~ **評估完畢，維持現行設計（2026-11-16）**：往前調只會多一次歸零，要再歸零就得調到更後面的日期，總歸零次數不超過經過的日期數；任何「時鐘倒退時重設 dateKey」的做法都會變成可以反覆刷的迴圈。真正擋住要靠伺服器時間，沒有後端就不做。行為由 `daily-test` 的防作弊測試固定。
- ~~`meta.firstLaunchAt` 沒有上限~~ **已處理（2026-11-16）**：`syncFirstLaunch` 在 `syncAll` 裡把未來的首次啟動時間壓回現在，`needsTick` 也會觸發。

## Deferred from: code review of Epic 7（7-1、7-2、7-3，2026-11-15）

- ~~音效預載在首幀後同步建立約 26 個 player~~ **已處理（2026-11-16）**：分批預載，每一幀建立 `LOAD_BATCH`（6）個。
- `interruptionMode: 'mixWithOthers'` 會讓背景音樂疊在玩家自己的音樂上；上架前評估「其他 App 在播就不播背景音樂」。**2026-11-16 查過：expo-audio 58 沒有偵測其他 App 播放的 API**（iOS 要讀 `secondaryAudioShouldBeSilencedHint`，需要原生模組），Expo Go 做不到；等有開發版建置再寫 config plugin 或原生模組。玩家目前可以在設定關掉音樂。
- 服務層的音訊與 SDK 調校常數沒有放在 `src/game/content/`；project-context 規則要不要加例外留到 retro。
- 背景音樂用 MP3 循環會有接縫空白；交付正式背景音樂時改成 m4a（AAC gapless）。
- 接上真的 AdMob 後，Android 全螢幕廣告會讓 AppState 進出背景，多送 app_open、背景音樂停一下；7.4–7.7 處理。
- ~~設定畫面沒有「分析資料」開關~~ **已處理（2026-11-16）**：設定加上「分析資料」開關（關掉會 optOut、不送任何事件）；隱私權政策草稿在 `docs/privacy-policy.md`，上架前要填聯絡資料、補 AdMob／Sentry 段落並放到公開網址（7.7）。
- 7.2 AC4：正式背景音樂（bgm-night-market）與 3 句叫賣由使用者之後交付，目前是占位音檔；交付時用 process-e7-audio.py 處理、刪 make-placeholder-e7-2.py、更新 LICENSES.md 與 audio-manifest。
