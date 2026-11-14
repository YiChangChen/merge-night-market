# 夜市合成：音訊素材清單（E7）

這份文件是 Story 7.1（音效）與 7.2（背景音樂、叫賣語音）需要的音訊素材，依 GDD〈美術與音效方向〉：約 12 個音效、1 首背景音樂、2–3 句叫賣語音。所有素材都必須**可以商用、不必付費**，來源記在 `art-source/LICENSES.md`。

## 怎麼交給我

1. 下載的原始檔放進 `art-source/audio/`，**檔名改成下表的「檔名」欄**（副檔名保留原本的就好：`.wav`、`.mp3`、`.ogg` 都可以）。
2. 每個檔案在 `art-source/LICENSES.md` 記一行：檔名、來源網址、作者、授權名稱。
3. 交給我之後，由我轉成 App 用的格式（單聲道、裁掉前後空白、統一音量），放進 `assets/audio/`。音效不用自己剪，長一點也沒關係，我會截取需要的部分。

## 授權怎麼看

| 可以用 | 不能用 |
|---|---|
| **CC0**（公眾領域，不用標示作者） | **CC BY-NC**（NC = 不可商用） |
| **CC BY**（要標示作者：在 LICENSES.md 記好作者，上架時放進 App 的版權說明） | **ND**（禁止改作，例如 CC BY-ND）：我們要剪輯、調音量，不能用 |
| 網站自己的免費商用授權（例如 Pixabay、Mixkit），**以下載頁面當下寫的條款為準** | 「僅供個人使用」「需購買授權」的素材 |

> 授權條款會變動，下載時請看一眼該頁面的授權說明；不確定的就先跳過，換一個。

## 推薦的素材庫

| 素材庫 | 適合找 | 授權重點 |
|---|---|---|
| **Kenney**（kenney.nl → Assets → Audio） | 介面音效、硬幣、點擊、否定音 | 全部 CC0，一次下載整包 |
| **Freesound**（freesound.org） | 油鍋聲、鐵捲門、鑼、夜市環境錄音 | 搜尋時在左側 License 篩選 **Creative Commons 0**；CC BY 也可以但要記作者；避開 Noncommercial |
| **Pixabay**（pixabay.com/sound-effects、pixabay.com/music） | 煙火、收銀機、背景音樂 | Pixabay 授權：可商用、不用標示（以頁面條款為準） |
| **Mixkit**（mixkit.co/free-sound-effects、/free-stock-music） | 收銀機、煙火、輕快的背景音樂 | Mixkit 免費授權：可商用（以頁面條款為準） |
| **OpenGameArt**（opengameart.org） | 遊戲用的循環背景音樂、短音效 | 每個檔案的授權不同，選 CC0 或 CC BY |

## 音效（Story 7.1，共 12 個）

長度是「我會用到的部分」，原始檔長一點沒關係。

