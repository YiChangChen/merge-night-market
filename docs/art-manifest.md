---
title: 夜市合成：美術清單
story: 1.0
updated: 2026-11-09
---

# 夜市合成：美術清單

GDD〈素材需求〉的 54 張新美術，依交付批次列出。每張圖完成後，把「狀態」從 `占位` 改成 `草稿`，再改成 `定稿`。程式碼中的 `TODO(content): art-manifest#<編號>` 對應到這裡的「#」欄。

**規格（架構 Asset Management）：**
- 一律使用 WebP，檔名用 kebab-case 英文，放在 `assets/images/` 下。
- 品項與頭像單張 ≤ 512 px；攤位外觀 ≤ 1024 px；夜市街背景依 Spike A（S1.3）的結論切塊。
- 卡面與發明菜圖示的檔名必須和 `RecipeId` 相同（`content-test.ts` 會檢查）。
- 角色的外觀描述見 `docs/content.md` 第 1 節。
- 原始稿與 AI 生圖原檔放在 `art-source/`，不打包。

**驗收時機：**E1 批次在 S1.10、E3 批次在 S3.5、E4 批次在 S4.4、E5 批次在 S5.3。S7.7 送審前，全部 54 列都必須是 `定稿`。

## E1 批次：夜市街與攤位（31 張）

> **2026-11-10 定稿。**來源是使用者產出的 5 張素材表，原檔在 `art-source/`；處理腳本是 `art-source/scripts/process-e1-art.py`。
> - 攤位與老闆：洋紅底依顏色去背，依物件之間的空隙自動切圖，最近鄰放大 3 倍，存成無損 WebP。
> - 霓虹：黑底依亮度去背（保留光暈），每個招牌依寬度切成左、中、右三層（同一張畫布）。
> - 夜市街背景（2138 × 736）不能左右無縫拼接，所以畫面上固定不動，攤位在前面捲動。

| # | 素材 | 路徑 | 尺寸上限 | 狀態 |
|---|---|---|---|---|
| 1 | 夜市街背景（可橫向延伸，切塊數依 S1.3） | `street/background-*.webp` | 依 S1.3 | 定稿 |
| 2 | 手搖飲吧台：鐵捲門 | `stalls/tea/shutter.webp` | 1024 | 定稿 |
| 3 | 手搖飲吧台：Lv1 小攤 | `stalls/tea/lv1.webp` | 1024 | 定稿 |
| 4 | 手搖飲吧台：Lv2 店面 | `stalls/tea/lv2.webp` | 1024 | 定稿 |
| 5 | 手搖飲吧台：Lv3 大店 | `stalls/tea/lv3.webp` | 1024 | 定稿 |
| 6 | 炸物鍋：鐵捲門 | `stalls/fried/shutter.webp` | 1024 | 定稿 |
| 7 | 炸物鍋：Lv1 | `stalls/fried/lv1.webp` | 1024 | 定稿 |
| 8 | 炸物鍋：Lv2 | `stalls/fried/lv2.webp` | 1024 | 定稿 |
| 9 | 炸物鍋：Lv3 | `stalls/fried/lv3.webp` | 1024 | 定稿 |
| 10 | 麵線大鍋：鐵捲門 | `stalls/noodle/shutter.webp` | 1024 | 定稿 |
| 11 | 麵線大鍋：Lv1 | `stalls/noodle/lv1.webp` | 1024 | 定稿 |
| 12 | 麵線大鍋：Lv2 | `stalls/noodle/lv2.webp` | 1024 | 定稿 |
| 13 | 麵線大鍋：Lv3 | `stalls/noodle/lv3.webp` | 1024 | 定稿 |
| 14 | 蒸籠台：鐵捲門 | `stalls/dumpling/shutter.webp` | 1024 | 定稿 |
| 15 | 蒸籠台：Lv1 | `stalls/dumpling/lv1.webp` | 1024 | 定稿 |
| 16 | 蒸籠台：Lv2 | `stalls/dumpling/lv2.webp` | 1024 | 定稿 |
| 17 | 蒸籠台：Lv3 | `stalls/dumpling/lv3.webp` | 1024 | 定稿 |
| 18 | 甜品車：鐵捲門 | `stalls/sweet/shutter.webp` | 1024 | 定稿 |
| 19 | 甜品車：Lv1 | `stalls/sweet/lv1.webp` | 1024 | 定稿 |
| 20 | 甜品車：Lv2 | `stalls/sweet/lv2.webp` | 1024 | 定稿 |
| 21 | 甜品車：Lv3 | `stalls/sweet/lv3.webp` | 1024 | 定稿 |
| 22 | 霓虹招牌：手搖飲（分 3 段，每段一層） | `stalls/tea/neon-{1,2,3}.webp` | 1024 | 定稿 |
| 23 | 霓虹招牌：炸物 | `stalls/fried/neon-{1,2,3}.webp` | 1024 | 定稿 |
| 24 | 霓虹招牌：麵線 | `stalls/noodle/neon-{1,2,3}.webp` | 1024 | 定稿 |
| 25 | 霓虹招牌：蒸籠 | `stalls/dumpling/neon-{1,2,3}.webp` | 1024 | 定稿 |
| 26 | 霓虹招牌：甜品 | `stalls/sweet/neon-{1,2,3}.webp` | 1024 | 定稿 |
| 27 | 老闆頭像：阿珍 | `owners/tea.webp` | 512 | 定稿 |
| 28 | 老闆頭像：阿炮 | `owners/fried.webp` | 512 | 定稿 |
| 29 | 老闆頭像：林嬸 | `owners/noodle.webp` | 512 | 定稿 |
| 30 | 老闆頭像：老王 | `owners/dumpling.webp` | 512 | 定稿 |
| 31 | 老闆頭像：小葵 | `owners/sweet.webp` | 512 | 定稿 |

