# 合成夜市：E7 上架美術提示詞

S7.7 送審前要換掉 Expo 範本的圖示與啟動畫面，另外 Google Play 需要一張主題圖片。這份文件是這幾張圖的生圖提示詞，可以貼到 ChatGPT（GPT Image）、Midjourney 或其他工具。需求與規格見 [store-listing.md](store-listing.md) 第 4、6 節。

這幾張不在 [art-manifest.md](art-manifest.md) 的 54 列裡（那 54 列是遊戲內美術），完成與否由 `npm run release-check` 檢查。

## 共通風格（每一張都要附上）

> Detailed clean pixel art for a cozy mobile merge game, dark crisp outlines, soft shading, warm night-market palette, consistent pixel density, no text, no letters, no watermark.

- **參考圖**：請附上 `assets/images/stalls/tea/lv3.webp`（大店）和 `assets/images/stalls/tea/neon-1.webp`（霓虹畫法），圖示才會和遊戲內的攤位同一個畫風。
- **不要放文字**：生圖工具常把中文字寫錯；App 名稱由商店與系統顯示。主題圖片要的標題字我之後用程式疊上去。
- **交檔**：PNG，給最大尺寸即可。裁切、縮放、各尺寸輸出、去背由我處理。

## 1. App 圖示（最重要）

縮到手機桌面大小（約 60 × 60 pt）時，只要看得出「夜市小攤 + 霓虹 + 珍奶」就成功了。細節越少越好。

| 項目 | 內容 |
|---|---|
| 畫布 | 1024 × 1024，正方形，**不透明**、**不要圓角**（iOS 與 Android 會自己裁） |
| 檔名 | `icon.png` |

**提示詞**

> Square app icon, 1024x1024, full-bleed background with no rounded corners and no border. A single small Taiwanese night-market food stall seen from the front, centered and filling about 70% of the canvas: a wooden counter with a striped awning, warm yellow string-light bulbs along the top, and one glowing cyan neon outline above the awning. On the counter, one oversized cup of bubble milk tea with a straw, clearly the focal point. Background: deep navy night sky (#1B1F4B to #2B2F6B gradient) with a soft warm glow behind the stall. Bold, simple shapes that stay readable at very small sizes. Same shared style.

生成後請確認：中間的攤位和珍奶在縮小時仍然清楚；四個角落沒有重要的東西（iOS 會裁成圓角方形，Android 可能裁成圓形）。

## 2. Android 自適應圖示（3 張）

Android 會把前景和背景分開做視差效果，並裁成各種形狀。**請在圖示定稿後，用同一個對話生成**，才會長得一樣。

| 檔名 | 畫布 | 內容 |
|---|---|---|
| `android-icon-foreground.png` | 1024 × 1024，**透明背景** | 只有攤位和珍奶，主體縮在**中間 66%**（約 680 × 680）以內，外圍全部透明 |
| `android-icon-background.png` | 1024 × 1024，不透明 | 只有深藍夜空與暖光，沒有任何物件 |
| `android-icon-monochrome.png` | 1024 × 1024，透明背景 | 攤位加珍奶的**純白單色剪影**（Android 13 的主題圖示會自己上色） |

**提示詞（前景）**

> The same stall and bubble tea cup from the app icon, on a fully transparent background, scaled down so the whole subject fits inside the central 66% of a 1024x1024 canvas with generous empty margins. No sky, no background glow. Same shared style.

**提示詞（背景）**

> The same deep navy night-sky background from the app icon with the soft warm glow in the center, 1024x1024, no stall, no objects, no text.

**提示詞（單色）**

> A flat solid white silhouette of the same stall and bubble tea cup, on a transparent background, inside the central 66% of a 1024x1024 canvas. No shading, no outlines, no color, a single shape.

工具不支援透明背景時，前景和單色改成純綠（#00FF00）背景，我再去背。

## 3. 啟動畫面

App 打開、讀檔的那一兩秒顯示。畫面是「純色底 + 中間一張小圖」，純色底由 `app.config.ts` 設定（會改成夜空深藍 `#1B1F4B`），所以只需要中間那張圖。

| 項目 | 內容 |
|---|---|
| 畫布 | 1024 × 1024，**透明背景** |
| 檔名 | `splash-icon.png` |

最簡單的做法：**直接用第 2 節的 Android 前景圖**，不必另外生成。想要不一樣時再用下面的提示詞：

> A glowing night-market stall sign: a small wooden stall front with warm string lights and a cyan and pink neon outline, centered on a fully transparent background, subject inside the central 60% of a 1024x1024 canvas. Same shared style.

## 4. Google Play 主題圖片

商店頁最上方的橫幅，**必填**。

| 項目 | 內容 |
|---|---|
| 畫布 | 1024 × 500（可以生成 2048 × 1000 再縮小），不透明 |
| 檔名 | `feature-graphic.png` |

**提示詞**

> Wide horizontal banner, 2048x1000, a lively Taiwanese night-market street at night: five food stalls in a row (bubble tea, fried chicken, oyster vermicelli, steamed dumplings, dessert cart), every stall fully lit with glowing neon signs in cyan, gold, pink, purple and orange, warm yellow string lights across the top, a cheerful queue of customers in front. Deep navy sky. Keep the left 40% of the image calmer and darker so a title can be placed there. Same shared style.

左邊 40% 留給標題「合成夜市」與一句副標，由我疊字。

## 交件後我會做的事

1. 縮放、去背，輸出到 `assets/images/` 的對應檔名。
2. iOS 圖示：`ios.icon` 改指向新的 `icon.png`（或換掉 `assets/expo.icon` 的前景圖層）。
3. `app.config.ts`：啟動畫面底色與 Android 自適應圖示底色改成夜空深藍。
4. 跑 `npm run release-check`，確認「圖示與啟動畫面已換掉 Expo 範本」通過。
