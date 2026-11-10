---
baseline_commit: b798e80
---

# Story 3.1: 配方與發明菜資料

Status: review

## Story

As a 開發者,
I want 把 10 道配方和發明菜整理成有型別、測試會自動檢查的內容資料,
so that 判定規則、演出和之後的卡牌都從同一份資料取值，不會各寫各的。

## Acceptance Criteria

1. `src/game/content/recipes.ts` 定義 10 道配方。每道配方有 `id`（kebab-case，例如 `'tea-fried'`）、`a`／`b`（鏈與階數）、`name`、`clue`、`owner`（StallId）、`art`。材料與階數依 GDD M4 表，型別寫法為 `as const satisfies readonly RecipeDef[]`，並匯出 `RecipeId`（FR26）。
2. 名稱和台詞還沒定稿的配方先用 GDD 的暫定值，加上 `// TODO(content)` 註記。（`docs/content.md` 已在 S1.0 定稿，所以不會有 TODO）
3. 發明菜圖示放在 `assets/images/dishes/<recipe-id>.webp`。（E3 美術已在 2026-11-11 定稿，直接用正式圖）
4. `content-test.ts` 檢查：每道配方的鏈和階數都存在；每條鏈恰好出現在 4 道配方；沒有同鏈配方；10 個 id 不重複；每個 id 都有對應的圖片。
5. 衍生函式 `dishSellPrice(recipe) = (baseCost(a) + baseCost(b)) × 1.5` 有測試。

## Tasks / Subtasks

- [x] T1 測試先行：`src/game/__tests__/content-test.ts`（AC1–AC4）與 `invention-test.ts`（AC5）
  - [x] 10 道配方的 id、名稱、材料、負責老闆、線索台詞和 `docs/content.md` 第 2、3 節一致（材料用 `CHAINS[c].items[level − 1].name` 比對，例如 tea L3 = 紅茶）
  - [x] 每條鏈恰好 4 道、沒有同鏈配方、id 不重複且是 `<a>-<b>` 的 kebab-case
  - [x] `assets/images/dishes/` 的檔案和 `RecipeId` 一一對應（不多不少）
  - [x] `dishSellPrice`：10 道全部列出期望值
- [x] T2 `content/recipes.ts`：`RecipeDef`、`RECIPES`、`RecipeId`、`RECIPE_IDS`、`RECIPES_BY_ID`；`content/index.ts` 匯出（AC1、AC3）
- [x] T3 `types.ts`：`RecipeId` 改成從 content 匯入的字面量聯集，拿掉 `TODO(S3.1)`；既有的 `import { RecipeId } from './types'` 路徑保留
- [x] T4 存檔驗證：`signatureDish`、`inventions` 的鍵、`hintedRecipes` 只接受已知的 `RecipeId`。只會更嚴格，舊存檔這些欄位都是空的，不需要升版。`DishPiece` 仍然在 S3.2 才加進 `Piece`
- [x] T5 `src/game/invention.ts`：`dishSellPrice(recipe)`；倍率 1.5 放在 `BALANCE.dishSellMultiplier`（AC5）
- [x] T6 驗證：lint、tsc、jest

## Dev Notes

- **內容來源**：`docs/content.md` 第 2 節（配方）、第 3 節（線索台詞）已定稿，直接照抄，不加 `TODO(content)`。材料階數：tea-fried 紅茶 L3＋鹽酥雞 L3、tea-noodle 鮮奶茶 L4＋蚵仔麵線 L4、fried-noodle 大雞排 L4＋麵線 L3、tea-dumpling 鮮奶茶 L4＋煎餃 L4、fried-dumpling 炸物拼盤 L5＋煎餃 L4、noodle-dumpling 大腸麵線 L5＋小籠包 L5、tea-sweet 珍珠奶茶 L5＋雞蛋糕 L3、fried-sweet 鹽酥雞 L3＋地瓜球 L2、noodle-sweet 總匯麵線 L6＋糖葫蘆 L4、dumpling-sweet 蒸籠拼盤 L6＋芒果冰 L5。
- **檔案位置**：架構〈Project Structure〉把配方判定、發明菜、失敗計數放在 `game/invention.ts`，所以 `dishSellPrice` 也放這裡（`baseCost` 在 `engine.ts`，`content/` 不能反過來 import engine）。
- **循環依賴**：`types.ts` 只用 `import type` 取得 `RecipeId`；`content/recipes.ts` 不 import `types.ts`。
- **素材**：`require` 只能寫在 `content/`（專案規則），測試用 `fs` 讀 `assets/images/dishes/` 比對檔名。圖檔是 343 px 正方形，S1.10 的尺寸測試寫法可以參考（`content-stalls-test.ts` 解析 WebP 標頭），長邊 ≤ 512。
- **E3 之後的界線**：`resolveDrop`／`applyDrop` 在 S3.2；棋盤畫發明菜在 S3.3；賣出發明菜的 UI 在 S3.4（這裡只提供價格函式）。

