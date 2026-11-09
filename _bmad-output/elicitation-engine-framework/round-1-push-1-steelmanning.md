# Round 1 · Push 1 · Steelmanning

## 反方論證（最強倡議者立場）

棋盤的 RN View 證據不能替夜市街、霓虹、煙火、全螢幕慶祝背書。這幾類畫面是特效場景，而 RN View 樹在三處吃虧：

- 霓虹發光需要模糊加上 additive blend。
- 粒子一多就會產生上百個原生 View。
- 捲動、排隊動畫、招牌動畫同時跑時，同屏的動畫節點會暴增。

Skia 可以用單一 canvas 吃下這些效果，直接接 Reanimated 的 shared value，並和 RN View 共存。廣告 SDK 已經強制使用開發版建置，所以多加 Skia 不會多出流程成本。另外，Phaser-in-WebView 可以重用 TS 規則引擎，Unity / Cocos 的粒子系統和廣告 mediation 也比較成熟。

## 站得住的部分

- **站得住**：特效層不應預設用 RN View。改用 Skia overlay 或 Lottie / Rive 預製動畫。
- **站得住**：新畫面的效能還沒有證據，需要及早做 spike。
- **站不住**：換引擎。這等於重寫，而且會丟掉 TS 規則引擎與 Jest 測試。
- **站不住**：WebView + Phaser。狀態要跨橋同步，暖機時間會威脅冷啟動 ≤ 3s 與切換 ≤ 300ms，還得同時維護兩套渲染。
- **站不住**：react-native-game-engine。它無法解決上述問題。

## Findings

1. **渲染列 vs #4**：表格把 RN View 寫成既定解法，#4 卻列為待決，等於提前替 #4 做了決定。→ 拆成兩行：「棋盤／一般 UI：已驗證」；「特效：待 #4 決定，決定前勿實作」。
2. **Rationale**：只引用棋盤的證據。→ 補上第 1–2 週在 Pixel 6a 做 spike，標準為捲動加煙火時 60 FPS、切換 ≤ 300ms；不達標就改用 Skia。
3. **#4**：漏列兩條路，且沒有標準和期限。漏掉的是「RN + Skia 特效層」與「RN + Lottie/Rive 預製動畫」。→ 改寫成三選一，由 spike 決定，期限第 2 週。
4. **#3 與 #4 的相依**：常駐頁面會影響記憶體和 UI thread，Skia 會增加 binary 大小與冷啟動時間。→ 註明兩者需一起決定，並引用冷啟動 ≤ 3s 與切換 ≤ 300ms。
5. **「引擎」一詞混淆，且缺少渲染與規則分離的規則。** → 把「引擎層」改稱「規則引擎」，並加入規則：渲染層只讀 state、只 dispatch action，規則引擎不 import RN、Expo 或任何渲染模組。
