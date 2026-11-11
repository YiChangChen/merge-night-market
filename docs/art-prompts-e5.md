# 夜市合成：E5 美術批次提示詞（卡面與卡框）

這份文件是 [art-manifest.md](art-manifest.md) **E5 批次（#43–#54）** 的生圖提示詞：卡面 10 張、卡框 2 張。故事依 [content.md](content.md) 第 4 節的定稿，老闆長相依第 1 節。驗收時機是 S5.3（Epic 5 完成定義）。

## 這批圖要用在哪裡

- **收藏冊**（S5.2、UX-DR8）：10 張卡牌排成網格，每張約 150 pt 寬；點開可以看大圖和故事。
- **首次發明演出**（S5.3、UX-DR5）：拿到 ★1 卡牌時置中顯示，約 240 pt 寬。
- **卡片怎麼組成**：程式把三層疊起來——底層是**卡面插圖**（這批的 10 張），上面蓋**卡框**（一般或 ★5 金框），卡框下方的名牌位置由程式寫上**菜名和星等**。所以圖裡**不要畫任何文字、星星或邊框**。

## 共通規格

| 項目 | 卡面（#43–#52） | 卡框（#53–#54） |
|---|---|---|
| 比例 | 直式 **3:4**（例如 768 × 1024） | 和卡面**完全相同**的畫布（768 × 1024） |
| 背景 | **完整插圖，有背景**（夜市場景），不用去背 | 中間的窗口與外圍是**純洋紅 #FF00FF**，由我去背 |
| 構圖 | 主角放在中央；**下方約 20% 會被卡框的名牌蓋住**，那裡只放背景；四周約 6% 會被框蓋住 | 四邊框條約占寬度的 6%；**下方名牌**約占高度的 18%，名牌上留白（程式寫字） |

**參考圖**（Gemini 可以上傳的話）：
- 畫風：`art-source/台式美食像素圖鑑.png`
- 老闆長相：`assets/images/owners/<攤位>.webp`（tea 阿珍、fried 阿炮、noodle 林嬸、dumpling 老王、sweet 小葵）
- 發明菜：`assets/images/dishes/<recipe-id>.webp`

## 卡面提示詞

每張的提示詞＝**共通開頭**＋**該卡的場景**。

**共通開頭（每張都貼上）：**

> Pixel art collectible card illustration, portrait 3:4, for a cozy Taiwanese night-market merge game. Same detailed clean pixel art style as the attached images: dark crisp outlines, soft shading, warm night-market palette with glowing lanterns and neon at night, consistent pixel density. Characters must match the attached owner portraits. Keep the main characters and the dish in the center; the bottom 20% of the image is only background (a name plate will cover it). No text, no letters, no numbers, no stars, no border, no frame.

| # | 卡 | 出場 | 場景（接在共通開頭後面） |
|---|---|---|---|
| 43 | 紅茶鹽酥雞套餐 | 阿珍、阿炮 | Scene: closing time at two neighboring stalls. The cheerful bubble tea lady (ponytail, arm sleeves, apron) hands a cup of iced black tea over the counter to the burly fried chicken man (towel on head, tank top), who hands her back a paper bag of popcorn chicken. They grin at each other. The combo dish sits between them, teal and golden neon glowing behind. |
| 44 | 茶香蚵仔麵線 | 林嬸、阿珍 | Scene: the gentle older noodle lady (floral apron, gray bun) pours a little milk tea from a cup into her huge steaming pot of oyster vermicelli, while the bubble tea lady peeks over curiously. A bowl of the tea-scented oyster vermicelli with tea leaves floats in front, pink neon behind. |
| 45 | 雞排麵線 | 阿炮、林嬸 | Scene: the burly fried chicken man proudly drops a whole crispy fried chicken cutlet onto a bowl of vermicelli. The noodle lady stands beside him with a ladle raised as if to scold, but her eyes are wide after tasting a bite. Golden and pink neon behind. |
| 46 | 奶茶煎餃 | 老王 | Scene: the serious elderly dumpling chef (white hair, white chef hat) sighs while placing a glass of milk tea next to a plate of golden pan-fried potstickers, a young customer cheering in the background. Purple neon and bamboo steamers behind. |
| 47 | 炸煎雙拼 | 阿炮、老王 | Scene: the fried chicken man and the dumpling chef argue face to face, each holding chopsticks, while a happy customer between them holds up a split plate of fried snacks and pan-fried potstickers. Golden and purple neon behind. |
| 48 | 麵線小籠湯 | 林嬸、老王 | Scene: the noodle lady and the dumpling chef, two veteran masters, stand side by side over a big bowl of rich intestine vermicelli soup with soup dumplings, steam rising, both with proud calm smiles. Pink and purple neon behind. |
| 49 | 珍奶雞蛋糕 | 阿珍、小葵 | Scene: the bubble tea lady pours tapioca pearls into egg cake batter at the young dessert girl's cart (short hair, hair clip, pink apron). The dessert girl pouts playfully, then laughs. Fresh egg cakes with pearls and a bubble tea cup in front, teal and orange neon behind. |
| 50 | 甜鹹地瓜雞 | 小葵、阿炮 | Scene: on her quiet first night, the young dessert girl sits on a stool at her colorful cart holding a paper bowl where she mixes golden sweet potato balls with popcorn chicken; the fried chicken man gives a thumbs up from his stall nearby. Orange and golden neon behind. |
| 51 | 夜市甜鹹雙拼 | 小葵、林嬸 | Scene: late at night after closing, the noodle lady finishes a bowl of vermicelli and the young dessert girl hands her a shiny red candied fruit skewer. Both smile warmly; a tray with the noodle bowl and the skewer in front. Pink and orange neon, fewer customers, cozy end-of-night mood. |
| 52 | 冰火小籠塔 | 老王、小葵 | Scene: the dessert girl piles a mountain of mango shaved ice on top of the dumpling chef's tall bamboo steamer stack; hot steam and cold mist rise together, and the usually serious chef laughs out loud for the first time. The most dramatic, festive card: sparkles, purple and orange neon. |

