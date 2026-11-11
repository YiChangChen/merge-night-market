---
baseline_commit: 7a55be9
---

# Story 5.1: 卡牌資料與星等加成

Status: review

## Story

As a 玩家,
I want 每道發明菜做得越多，它的卡牌星等就越高，貴客單的加成也跟著提高,
so that 重複製作拿手菜也是一種成長。

## Acceptance Criteria

1. `src/game/content/cards.ts`：每道配方對應一張卡（FR33），內容包含卡面 `art`、`story`（2–3 句）、`owner`。故事用 `docs/content.md` 第 4 節的定稿，所以不需要 `TODO(content)`。
2. `cardStars(made)`：門檻依序為 1／3／6／10／15 份，對應 ★1 到 ★5；`made = 0` 時回傳 0，代表還沒取得（FR34）。
3. `cardBonus(state, recipe)` 依星等回傳 0／0.10／0.20／0.35／0.50，取代 E4 留下的固定 0；貴客單金幣改用這個加成計算（FR28）。
4. 星等是由 `made` 推算的衍生值，不寫入存檔（ADR-05）。
5. `applyDrop` 在 invent 時，如果 `made` 剛好跨過門檻，就 push `card_starred { recipe, stars }`；第一次做出來（0→1，★1）不算升星。
6. 卡面放在 `assets/images/cards/<recipe-id>.webp`，卡框有 `frame-normal` 和 `frame-gold` 兩種；`content-test` 檢查卡牌和配方一一對應。
7. `cards-test.ts` 涵蓋：門檻邊界值（2→★1、3→★2、14→★4、15→★5）、加成數值、升星事件只在跨門檻時觸發、貴客單金幣有套用加成。

## Tasks / Subtasks

- [x] T1 美術：原本計畫先做占位圖；實作途中使用者已交 12 張定稿圖，改為直接處理定稿。原圖改名放進 `art-source/`（`card-<id>.png`、`frame-*.png`），`process-e5-art.py` 縮成 768×1024 WebP、卡框去背，並檢查卡面內縮 `CARD_FACE_INSET` 的邊緣藏在兩種框條底下；art-manifest #43–#54 定稿（AC6）
- [x] T2 測試先行：新增 `src/game/__tests__/cards-test.ts`（AC2、AC3、AC5、AC7）；`content-test.ts` 加上卡牌段落（AC1、AC6）；確認測試失敗
- [x] T3 內容：`src/game/content/cards.ts` 定義 `CardDef`（`recipe`、`art`、`story`、`owner`）與 `CARDS`（`as const satisfies readonly CardDef[]`，順序同 RECIPES）、`CARDS_BY_RECIPE`、`CARD_FRAMES = { normal, gold }`；從 `content/index.ts` 匯出（AC1、AC6）
- [x] T4 規則：`src/game/cards.ts` 加上 `CARD_STAR_THRESHOLDS`、`CARD_STAR_BONUS`（放在 `BALANCE` 或 cards.ts，見 Dev Notes）、`cardStars(made)`、`cardBonus` 改依星等計算（AC2–AC4）
- [x] T5 事件：`GameEvent` 加上 `card_starred { recipe, stars }`；`applyDrop` 的 invent 分支在 `dish_invented` 之後，若星等比原本高而且原本 ≥ ★1，再 push `card_starred`（AC5）
- [x] T6 修正受影響的既有測試：`vip-test`、`drop-test`、`store-test` 等若用了 `made > 0` 的狀態，貴客單金幣會改變；逐一確認是預期的加成，不是硬改數字
- [x] T7 反向驗證（A4）：把 `cardBonus` 改回 0、把 `card_starred` 的「原本 ≥ ★1」條件拿掉，確認測試會失敗
- [x] T8 文件：`art-manifest` #43–#54 改為定稿並說明處理方式，進度表一併修正（E3、E4 先前漏更新）；`docs/balance.md` 沒有貴客單加成表，不需要改
- [x] T9 驗證：`npx expo lint`、`npx tsc --noEmit`、`npx jest`

### Review Findings

- [x] [Review][Decision] 卡面 #45 雞排麵線的人物不符：拿湯勺的是阿珍，不是故事裡的林嬸；art-manifest 卻標成定稿，也沒有記錄這個待決事項（auditor）— 使用者決定：重產。提示詞已寫入 `docs/art-prompts-e5.md`「#45 重產」，art-manifest 改回草稿
- [ ] [Review][Action] **（使用者）** 重產卡面 #45，交回後重跑 `process-e5-art.py`，art-manifest 改回定稿
- [x] [Review][Patch] 貴客單金幣的四捨五入受浮點誤差影響：tea-sweet 一攤 Lv2、一攤 Lv3 時，★2 得 379（應為 380），★5 得 517（應為 518）；noodle-sweet ★4 得 931（應為 932）（edge） [src/game/vip.ts:55]
- [x] [Review][Patch] 第一次發明不應同時送出 `card_starred`：存檔若是 discovered:false 但 made>0，會兩個事件一起送；條件要加上 `!first`（edge+blind） [src/game/drop.ts:126]
- [x] [Review][Patch] `debugAddCardMade` 接受非整數（例如 0.5）；要加 `Number.isInteger` 檢查（blind） [src/game/debug.ts]

