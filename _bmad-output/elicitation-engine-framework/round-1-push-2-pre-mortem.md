# Round 1 · Push 2 · Pre-mortem Analysis

場景：上市週，依時序回推失敗原因。
1. W1–3 夜市街沒有效能基準；W4 加上 20 個頭像後，Pixel 6a 掉幀。此時才討論 Skia，等於要重做開發版建置並重寫圖層。
2. W3–4 的常駐策略兩頭不討好：常駐會拖慢棋盤，不常駐則重新掛載會超過 300ms。效能目標也沒有綁到渲染決策上。
3. W8–9 才第一次接廣告 SDK，發現和 RN 0.88、SDK 58 不相容，吃掉平衡調整與送審的緩衝時間。
4. 沒有 eas.json 的 profile 分層，也沒有 runtimeVersion 策略。OTA 推了不相容的 bundle 導致閃退；免費方案的建置排隊也拖長開發時間。
5. 沒有崩潰回報工具，crash-free 指標無從量測；冷啟動時間也沒有量過。
6. Web bundle 被原生模組弄壞，干擾 CI 和 agent。

## Findings
1. 渲染列與 Rationale：把棋盤的驗證結果推廣到全部畫面。→ W1 前做 spike（release build、5 攤、20 頭像、霓虹與鐵捲門同播，維持 60fps，切換 ≤300ms），用結果決定 #3 與 #4。
2. Project Initialization 與 #5：廣告 SDK 風險最高，卻沒有點名候選，也沒有驗證時程。→ 列出候選 SDK 與 config plugin；W1–2 在雙平台用開發版建置播放測試廣告，並跑完 UMP/ATT；寫明驗證失敗時的備案。
3. 建置與發佈列：缺 development/preview/production profile、runtimeVersion 策略，以及「改原生依賴必須重建、不可只推 OTA」這條規則。→ 補上。
4. 測試列：crash-free、冷啟動、FPS 都沒有量測手段。→ 待決事項新增「崩潰回報與效能量測」；每個 epic 結束時在 Pixel 6a 的 release build 上量測。
5. 缺平台範圍列：→ 新增「目標平台」：iOS/Android、直式、Web 非目標；音效標註為原生模組。
