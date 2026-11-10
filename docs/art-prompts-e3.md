# 夜市合成：E3 美術批次提示詞（發明菜圖示）

這份文件是 [art-manifest.md](art-manifest.md) **E3 批次（#32–#41）** 的生圖提示詞。配方名稱、材料和負責老闆依 [content.md](content.md) 的定稿。驗收時機是 S3.5（Epic 3 完成定義）。

## 這批圖要用在哪裡

- **棋盤上的棋子**（S3.3）：發明菜和一般品項一樣放在棋盤格裡。iPhone 16 上每格約 **48 pt**，所以縮得很小時也要一眼認得出來。右上角的份數徽章（×1–×3）和星等由程式疊上去，圖裡不要畫。
- **首次發明演出**（S3.4）：大圖置中顯示，約 200 pt。
- **夜市街的招牌菜**（S3.5）：攤位上的小圖示。
- E5 的卡牌會另外畫卡面（#42–#51），這批只做「一道菜」的圖示。

## 建議做法：一張素材表，10 道菜一次生成

E1 的經驗：一張素材表一起生成，風格最一致；切圖和去背交給我處理（`art-source/scripts/`）。

**素材表提示詞（可以直接貼到 Gemini）：**

> Pixel art sprite sheet of 10 Taiwanese night-market fusion dishes for a cozy mobile merge game. Arrange them in a clean grid of **5 columns × 2 rows**, every dish the same size, centered in its own cell, with generous empty space between dishes so they never touch or overlap. **Solid flat magenta background (#FF00FF) everywhere**, no gradient, no shadow on the background, no grid lines, no frames, no text, no labels, no numbers.
> Style: detailed clean pixel art, dark crisp outlines, soft shading, warm night-market palette, consistent pixel density, each dish served on a simple plate, bowl, tray, cup or skewer, viewed from a slight 3/4 top-down angle, with a little steam or sparkle where it fits. Each dish must read clearly as a small icon.
> Row 1, left to right: (1) a cup of black tea next to a paper bag of popcorn chicken, (2) a bowl of oyster vermicelli with a swirl of milk tea and a few tea leaves floating on top, (3) a bowl of vermicelli topped with a whole crispy fried chicken cutlet, (4) a plate of pan-fried potstickers next to a glass of milk tea, (5) a split plate: half fried snacks, half pan-fried potstickers.
> Row 2, left to right: (6) a bowl of pork-intestine vermicelli soup with soup dumplings in it, (7) egg cakes with tapioca pearls baked inside next to a bubble tea cup, (8) popcorn chicken tossed with golden sweet potato balls in one paper bowl, (9) a bowl of vermicelli and a candied fruit skewer side by side on one tray, (10) a bamboo steamer stacked with dumplings and topped with a mound of mango shaved ice, steam and cold mist rising together.

**附上的參考圖**（Gemini 可以上傳的話）：`assets/images/items/` 底下各鏈的品項圖，例如 `tea/milk-tea.png`、`fried/` 的鹽酥雞，以及 E1 的 `art-source/夜市美食攤位像素素材表.png`。新圖才會和棋盤上現有的品項同一個畫風。

**交檔**：PNG 或 JPG 都可以，放進 `art-source/`，檔名隨意。告訴我檔名就好，我會負責切成 10 張、去背、縮到 512、轉 WebP，再放到 `assets/images/dishes/<recipe-id>.webp`。

## 各道菜的重點（素材表沒畫好時，可以單張補產）

單張提示詞的開頭都一樣：*Pixel art icon of a single Taiwanese night-market dish, centered, solid flat magenta background (#FF00FF), no text, same style as the attached item sprites, slight 3/4 top-down view, readable at small size.* 後面接上表格裡的英文描述。

| # | RecipeId | 發明菜 | 材料 | 畫面重點 | 英文描述 |
|---|---|---|---|---|---|
| 32 | `tea-fried` | 紅茶鹽酥雞套餐 | 紅茶 + 鹽酥雞 | 「下班套餐」：飲料杯和紙袋並排 | a cup of black tea with a straw next to a paper bag of popcorn chicken, a combo meal |
| 33 | `tea-noodle` | 茶香蚵仔麵線 | 鮮奶茶 + 蚵仔麵線 | 麵線湯面上一圈奶茶色、幾片茶葉 | a bowl of oyster vermicelli with a swirl of milk tea and a few tea leaves floating on top |
| 34 | `fried-noodle` | 雞排麵線 | 大雞排 + 麵線 | 一整片雞排蓋在麵線上，誇張地比碗還大 | a bowl of vermicelli topped with a whole crispy fried chicken cutlet bigger than the bowl |
| 35 | `tea-dumpling` | 奶茶煎餃 | 鮮奶茶 + 煎餃 | 煎得金黃的煎餃一排，旁邊一杯鮮奶茶 | a row of golden pan-fried potstickers on a plate next to a glass of milk tea |
| 36 | `fried-dumpling` | 炸煎雙拼 | 炸物拼盤 + 煎餃 | 一個盤子分成兩半，一半炸物、一半煎餃 | a split plate, half assorted fried snacks and half pan-fried potstickers |
| 37 | `noodle-dumpling` | 麵線小籠湯 | 大腸麵線 + 小籠包 | 深色濃湯裡泡著兩三顆小籠包，冒熱氣 | a bowl of rich pork-intestine vermicelli soup with soup dumplings sitting in it, steaming |
| 38 | `tea-sweet` | 珍奶雞蛋糕 | 珍珠奶茶 + 雞蛋糕 | 雞蛋糕裡露出黑色珍珠，旁邊一杯珍奶 | egg cakes with black tapioca pearls baked inside, next to a bubble tea cup |
| 39 | `fried-sweet` | 甜鹹地瓜雞 | 鹽酥雞 + 地瓜球 | 一個紙碗裡，鹽酥雞和金黃地瓜球拌在一起 | popcorn chicken and golden sweet potato balls tossed together in one paper bowl |
| 40 | `noodle-sweet` | 夜市甜鹹雙拼 | 總匯麵線 + 糖葫蘆 | 同一個托盤上，一碗麵線和一串紅亮的糖葫蘆 | a bowl of loaded vermicelli and a shiny red candied fruit skewer side by side on one tray |
| 41 | `dumpling-sweet` | 冰火小籠塔 | 蒸籠拼盤 + 芒果冰 | 疊高的蒸籠上堆一座芒果冰，熱氣和冰霧一起冒出來（頂級配方，最華麗） | a tall stack of bamboo steamers with dumplings, topped with a mound of mango shaved ice, hot steam and cold mist rising together, the most luxurious dish |

## 檢查清單（收圖時我會檢查）

- [ ] 10 道菜都在，順序和上表相同（素材表由左到右、由上到下）
- [ ] 背景是純洋紅、沒有漸層或陰影，每道菜之間有空隙（才切得開）
- [ ] 縮到 48 pt 時，還分得出每一道菜，主要材料看得出來
- [ ] 畫風和棋盤上現有的品項一致（輪廓線、像素密度）
- [ ] 圖裡沒有文字、數字或邊框
