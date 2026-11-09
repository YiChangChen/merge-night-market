# Round 1 · Push 3 · Assumption Audit

| # | 假設 | 信心 | 影響 |
|---|---|---|---|
| A1 | RN View 撐得住夜市街 | 低 | 高 |
| A2 | React Compiler × Reanimated 4 安全 | 中低 | 高 |
| A3 | SDK 58 支援 iOS 15 / Android 8 | 中低 | 高 |
| A4 | EAS 免費額度夠用 | 中 | 中 |
| A5 | EAS Update 不拖累離線與冷啟動 | 中 | 中高 |
| A6 | Expo Router 雙分頁能做到 ≤300ms | 中 | 中 |
| A7 | web 建置無害 | 中 | 低中 |
| A8 | 直式不必寫進設定 | 高 | 低 |
| A9 | Node 版本與 Expo Go 狀態（有時效性） | 中 | 低 |
| A10 | 廣告 SDK 有支援新架構的 config plugin | 中 | 高 |
| A11 | Jest 測得到動畫與手勢的回歸 | 低 | 中 |
| A12 | Expo MCP 免費方案可以截圖 | 中 | 低 |

最弱三項的壓力測試：
- A1：渲染列與 #4 自相矛盾，也沒有驗證門檻。
- A2：編譯器自動 memo 可能讓手勢讀到過期的 shared value；應改用 .get()/.set()，必要時加 'use no memo'。
- A3：近期 SDK 持續上調 iOS 最低版本，等到送審時才發現就太晚了。

## Findings
1. 渲染列拆成兩部分，並為 #4 加上 spike 門檻（60fps、記憶體上限）與期限（W2）。
2. React Compiler 列補上規則：.get()/.set()、render 中不讀 .value、用 'use no memo' 豁免、改動後實機重測。
3. 記錄 SDK 58 實際的平台下限，用 expo-build-properties 設定；和 GDD 衝突時列為決策。
4. 建置策略：日常開發版建置以本機 run:android 為主；EAS Update 不阻塞啟動（fallbackToCacheTimeout: 0），並訂定 runtimeVersion 策略。
5. 新增平台設定列：platforms: ["ios","android"]、orientation portrait；版本標到 minor；一律用 npx expo install。
