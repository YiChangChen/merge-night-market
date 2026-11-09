# Elicitation：引擎與框架（game-architecture 步驟 3）

目標檔案：`target.md`

## Round 1

Push 檔案：`round-1-push-1-steelmanning.md`、`round-1-push-2-pre-mortem.md`、`round-1-push-3-assumption-audit.md`

另外由架構師自行查證：在 `node_modules` 內，ExpoModulesCore、Expo、ExpoImage 三個 podspec 的 `:ios` 都是 `'16.4'`；React Native 0.88 的最低版本是 15.1；Android 的 minSdk 預設為 24。

### 提案修訂

1. **Rationale**：說明棋盤以外的畫面尚未驗證，並加入 W1–2 spike 的門檻（push 1、2、3）。
2. **渲染列**：拆成「棋盤／UI：已驗證」與「夜市街特效：待決 #4，決定前不得實作」（push 1、2、3）。
3. **新增「目標平台」列**：iOS 16.4+（依 SDK 58 實際下限）、Android 8+（minSdk 26）、只支援直式、Web 非目標平台；原生模組在 Web 上一律 no-op（push 2、3 與查證結果）。
4. **React Compiler 列**：加上和 Reanimated 搭配的寫法規則（push 3）。
5. **建置與發佈列**：加上 profile 分層、runtimeVersion 策略、「改了原生依賴就必須重建」規則，以及 OTA 不得阻塞啟動（push 2、3）。
6. **測試列**：明確寫出「規則引擎」，並加入每個 epic 在 Pixel 6a 上的效能量測（push 1、2）。
7. **新增「分層規則」**：規則引擎不得 import 任何 RN、Expo 或渲染模組；渲染層只讀 state、只 dispatch action（push 1）。
8. **#4 改寫**：列出三個選項，由 spike 決定，期限 W2；並註明和 #3 綁定（push 1、2、3）。
9. **#5 改寫**：廣告 SDK 在 W1–2 做 spike，並寫明備案（push 2）。
10. **新增 #10**：崩潰回報與效能量測（push 2）。
11. **版本標到 minor**，並要求一律使用 `npx expo install`（push 3）。

### 待使用者決定

- **D1**：GDD 寫 iOS 15+，但 SDK 58 實際最低為 iOS 16.4。

### 擱置

- **app.json 直接移除 web 平台**（push 2、3）。擱置理由：目前 web 可能仍作為開發預覽，因此改為「Web 非目標平台、原生模組在 Web 上 no-op」。使用者可以撈回。
- **日常開發版建置改以本機 `npx expo run:android` 為主**（push 3）。擱置理由：AGENTS.md 指定使用 EAS、不需要本機 Android Studio。保留的做法是：只有原生依賴變更時才重建，JS 變更一律走 dev server。
- **改用 WebView + Phaser、react-native-game-engine 或換引擎**（push 1 反方）。擱置理由：push 1 自己的結論就是這幾條站不住。

### 套用紀錄

- 修訂第 1–11 項：全部採用，已寫入 `target.md`。
- D1：使用者選擇 (a)，接受 iOS 16.4+，並回頭修正 GDD 與 decision-log。
- 擱置的三項：維持擱置，使用者沒有撈回。

## Round 2

Push 檔案：`round-2-push-1-subtraction.md`、`round-2-push-2-question-the-question.md`、`round-2-push-3-consistency-check.md`
修訂全文：`round-2-proposed-target.md`（第一輪採納後的版本另存在 `round-1-accepted-target.md`）

架構師查證：`board.tsx` 在 worklet 中使用 `.value`，部分地方用 `.get()`，拖曳暫態放在 shared value，只透過 `scheduleOnRN` 回到 JS。`eas.json` 不存在，`expo-build-properties` 未安裝。

### 提案修訂
1. Rationale 縮成一句已定案的說明，新增「既有資產」表（push 2）。
2. 「已驗證 60 FPS」更正為「已實作，未在 Pixel 6a release build 量測」，基準併入 spike（push 2）。
3. 門檻統一寫在 #4，並加入冷啟動條件（push 1、3）。
4. #4 改寫為依序嘗試的決策閘門，並附降級方案（push 2）。
5. 修正與現況不符的寫法：minSdk 26 與 eas.json 改標為「待辦／待建立」，expo-image 3.x 刪除，版本號以 package.json 為準（push 3、1）。
6. 刪除 iOS「依實際值」，固定為 16.4+（push 1、3）。
7. dev-client 的理由改成「#5、#7 預期需要原生模組」，刪除 Expo Go 的狀態描述（push 1、3）。
8. 分層規則：不再點名 Skia；加入手勢暫態的例外（push 1、3、2）。
9. 新增「原生套件前置關卡」（push 2）。
10. React Compiler 規則、OTA 規則、Web no-op、量測流程移到「交接給後續章節」；Compiler 規則修正為不改寫 worklet 內既有的 `.value`（push 1、2 與查證）。
11. 刪除「物理」列、`npx expo install` 重複說明、#7 與 #10 的括號附註（push 1）。

### 待使用者決定
- D2（push 2 的前提挑戰）：是否把整節改寫成純粹的「約束帳本」。提案只吸收它的內容（既有資產、閘門、前置關卡），保留範本結構。

### 擱置
- 刪除 Expo MCP 安裝指令（push 1）：使用者已同意採用 MCP，保留一行指令方便照抄。
- 各畫面的幀與記憶體預算數字（push 2）：目前沒有基準資料，等 spike 產出後在步驟 4 的 #3、#4 填入。
- spike 門檻只寫在 #4、其他地方全部不提（push 1）：已採用，但「既有資產」的效能基準一句保留，作為指向 #4 的引用。

### 套用紀錄
- D2：使用者選 (a)，保留範本結構並吸收內容；這等於採用整份提案，因此第 1–11 項全部套用，已寫入 `target.md`。
- 擱置的兩項維持擱置。

