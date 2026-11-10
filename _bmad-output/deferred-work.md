- source_plan: none
  summary: S1.4 Spike B：在雙平台開發版建置播放 AdMob 測試激勵廣告並走完 UMP/ATT（epics.md Story 1.4）
  evidence: 使用者選擇拆分，先做 S1.1；S1.4 依賴 S1.1 的 eas.json 與 app.config.ts，排在 S1.1 之後
  status: E1 retro（2026-11-10）決定移到 Epic 6 開工前做；需要能做開發版建置的環境（Android 裝置或模擬器，或 Apple 付費帳號）
- source_plan: none
  summary: S1.3 Spike A：夜市街效能閘門原型與 Pixel 6a 量測（epics.md Story 1.3）
  evidence: 使用者選擇拆分，先做 S1.1；S1.3 依賴 S1.1 的 preview profile，排在 S1.4 之後
  status: 第一階段已完成（2026-11-09，iPhone 暫定通過，純 RN）；第二階段見下一筆
- source_plan: _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md
  summary: Spike A 第二階段：在 Android 中階機上複驗夜市街效能（release build、Flashlight、adb；FPS、冷啟動、記憶體）
  evidence: 使用者目前只有 iPhone，沒有 Mac 和 Apple Developer 付費帳號；第一階段在 iPhone 上量到 UI／JS 60 FPS、卡頓 0%、進入 72 ms，但無法代表 Pixel 6a。最晚在 S7.6 之前完成（E1 retro 2026-11-10 確認：各 Epic 的 Pixel 6a 量測都集中到這一次，各 Epic 結束時先在 iPhone 上量暫定值）；沒通過時依序評估 Skia → Lottie → 降級。原型已在 S1.7 移除，複驗直接量測正式的夜市街畫面（Flashlight 量 FPS；分頁切換時間在設定畫面顯示，需開啟除錯工具）
## Deferred from: code review of Epic 1 stories 1.1–1.5 (2026-11-09)
- source_plan: _bmad-output/implementation-artifacts/1-1-project-setup-and-lint-guardrails.md
  summary: ESLint 只強制規則層邊界；services、features、ui 的分層 import 限制還沒有 lint 規則
  evidence: 架構〈Architectural Boundaries〉寫明所有層都由 no-restricted-imports 強制執行；S1.1 AC4 只要求規則層
- source_plan: _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md
  summary: Spike 卡頓門檻固定 25 ms（120 Hz 會漏報）、沒有顯示 JS 執行緒的卡頓比例、沒有量回棋盤方向
  evidence: 這次在 60 Hz 的 iPhone 16 上量測，結果有效；Android 複驗會改用 Flashlight。如果要沿用 App 內面板，先把門檻改成依螢幕更新率計算
- source_plan: _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md
  summary: Spike A 入口按鈕疊在棋盤右下角的格子上
  evidence: 暫時的除錯入口，S1.7 會和 spike 一起移除
- source_plan: _bmad-output/implementation-artifacts/1-5-save-v2-and-v1-migration.md
  summary: createGame(now, seed) 違反「now 放在最後一個參數」
  evidence: v1 就是這個簽名，呼叫端很多（測試、services）；之後整理規則層時一起改
- source_plan: _bmad-output/implementation-artifacts/1-5-save-v2-and-v1-migration.md
  summary: production 的 AdMob ad unit ID 沒有在建置時檢查是否存在
  evidence: 屬於 S6.2 的範圍（正式 ad unit ID 注入）
## Deferred from: code review of Epic 1 stories 1.6–1.10 (2026-11-10)
- source_plan: _bmad-output/implementation-artifacts/1-7-tabs-street-screen-and-settings.md
  summary: freezeOnBlur 凍結夜市街之後，霓虹的 withRepeat 迴圈可能還在 UI 執行緒上跑
  evidence: 只是理論上可能，測試裡驗證不了。Android 複驗時要量「夜市街在背景時，棋盤拖曳的 FPS」；如果受影響，改用 useFocusEffect 直接停止動畫
- source_plan: _bmad-output/implementation-artifacts/1-8-debug-panel-and-save-import-export.md
  summary: 除錯程式碼仍然會被打包進正式版（執行期才判斷，沒有在建置時排除）
  evidence: 架構〈Debug Tools〉要求整段排除。要在 S7.7 正式建置前，改用建置時就決定的環境變數，讓 Metro 刪掉這段程式碼
- source_plan: _bmad-output/implementation-artifacts/1-10-upgrade-stall-to-lv2-and-neon.md
  summary: S3.5 開放 Lv3 升級後，快速連點「升級」可能升兩級
  evidence: 目前 Lv3 需要發明菜，所以第二次判定會失敗；S3.5 要加上按下後立刻停用按鈕
- source_plan: _bmad-output/implementation-artifacts/1-9-reopen-stall.md
  summary: 重開攤位的完整流程沒有實機測試
  evidence: 需要玩家 Lv3 加上 300 金幣；可以等開發版或 preview 建置能用除錯面板時再測，或在實際遊玩時順便確認
  status: 已解決（2026-11-10）：用 Expo Go 開除錯面板，在 iPhone 上走完重開與升級流程（E1 retro A1）
