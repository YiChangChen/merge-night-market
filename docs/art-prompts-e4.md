# 夜市合成：E4 美術批次提示詞（阿嬤提示立繪）

這份文件是 [art-manifest.md](art-manifest.md) **E4 批次（#42）** 的生圖提示詞。人物設定依 [content.md](content.md) 的定稿。驗收時機是 S4.4（Epic 4 完成定義）。

## 這張圖要用在哪裡

- **阿嬤保底提示**（S4.4、UX-DR7）：玩家同一道配方試錯 5 次之後，阿嬤從畫面下方探出來，旁邊是對話框，直接說出兩個材料，例如「憨孫，紅茶配鹽酥雞啦！」。第一次開放發明時，她也會先教配方 #1。
- 畫面上大約顯示 **200–260 pt 高**，放在左下角，對話框在她右上方。所以人物要**朝畫面右邊**（看向對話框），構圖是**腰部以上的半身**，下緣可以切掉。
- 這張和棋盤上「阿嬤」客人的圖是**不同的圖**：客人圖是端著托盤的小人物；這張是較大、有表情的角色立繪。可以參考客人圖的長相，讓玩家覺得「是同一個阿嬤」。

## 角色設定（content.md）

> 在夜市逛了一輩子的老客人，每一攤的祖傳吃法她都知道。說話慢慢的、帶台語口氣，例如「憨孫，紅茶配鹽酥雞啦！」

視覺重點：
- 七十多歲的台灣阿嬤，嬌小、駝一點點，滿頭白髮（短捲髮或小髮髻）。
- 慈祥、有點得意的笑，眼睛瞇起來，一隻手舉起食指像在「指點」。
- 穿碎花上衣或素色開襟外套，手腕掛一個塑膠提袋或竹編菜籃（逛夜市的感覺）。
- 暖色調，和夜市的燈光一致；輪廓清楚，縮小後表情仍然看得出來。

## 提示詞（可以直接貼到 Gemini）

**附上參考圖**：`assets/images/customers/grandma.png`（棋盤上的阿嬤客人，讓長相一致）和 `art-source/台式美食像素圖鑑.png`（畫風）。

> Pixel art character portrait of a kind elderly Taiwanese grandmother in her seventies, waist-up, turned slightly toward the right side of the image as if talking to someone on the right. Short curly white hair, small and slightly hunched, warm crinkled eyes and a proud, knowing smile. She raises one index finger as if giving a wise tip. She wears a floral blouse with a plain cardigan and carries a woven bamboo shopping basket on her arm. Same detailed clean pixel art style as the attached images: dark crisp outlines, soft shading, warm night-market palette, consistent pixel density. The face must stay readable when shown small. Single character, centered, **solid flat magenta background (#FF00FF)**, no gradient, no shadow on the background, no text, no speech bubble, no frame.

**比例**：直式，例如 1024 × 1280，或正方形 1024 × 1024 都可以；人物占畫面高度的八成左右。

## 交檔

- PNG 或 JPG，放進 `art-source/`，檔名例如 `grandma-hint.png`，再告訴我一聲。
- 我會去背（洋紅底）、裁掉多餘的空白、縮到長邊 ≤ 1024、轉成 WebP，放到 `assets/images/characters/grandma.webp`，並在 S4.4 接上。

## 檢查清單（收圖時我會檢查）

- [ ] 半身、朝右，下緣可以被切掉也不突兀
- [ ] 舉起食指「指點」的姿勢清楚
- [ ] 縮到約 200 pt 高時表情仍然看得出來
- [ ] 和棋盤上的阿嬤客人看得出是同一個人
- [ ] 背景是純洋紅、沒有對話框或文字
