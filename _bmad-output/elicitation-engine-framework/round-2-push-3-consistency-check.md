# Round 2 · Push 3 · Consistency Check

| # | A | B | 保留 | 理由 |
|---|---|---|---|---|
| 1 | expo-image 3.x | package.json ~58.0.18 | B | Expo 套件的版本號跟著 SDK 走 |
| 2 | 用 expo-build-properties 設 minSdk 26，寫成「已設定」 | 套件未安裝，minSdk 預設仍是 24 | B，A 改寫為待辦 | 照現況寫，避免誤導 |
| 3 | profile 與 fingerprint 寫成「已存在」 | 專案裡沒有 eas.json | B，A 改寫為待建立 | 照現況寫，避免誤導 |
| 4 | spike 標準：60 FPS + 切換 300 ms | #4 標準：60 FPS + 切換 300 ms + 冷啟動 3 s | B | 同一個 spike 只能有一套標準 |
| 5 | 決定之前不得實作 | 分層規則已寫明使用 Skia | A | 分層規則不該預先替 #4 做決定 |
| 6 | iOS 16.4+ 定案 | 「依 SDK 58 實際值」 | 定案 | 寫成浮動值等於把定案重開 |
| 7 | Web 非目標 | app.json 仍有 web.output static | A | 說明 web 設定只為了開發預覽才保留 |
| 8 | 安裝 dev-client 的理由寫「廣告需要原生模組」 | 廣告 SDK 還沒選定（#5） | B | 理由改成「Expo Go 未上架」加上「預期會用到原生依賴」 |

## Findings
1. 渲染列：expo-image 改寫為 ~58.0.x，其他套件的版本號也改成和 package.json 相同的寫法。
2. 目標平台列：minSdk 26 改寫為待辦（npx expo install expo-build-properties，再到 app.json 設定），並刪除 podspec 那一句。
3. 建置列：eas.json 改寫為待建立（npx eas-cli@latest build:configure），runtimeVersion 改在 app.json 設定。
4. 「尚未驗證」段落：補上冷啟動 ≤ 3 秒，讓它和 #4 的標準一致。
5. 分層規則：Skia 改寫為「#4 選定的特效方案」。
