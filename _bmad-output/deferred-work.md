- source_plan: none
  summary: S1.4 Spike B：在雙平台開發版建置播放 AdMob 測試激勵廣告並走完 UMP/ATT（epics.md Story 1.4）
  evidence: 使用者選擇拆分，先做 S1.1；S1.4 依賴 S1.1 的 eas.json 與 app.config.ts，排在 S1.1 之後
- source_plan: none
  summary: S1.3 Spike A：夜市街效能閘門原型與 Pixel 6a 量測（epics.md Story 1.3）
  evidence: 使用者選擇拆分，先做 S1.1；S1.3 依賴 S1.1 的 preview profile，排在 S1.4 之後
  status: 第一階段已完成（2026-11-09，iPhone 暫定通過，純 RN）；第二階段見下一筆
- source_plan: _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md
  summary: Spike A 第二階段：在 Android 中階機上複驗夜市街效能（release build、Flashlight、adb；FPS、冷啟動、記憶體）
  evidence: 使用者目前只有 iPhone，沒有 Mac 和 Apple Developer 付費帳號；第一階段在 iPhone 上量到 UI／JS 60 FPS、卡頓 0%、進入 72 ms，但無法代表 Pixel 6a。最晚在 S7.6 之前完成；沒通過時依序評估 Skia → Lottie → 降級。原型保留在 src/features/street/__spike__/ 供複驗使用