## E3 批次：發明菜圖示（10 張）

| # | 素材 | 路徑 | 尺寸上限 | 狀態 |
|---|---|---|---|---|
| 32 | 紅茶鹽酥雞套餐 | `dishes/tea-fried.webp` | 512 | 占位 |
| 33 | 茶香蚵仔麵線 | `dishes/tea-noodle.webp` | 512 | 占位 |
| 34 | 雞排麵線 | `dishes/fried-noodle.webp` | 512 | 占位 |
| 35 | 奶茶煎餃 | `dishes/tea-dumpling.webp` | 512 | 占位 |
| 36 | 炸煎雙拼 | `dishes/fried-dumpling.webp` | 512 | 占位 |
| 37 | 麵線小籠湯 | `dishes/noodle-dumpling.webp` | 512 | 占位 |
| 38 | 珍奶雞蛋糕 | `dishes/tea-sweet.webp` | 512 | 占位 |
| 39 | 甜鹹地瓜雞 | `dishes/fried-sweet.webp` | 512 | 占位 |
| 40 | 夜市甜鹹雙拼 | `dishes/noodle-sweet.webp` | 512 | 占位 |
| 41 | 冰火小籠塔 | `dishes/dumpling-sweet.webp` | 512 | 占位 |

## E4 批次：阿嬤（1 張）

| # | 素材 | 路徑 | 尺寸上限 | 狀態 |
|---|---|---|---|---|
| 42 | 阿嬤提示立繪（和現有的「阿嬤」客人頭像是不同的圖） | `characters/grandma.webp` | 1024 | 占位 |

## E5 批次：卡牌（12 張）

| # | 素材 | 路徑 | 尺寸上限 | 狀態 |
|---|---|---|---|---|
| 43 | 卡面：紅茶鹽酥雞套餐（阿珍） | `cards/tea-fried.webp` | 1024 | 占位 |
| 44 | 卡面：茶香蚵仔麵線（林嬸） | `cards/tea-noodle.webp` | 1024 | 占位 |
| 45 | 卡面：雞排麵線（阿炮） | `cards/fried-noodle.webp` | 1024 | 占位 |
| 46 | 卡面：奶茶煎餃（老王） | `cards/tea-dumpling.webp` | 1024 | 占位 |
| 47 | 卡面：炸煎雙拼（阿炮） | `cards/fried-dumpling.webp` | 1024 | 占位 |
| 48 | 卡面：麵線小籠湯（林嬸） | `cards/noodle-dumpling.webp` | 1024 | 占位 |
| 49 | 卡面：珍奶雞蛋糕（阿珍） | `cards/tea-sweet.webp` | 1024 | 占位 |
| 50 | 卡面：甜鹹地瓜雞（小葵） | `cards/fried-sweet.webp` | 1024 | 占位 |
| 51 | 卡面：夜市甜鹹雙拼（小葵） | `cards/noodle-sweet.webp` | 1024 | 占位 |
| 52 | 卡面：冰火小籠塔（老王） | `cards/dumpling-sweet.webp` | 1024 | 占位 |
| 53 | 卡框：一般 | `cards/frame-normal.webp` | 1024 | 占位 |
| 54 | 卡框：★5 金框 | `cards/frame-gold.webp` | 1024 | 占位 |

## 進度

| 批次 | 張數 | 定稿 | 驗收 story |
|---|---|---|---|
| E1 | 31 | 31 | S1.10 |
| E3 | 10 | 0 | S3.5 |
| E4 | 1 | 0 | S4.4 |
| E5 | 12 | 0 | S5.3 |
| **合計** | **54** | **31** | S7.7 |
