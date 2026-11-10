# 夜市合成：E1 美術批次提示詞

這份文件是 [art-manifest.md](art-manifest.md) **E1 批次（#1–#31）** 的生圖提示詞。可以貼到 ChatGPT（GPT Image）、Midjourney 或其他工具使用。人物設定依 [content.md](content.md) 的定稿。

## 共通風格（每一張都要附上）

> Detailed clean pixel art for a cozy mobile merge game, dark crisp outlines, soft shading, warm night-market palette, consistent pixel density, single centered subject, no text, no letters, no watermark.

- **參考圖**：工具可以上傳參考圖的話，請附上 `assets/images/generators/tea.png`（攤位畫法）和 `assets/images/customers/grandma.png`（人物畫法），新圖才會和現有的品項、客人一致。
- **背景**：攤位、霓虹、頭像都要**去背**（透明 PNG）。工具不支援透明背景時，改成純白背景，我再幫你去背。
- **一致性**：同一攤的 4 種外觀（#2–#5 這種一組）請在同一個對話裡連續生成，並要求「same stall, same camera angle, same canvas framing」，才不會每張的角度和大小都不同。
- **交檔**：PNG 或 WebP 都可以，檔名照下表的「路徑」欄。轉檔、壓縮和放進專案由我處理。

## 夜市街背景（#1）

| # | 路徑 | 尺寸 | 提示詞 |
|---|---|---|---|
| 1 | `street/background-*.webp` | 寬 3072 × 高 1024，左右可以接起來 | Wide horizontal pixel art background of a Taiwanese night market street at night: deep navy sky with a few stars, distant low-rise buildings with lit windows, warm yellow string lights hanging across the top, a dark paved street along the bottom third. The left and right edges must tile seamlessly. Leave the middle band empty for stalls to be placed in front. Same shared style. |

## 攤位外觀（#2–#21）

每一攤都是同一個構圖：**正面略俯視的 3/4 視角，攤位底部貼齊畫布下緣，畫布 1024 × 1024，去背。**

| 等級 | 提示詞重點（接在攤位描述後面） |
|---|---|
| 鐵捲門 | closed for business: a rolled-down corrugated metal shutter covers the front, slightly dusty, a faded empty sign board above, no lights on |
| Lv1 小攤 | a small simple street cart: one wooden counter, a striped cloth awning, one hanging paper lantern |
| Lv2 店面 | a proper small storefront: wider counter, wooden frame and roof, an empty signboard area above for a neon sign, two lanterns, more goods displayed |
| Lv3 大店 | a big busy two-story shop: tiled roof, large empty signboard area for a neon sign, rows of lanterns and string lights, abundant goods, festive |

| 攤位 | 鏈 | 攤位描述（放在等級重點前面） | 主色 |
|---|---|---|---|
| 手搖飲吧台 | `tea` | a Taiwanese bubble tea stall with steel tea urns and cups of milk tea with straws | 深棕木頭、青綠色點綴 |
| 炸物鍋 | `fried` | a Taiwanese fried chicken stall with a big oil wok, golden fried chicken and a menu of skewers | 紅棕色、金黃點綴 |
| 麵線大鍋 | `noodle` | a Taiwanese oyster vermicelli stall with a huge steaming soup pot and ladles | 靛藍、粉紅點綴 |
| 蒸籠台 | `dumpling` | a Taiwanese dumpling stall with tall stacks of bamboo steamers releasing steam | 墨綠、紫色點綴 |
| 甜品車 | `sweet` | a Taiwanese dessert cart with shaved ice, candied fruit skewers and egg cakes | 酒紅、橘色點綴 |

| # | 路徑 | # | 路徑 | # | 路徑 | # | 路徑 |
|---|---|---|---|---|---|---|---|
| 2 | `stalls/tea/shutter.webp` | 3 | `stalls/tea/lv1.webp` | 4 | `stalls/tea/lv2.webp` | 5 | `stalls/tea/lv3.webp` |
| 6 | `stalls/fried/shutter.webp` | 7 | `stalls/fried/lv1.webp` | 8 | `stalls/fried/lv2.webp` | 9 | `stalls/fried/lv3.webp` |
| 10 | `stalls/noodle/shutter.webp` | 11 | `stalls/noodle/lv1.webp` | 12 | `stalls/noodle/lv2.webp` | 13 | `stalls/noodle/lv3.webp` |
| 14 | `stalls/dumpling/shutter.webp` | 15 | `stalls/dumpling/lv1.webp` | 16 | `stalls/dumpling/lv2.webp` | 17 | `stalls/dumpling/lv3.webp` |
| 18 | `stalls/sweet/shutter.webp` | 19 | `stalls/sweet/lv1.webp` | 20 | `stalls/sweet/lv2.webp` | 21 | `stalls/sweet/lv3.webp` |