## Dev Notes

### 目前狀態（會改的檔案）

- **`src/game/cards.ts`**：只有 `cardBonus(_state, _recipe)` 固定回傳 0，參數型別是 `Pick<GameState, 'inventions'>`。`vip.ts` 的 `vipOrder` 已經乘上 `(1 + cardBonus(state, recipe))`，S5.1 只要換掉回傳值，貴客單就會套用。
- **`src/game/invention.ts` 的 `recordInvention`**：每次做出發明菜 `made + 1`，回傳 `[first, nextState]`。`made` 只在這裡增加（只有 `applyDrop` 的 invent 會呼叫），所以升星事件放在 invent 分支就能涵蓋所有情況。
- **`src/game/drop.ts` invent 分支**：`createDish` → `recordInvention` → 放上棋盤 → `flushPendingGenerators` → push `dish_invented { recipe, first }`。
- **`src/game/events.ts`**：架構文件已預先定義 `{ type: 'card_starred'; recipe: RecipeId; stars: number }`，名稱照用。
- **`src/game/content/recipes.ts`**：每道配方已有 `owner`（ChainId）和發明菜圖示 `art`；卡面另外有自己的 `art`。

### 規則細節

- **`cardStars(made)`**：回傳「門檻 ≤ made」的個數。門檻 `[1, 3, 6, 10, 15]`；made 0→0、1–2→1、3–5→2、6–9→3、10–14→4、≥15→5。
- **`cardBonus(state, recipe)`**：`CARD_STAR_BONUS[cardStars(state.inventions[recipe]?.made ?? 0)]`，表為 `[0, 0, 0.10, 0.20, 0.35, 0.50]`（index 是星等；★0 和 ★1 都是 0）。
- **數值放哪裡**：門檻與加成都是平衡數值，放進 `content/balance.ts` 的 `BALANCE`（例如 `cardStarThresholds`、`cardStarBonus`），`balance-doc-test` 若有對照 `docs/balance.md` 就一起補上。
- **升星事件**：在 invent 分支比較 `cardStars(before)` 與 `cardStars(after)`；`after > before && before >= 1` 才 push。made 每次只加 1，所以一次最多升一星。事件順序：`dish_invented` 先，`card_starred` 後（S5.3 的演出依序播放）。
- **舊存檔（A4）**：星等是推算的，讀進 `made = 20` 的存檔不會補發事件，直接顯示 ★5；下一次再做也不會再發（已經 ★5，不會跨門檻）。在 cards-test 加一個「從 made = 14 的存檔做一份 → ★5 事件；made = 20 再做 → 沒有事件」的測試。
- **已開出的貴客單金幣不重算**：`vipOrder` 在建立訂單時就算好金幣，之後升星不會改已經在桌上的貴客單。這是預期行為（訂單價格在上門時決定），不需要處理。
- **存檔**：形狀沒有變，`SAVE_VERSION` 維持 2。不得在 state 裡存星等（ADR-05）。

### 會佔位的機制（E4 retro A3）

本 story 不新增任何會佔用欄位或名額的機制，不需要「離開方式」。

### 占位美術

- art-manifest 的 #43–#54 目前是「占位」。使用者正在依 `docs/art-prompts-e5.md` 產圖；這個 story 先用腳本產生占位圖，讓 `require` 和 content-test 能通過，S5.2 也能先做畫面。
- 卡面占位：768×1024，深色夜市底色，中央放 `assets/images/dishes/<id>.webp` 放大；卡框占位：RGBA，窗口與外圍透明，四邊框條約 6%，下方名牌約 18%。
- 長邊 1024，WebP。content-test 檢查卡面與卡框的長邊 ≤ 1024，以及 `cards/` 下的檔案是 10 張卡面 + 2 張卡框，不多不少。

### 測試

- `cards-test.ts`：
  - `cardStars`：0→0、1→1、2→1、3→2、5→2、6→3、9→3、10→4、14→4、15→5、99→5。
  - `cardBonus`：沒有紀錄→0、made 1→0、3→0.10、6→0.20、10→0.35、15→0.50。
  - 升星事件：用 `applyDrop` 實際組出發明菜。made 0→1 只有 `dish_invented { first: true }`；1→2 沒有 `card_starred`；2→3 有 `card_starred { stars: 2 }`；14→15 有 `{ stars: 5 }`；15→16 沒有。
  - 貴客單金幣：同一個 state、只改 made，`vipOrder(...).coins` 依加成變化（例如 made 15 = made 1 的 1.5 倍，四捨五入後比較）。