## 卡框提示詞

先產**一般框**，確認比例和名牌位置後，再用**同一張當參考**產金框（形狀要一模一樣，只換材質）。

**#53 一般框：**

> Pixel art ornamental card frame, portrait 3:4, for a Taiwanese night-market game. A warm carved wooden frame like a night-market stall signboard, with small red paper lanterns at the two top corners and a thin string of warm lights along the top edge. The border strips are about 6% of the width. At the bottom there is a wider wooden name plate (about 18% of the height) that is plain and empty for text. Same pixel art style as the attached images. The inside window of the frame and everything outside the frame must be solid flat magenta (#FF00FF). No text, no letters, no stars, no picture inside.

**#54 ★5 金框：**

> The same card frame as the attached image, exactly the same shape, size and layout, but made of shining gold with small gemstones at the corners, golden lanterns, and a few sparkles along the border; the bottom name plate is polished gold and empty. The inside window and everything outside the frame remain solid flat magenta (#FF00FF). No text, no stars.

## 建議的產出順序（E4 retro A2）

1. 先產 **#53 一般框** 和 **#43 紅茶鹽酥雞套餐**，交給我疊起來看比例和名牌位置。
2. 確認後，用同樣的寫法產其餘 9 張卡面，以及 #54 金框（附上一般框當參考）。
3. 檔名照下表放進 `art-source/`，告訴我一聲；我負責去背（卡框）、縮到 ≤ 1024、轉 WebP、放到 `assets/images/cards/`。

| # | 建議檔名 | # | 建議檔名 |
|---|---|---|---|
| 43 | `card-tea-fried.png` | 49 | `card-tea-sweet.png` |
| 44 | `card-tea-noodle.png` | 50 | `card-fried-sweet.png` |
| 45 | `card-fried-noodle.png` | 51 | `card-noodle-sweet.png` |
| 46 | `card-tea-dumpling.png` | 52 | `card-dumpling-sweet.png` |
| 47 | `card-fried-dumpling.png` | 53 | `frame-normal.png` |
| 48 | `card-noodle-dumpling.png` | 54 | `frame-gold.png` |

## 檢查清單（收圖時我會檢查）

- [ ] 卡面都是 3:4，主角在中央，下方 20% 只有背景
- [ ] 老闆長相和頭像一致，誰出場符合上表
- [ ] 卡面沒有文字、星星、邊框
- [ ] 兩個卡框形狀完全相同（疊在卡面上時窗口對齊），名牌是空的
- [ ] 卡框的窗口與外圍是純洋紅

## #45 雞排麵線：重產（E5 code review）

第一版裡拿湯勺的是年輕綁馬尾的阿珍，不是故事裡的林嬸（content.md 第 4 節：「阿炮嫌麵線太軟，直接把剛起鍋的雞排蓋上去。林嬸本來要罵他，吃了一口就沒再說話了。」）。重產時把林嬸的長相寫清楚，並排除阿珍。

**參考圖**：`assets/images/owners/fried.webp`（阿炮）、`assets/images/owners/noodle.webp`（林嬸）、`assets/images/dishes/fried-noodle.webp`。不要附 tea（阿珍）的頭像。

**提示詞**＝共通開頭＋下面這段：

> Scene: exactly two characters. On the left, the burly fried chicken man (towel tied on his head, white tank top, thick arms) proudly drops a whole crispy golden fried chicken cutlet onto a big bowl of thick vermicelli. On the right, the noodle lady: an older woman around sixty, gray hair in a low bun, gentle wrinkled face, wearing a floral-print apron over a plain blouse, holding a big soup ladle raised as if about to scold him — but she has just tasted a bite, eyes wide in surprise, scolding forgotten. She is NOT young, has NO ponytail, NO arm sleeves, and is NOT the bubble tea lady. The steaming bowl of vermicelli topped with the fried chicken cutlet sits in the center between them. Golden and pink neon behind.

**驗收**：右邊是灰髮包頭、碎花圍裙的年長婦人，手上拿大湯勺；畫面只有兩個人；其他規格同共通規格。檔名照舊存成 `art-source/card-fried-noodle.png`，交給我重跑處理腳本。