| # | 檔名 | 用在哪裡（遊戲事件） | 感覺 | 長度 | 搜尋關鍵字（英文） |
|---|---|---|---|---|---|
| A1 | `sfx-merge` | 合成（手搖飲、麵線、蒸籠、甜品鏈；`item_merged`） | 清脆的「啵」或輕快的彈出聲 | 0.2–0.4 秒 | `pop`, `bubble pop`, `ui pop`（Kenney Interface Sounds） |
| A2 | `sfx-merge-fried` | 炸物鏈合成；**音高隨階數遞增**，程式會調整播放速度 | 下鍋的「滋～」油炸聲 | 0.5–1 秒 | `frying`, `deep fry`, `sizzle`, `oil frying` |
| A3 | `sfx-cash` | 出餐（`order_completed`） | 收銀機「叮鈴」或硬幣聲 | 0.4–0.8 秒 | `cash register`, `cha ching`, `coins` |
| A4 | `sfx-shutter` | 重開攤位，鐵捲門拉起（`stall_reopened`） | 金屬鐵捲門往上捲的嘩啦聲 | 1–1.5 秒 | `rolling shutter`, `roller door`, `garage door metal` |
| A5 | `sfx-neon` | 升級攤位，招牌通電（`stall_upgraded`） | 霓虹燈通電「嗡～」加上啪滋 | 0.8–1.5 秒 | `neon hum`, `neon buzz`, `electric hum flicker` |
| A6 | `sfx-fireworks` | 完售煙火（`queue_sold_out`） | 2–3 發煙火爆開 | 1.5–2.5 秒 | `fireworks`, `firework burst` |
| A7 | `sfx-gong` | 首次發明（`dish_invented`） | 一聲響亮的鑼 | 1–2 秒 | `gong`, `chinese gong` |
| A8 | `sfx-reject` | 發明失敗（`invent_rejected`） | 輕輕的「嗯～」否定音，不刺耳 | 0.2–0.4 秒 | `error soft`, `negative`, `ui deny`（Kenney） |
| A9 | `sfx-queue-tick` | 人龍剩最後 3 人，計量條的節奏音 | 短促的「滴」或木魚聲，可重複 | 0.1–0.2 秒 | `tick`, `wood block`, `click short` |
| A10 | `sfx-star` | 卡牌升星（`card_starred`） | 閃亮的「叮～」 | 0.5–1 秒 | `sparkle`, `twinkle`, `magic chime` |
| A11 | `sfx-hint` | 阿嬤提示出現（`hint_shown`） | 溫和的提示鈴聲 | 0.4–0.8 秒 | `notification soft`, `bell soft`, `hint chime` |
| A12 | `sfx-reward` | 看完廣告領到獎勵（`ad_rewarded`） | 一串硬幣掉落 | 0.6–1 秒 | `coins drop`, `coin shower`, `reward coins` |

## 背景音樂（Story 7.2）

| # | 檔名 | 用途 | 感覺 | 長度 | 搜尋關鍵字 |
|---|---|---|---|---|---|
| B1 | `bgm-night-market` | 遊戲在前景時循環播放 | 輕快、溫暖的夜市氣氛；最好能混一點人聲嘈雜；**不要有明顯的歌詞** | 1–3 分鐘，能無縫循環最好 | `night market`, `asian market ambience`, `street food festival`, `chinese festive light`, `lofi asian` |

> 如果找不到「音樂＋人聲」合在一起的，可以各找一個：一首輕快的器樂（`bgm-night-market`）加一段夜市或市場的環境錄音（`amb-crowd`，Freesound 搜 `market crowd ambience`、`night market taiwan`），我會把兩者混在一起。

## 叫賣語音（Story 7.2，2–3 句）

素材庫裡幾乎找不到中文或台語叫賣，建議用以下其中一種方式：

1. **自己錄（最推薦）**：用手機錄音 App 錄下面的句子，各錄 2–3 次挑最好的。自己錄的聲音沒有授權問題。
2. **找朋友錄**：在 LICENSES.md 記下錄音者同意商用。
3. **AI 語音**：只能用明確允許商用的服務，並在 LICENSES.md 記下服務名稱與條款。

| # | 檔名 | 什麼時候播 | 台詞（國語或台語都可以） |
|---|---|---|---|
| C1 | `voice-call-1` | 新一波人龍出現 | 「來喔來喔！走過路過千萬不要錯過！」 |
| C2 | `voice-call-2` | 新一波人龍出現 | 「好吃的鹽酥雞、珍珠奶茶，快來喔！」 |
| C3 | `voice-sold-out` | 完售 | 「完售啦！謝謝大家捧場！」 |

錄音小提醒：在安靜的房間、手機離嘴巴約一個拳頭，語氣誇張一點更有夜市味；前後多留一點空白，我會剪掉。

## 進度

| 類別 | 數量 | 已交付 |
|---|---|---|
| 音效 | 12 | 0 |
| 背景音樂 | 1（＋選用環境音 1） | 0 |
| 叫賣語音 | 3 | 0 |