## 霓虹招牌（#22–#26）

每一攤的招牌由 **3 張疊在一起的圖層** 組成。Lv1 只顯示第 1 層，Lv2 顯示 1–2 層，Lv3 三層全亮。

- 3 張圖用**完全相同的畫布**（1024 × 256，去背），每張只畫招牌的其中一段，疊起來剛好是完整的招牌。
- 不要寫中文字，生圖工具常把字寫錯；用圖示代替，攤位名稱由程式疊上去。
- 共通提示詞：*Glowing neon sign made of bright tube lights on a transparent background, pixel art, strong outer glow. This image contains only the {LEFT / MIDDLE / RIGHT} third of the sign; the other parts are empty. Same canvas and position as the other parts.*

| # | 攤位 | 路徑 | 霓虹顏色 | 招牌圖案（左 → 中 → 右） |
|---|---|---|---|---|
| 22 | 手搖飲 | `stalls/tea/neon-{1,2,3}.webp` | 青綠 #00F5D4 | 茶葉 → 珍珠奶茶杯 → 波浪線 |
| 23 | 炸物 | `stalls/fried/neon-{1,2,3}.webp` | 金黃 #FFBE0B | 火焰 → 雞腿 → 油花點點 |
| 24 | 麵線 | `stalls/noodle/neon-{1,2,3}.webp` | 桃紅 #FF006E | 蒸氣 → 碗與筷子 → 波浪麵條 |
| 25 | 蒸籠 | `stalls/dumpling/neon-{1,2,3}.webp` | 紫色 #8338EC | 蒸氣 → 蒸籠 → 小籠包 |
| 26 | 甜品 | `stalls/sweet/neon-{1,2,3}.webp` | 橘色 #FB5607 | 星星 → 剉冰碗 → 糖葫蘆 |

## 老闆頭像（#27–#31）

共通：*Pixel art character portrait, bust shot facing the viewer, same style as the attached customer sprite, centered, transparent background, 512 × 512.*

| # | 路徑 | 老闆 | 提示詞 |
|---|---|---|---|
| 27 | `owners/tea.webp` | 阿珍 | A cheerful Taiwanese woman in her 40s who runs a bubble tea stall: dark hair in a ponytail, fabric arm sleeves, apron, holding a cocktail shaker, eyes squinting into a warm smile. |
| 28 | `owners/fried.webp` | 阿炮 | A burly Taiwanese man in his 30s who runs a fried chicken stall: towel tied around his head, tank top, holding long cooking chopsticks, face flushed red from the hot oil, talking loudly with a grin. |
| 29 | `owners/noodle.webp` | 林嬸 | A Taiwanese woman around 60 who runs an oyster vermicelli stall: floral apron, holding a big soup ladle, gentle but determined eyes, gray-streaked hair in a bun. |
| 30 | `owners/dumpling.webp` | 老王 | An elderly Taiwanese man, a retired hotel dim sum chef: white hair, white chef's hat, serious expression, pinching a soup dumpling between his fingers. |
| 31 | `owners/sweet.webp` | 小葵 | A young Taiwanese woman in her early 20s who runs a dessert cart: short hair with a hair clip, pink apron, bright hopeful smile, holding a candied fruit skewer. |

## 建議的產出順序

1. 先產 **#3（手搖飲 Lv1）和 #27（阿珍）** 當樣本。確認風格之後，才用同一套寫法產其他圖。
2. 再產其餘攤位外觀，一攤 4 張連續生成。
3. 霓虹招牌最難對齊，可以最後再做。真的對不齊的話，霓虹可以先保留程式畫的色塊，不影響 E1 驗收的其他項目。