- `content-test.ts`：`CARDS` 和 `RECIPE_IDS` 一一對應、順序相同；每張卡的 `owner` 等於配方的 `owner`；`story` 和 `docs/content.md` 第 4 節表格逐字相同；卡面與卡框圖檔都存在、長邊 ≤ 1024。
- 測試輔助：`test-utils/webp-size.ts` 已經可以讀 WebP 尺寸。

### Project Context Rules

- 規則層 `src/game/**` 是純 TS，不得使用 `Date.now`、`Math.random`；`GameAction = (state, now) => GameState`。
- 事件只由規則層送出，訂閱者只讀。
- 衍生值不存檔（ADR-05）。
- 內容資料用 `as const satisfies readonly XxxDef[]`。
- 素材檔名 kebab-case，格式 WebP。
- 美術處理用 `python -m uv run --python 3.12 --with pillow`。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`；不要整檔格式化 `board.tsx` 與 `stall-panel.tsx`。
- 完成前要跑 lint、tsc、jest。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: 卡牌資料與星等加成]（FR33、FR34、FR28）
- [Source: _bmad-output/game-architecture.md]（ADR-05、Event System 的 `card_starred`、目錄結構 `assets/images/cards/`）
- [Source: docs/content.md 第 4 節]（卡牌故事定稿）
- [Source: docs/art-manifest.md #43–#54]、[docs/art-prompts-e5.md]
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-11-11.md]（cardBonus 已接上、made 已累計、A3、A4）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 反向驗證（A4）：`cardBonus` 改回固定 0 → cards-test 8 個失敗；拿掉「原本 ≥ ★1」條件 → 1 個失敗（0→1 送出了 card_starred）。還原後全部通過。
- `drop-test`「已發現的配方再做一次」原本用 made 2→3，會跨過 ★2 門檻；改成 3→4，讓那個測試只檢查 first = false，升星交給 cards-test。

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 卡牌內容 `content/cards.ts`：10 張卡（順序同 RECIPES）、`CARDS_BY_RECIPE`、`CARD_FRAMES`；故事逐字取自 content.md 第 4 節，content-test 逐字比對，沒有 `TODO(content)`。
- 星等規則放在 `BALANCE.cardStarThresholds`／`cardStarBonus`；`cardStars`、`cardBonus` 在 `src/game/cards.ts`，星等不存檔。貴客單金幣經由既有的 `vipOrder` 自動套用（132 → ★5 198）。
- `applyDrop` invent：`dish_invented` 之後，跨過門檻而且原本 ≥ ★1 時送出 `card_starred { recipe, stars }`。舊存檔不補發。
- 美術定稿：使用者在實作途中交了 12 張圖（1086×1448，3:4）。原先寫的占位圖腳本已刪除（再跑會蓋掉定稿圖）。
- 卡框外形不是方的（燈籠、屋簷凸出），卡面若鋪滿整張卡會從框外露出。改成卡面依 `CARD_FACE_INSET`（左右 8%、上 6%、下 10%）內縮放在框後；兩種框的窗口位置差不到 1%，這組數值兩種都蓋得住。腳本負責檢查，content-test 確認程式與腳本的數值一致（反向驗證：改腳本數值 → 1 個失敗）。**S5.2 畫卡牌時照這個比例放卡面。**
- 卡面 #45（雞排麵線）拿湯勺的是阿珍，不是故事裡的林嬸；先照用，是否重產由使用者決定。
- 驗證：jest 34 suites／577 tests 全過；`expo lint` 0；`tsc --noEmit` 0。

### File List

- `art-source/scripts/process-e5-art.py`（新增）
- `art-source/card-*.png`、`art-source/frame-*.png`（新增，原圖）
- `assets/images/cards/*.webp`（新增，12 張）
- `src/game/content/cards.ts`（新增）
- `src/game/content/index.ts`
- `src/game/content/balance.ts`
- `src/game/cards.ts`
- `src/game/events.ts`
- `src/game/drop.ts`
- `src/game/__tests__/cards-test.ts`（新增）
- `src/game/__tests__/content-test.ts`
- `src/game/__tests__/drop-test.ts`
- `docs/art-manifest.md`

## Change Log

- 2026-11-11：S5.1 實作完成（卡牌資料、星等與加成、升星事件、E5 美術定稿），狀態改為 review。
- 2026-11-11：E5 code review。修正貴客單金幣的浮點四捨五入（先收到小數 6 位）、首次發明不送升星事件、除錯加製作次數只收整數；卡面 #45 決定重產。