### Project Context Rules

- 內容與數值只放在 `src/game/content/*.ts`（`as const satisfies`）。
- 各類 ID 一律用字面量型別；常數表 UPPER_SNAKE。
- 規則層純 TS；測試放 `__tests__/<module>-test.ts`，規則層不 mock。
- 存檔形狀沒有改變，不遞增 `SAVE_VERSION`；驗證變嚴格要補 `migration-test.ts` 的拒絕案例。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: 配方與發明菜資料]
- [Source: docs/content.md#2. 配方（FR26）、#3. 線索台詞（FR30）]
- [Source: _bmad-output/game-architecture.md]（content/ 結構、`content-test.ts`、字面量 ID）
- [Source: _bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/gdd.md]（發明菜賣出 = 材料 baseCost 總和 × 1.5）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`invention.ts` 不存在、`RECIPES` 還沒匯出，10 個測試全部失敗。
- jest-expo 預設把 `__tests__/` 底下的每個檔案都當成測試，所以 WebP 尺寸讀取工具抽到專案根目錄的 `test-utils/webp-size.ts`，S1.10 的 `content-stalls-test.ts` 也改用它。

### Completion Notes List

- `content/recipes.ts`：10 道配方照 `docs/content.md` 定稿，沒有 `TODO(content)`；`RECIPES`（`as const satisfies readonly RecipeDef[]`）、`RecipeId`、`RECIPE_IDS`、`RECIPES_BY_ID`；圖示直接用 E3 定稿美術。
- `types.ts`：`RecipeId` 改成從 content 匯入的字面量聯集並重新匯出，既有的 import 路徑不變。
- 存檔驗證：`signatureDish`、`inventions` 的鍵、`hintedRecipes` 只接受已知的配方 id。只會更嚴格，舊存檔這些欄位都是空的，不升版。
- `invention.ts`：`dishSellPrice`，倍率 `BALANCE.dishSellMultiplier = 1.5`。10 道配方的價格從 9（甜鹹地瓜雞）到 72（冰火小籠塔）。
- `content-test.ts`：名稱、材料（用品項名稱加鏈與階數比對定稿表格）、負責老闆、線索台詞都和 `docs/content.md` 一致；每條鏈 4 道、沒有同鏈、id 等於「A 鏈-B 鏈」；`dishes/` 的檔案和 id 一一對應，長邊 ≤ 512。
- 驗證：lint 0、tsc 0、jest 366 通過（新增 content-test 37 個、invention-test 10 個、migration-test 4 個）、iOS 打包成功（10 張發明菜圖示都有打包）。

### File List

- `src/game/content/recipes.ts`（新增）
- `src/game/invention.ts`（新增）
- `src/game/__tests__/content-test.ts`（新增）
- `src/game/__tests__/invention-test.ts`（新增）
- `test-utils/webp-size.ts`（新增）
- `src/game/content/index.ts`（修改）
- `src/game/content/balance.ts`（修改）
- `src/game/types.ts`（修改）
- `src/game/save/validate.ts`（修改）
- `src/game/save/__tests__/migration-test.ts`（修改）
- `src/game/__tests__/content-stalls-test.ts`（修改）

## Change Log

- 2026-11-11：配方與發明菜資料；狀態改為 review。
