---
baseline_commit: eddc767
---

# Story 3.2: 拖放解析規則（resolveDrop / applyDrop）

Status: review

## Story

As a 玩家,
I want 把兩條鏈的正確材料拖在一起就能發明，組錯就彈回去、什麼都不會損失，其他情況照舊交換位置,
so that 我可以放心亂試，不怕浪費高階品項。

## Acceptance Criteria

1. 新檔案 `src/game/drop.ts` 實作 NP-1。`resolveDrop(state, from, to)` 依序判定，先命中的優先：1 move、2 merge、3 stack、4 invent（`(A, B)` 不分順序符合某道配方，且兩攤都 ≥ Lv2）、5 reject（兩個品項都是「兩攤皆 ≥ Lv2」的配方材料，但湊不成同一道）、6 swap。產生器一律走 swap（FR3、FR21、FR22）。
2. `applyDrop(state, from, to, now)` 依判定結果套用：
   - invent：消耗兩個材料，在目標格產生 `DishPiece`（count 1）；`inventions[r].made + 1`；第一次做出來時 `discovered = true`；push `dish_invented { recipe, first }`
   - reject：state 完全不變，只 push `invent_rejected { recipes: affected }`
   - stack：目標格最多疊到 3，多出來的留在原格，保留目標格原本的 id（FR23）
   - merge：push `item_merged`
3. `movePiece` 改為內部函式，UI 不再直接呼叫它（RC-4）；既有的 merge、swap 測試繼續有效。
4. 兩攤有一攤還沒到 Lv2 時，就算材料正確也走 swap。
5. `drop-test.ts` 窮舉 6 種判定，以及這些邊界：反方向拖曳、已發現的配方再做一次、產生器、兩格都是同一道發明菜（count 2 + 2）、不同發明菜互拖、一攤 Lv1 一攤 Lv2。

## Tasks / Subtasks

- [x] T1 測試先行：`src/game/__tests__/drop-test.ts`（AC1、AC2、AC4、AC5）
- [x] T2 型別與事件：`DishPiece` 加進 `Piece`；`GameEvent` 加上 `dish_invented { recipe, first }`、`invent_rejected { recipes }`
- [x] T3 `drop.ts`：`DropResult`、`resolveDrop`、`applyDrop`；`invention.ts` 加上 `findRecipe`、`createDish`（工廠函式，遞增 `nextId`）
- [x] T4 存檔驗證接受 `kind: 'dish'`（`recipe` 是已知 id、`count` 為 1–3），補 `migration-test` 的接受與拒絕案例
- [x] T5 UI 接線（RC-4）：棋盤畫面的落子改成 `apply((s, now) => applyDrop(s, from, to, now))`；`PieceIcon` 能畫發明菜（圖示加 ×份數），資訊列顯示發明菜名稱。**最小可用版本**，搖頭彈回、冒熱氣、徽章樣式在 S3.3
- [x] T6 驗證：lint、tsc、jest、iOS 打包
- [x] T7 **（使用者）** 實機：除錯面板把 tea、fried 調到 Lv2，拖紅茶 L3 到鹽酥雞 L3 做出紅茶鹽酥雞套餐；同一道菜疊加；組錯時不消耗（S3.3 之前只會原地不動，沒有動畫）

## Dev Notes

### 範圍決定（和 S3.3 的界線）

S3.2 的 AC3 要求 UI 不再呼叫 `movePiece`，所以這個 story 就要把落子接到 `applyDrop`。接上之後玩家就能真的做出發明菜，所以 `PieceIcon` 一定要能畫發明菜，否則 `CHAINS[piece.chain]` 會在 render 時崩潰。這裡只做「不會壞」的最小版本：圖示加一個簡單的 ×N。S3.3 負責正式的份數徽章（右下角）、reject 的搖頭彈回、L4+ 冒熱氣，並確認拖曳手感不變。

### 判定細節（NP-1，[Source: _bmad-output/game-architecture.md#NP-1 拖放解析（Drop Resolution）]）

- **不合法的拖放**（同一格、超出範圍、來源是空格）回傳 `null`，`applyDrop` 回傳原 state。
- **merge**：兩個都是品項、同鏈同階、未達最高階（沿用 `canMerge`）。新棋子有新的 id（`findMerges` 依賴這點）。事件 `item_merged { chain, level: 合成後的階數 }`。
- **stack**：兩個都是發明菜、同一道配方、目標格 `count < 3`。`moved = min(來源份數, 3 − 目標份數)`；目標保留原 id；來源剩 0 份時清空。來源格變空時要 `flushPendingGenerators`。
- **invent**：兩個都是品項、不同鏈、`findRecipe` 找得到（不分方向），而且 `stalls[a.chain]`、`stalls[b.chain]` 都 ≥ Lv2。在**目標格**放 `createDish`，來源格清空，`flushPendingGenerators`。已發現的配方也可以再做（`first: false`）。
- **reject**：兩個都是品項、不同鏈，而且兩者各自都是某道「兩攤皆 ≥ Lv2」配方的材料，但湊不成同一道。`affected` = 所有**尚未發現**、兩攤都 ≥ Lv2、且材料包含這兩個品項其中之一的配方（給 NP-3 阿嬤保底用，S4.x 才會累計失敗次數）。affected 為空時仍然是 reject（彈回），只是不會累計。
  - 同鏈的兩個品項不會走 reject：同階可合成就是 merge，最高階或不同階就是 swap，避免拖兩個一樣的東西也被當成「發明失敗」。
- **swap**：其他情況，包含產生器、發明菜對品項、不同發明菜、目標已滿 3 份的同一道發明菜。
- **move**：目標是空格（產生器、發明菜也可以移動）。

### 要修改的檔案

| 檔案 | 現在 | 這個 story 要改的 |
|---|---|---|
| `src/game/types.ts` | `Piece = ItemPiece \| GeneratorPiece`，`DishPiece` 已定義但沒加入 | 加入 `Piece` |
| `src/game/events.ts` | 沒有發明相關事件 | 加 `dish_invented`、`invent_rejected` |
| `src/game/engine.ts` | `movePiece` 匯出給 UI；`flushPendingGenerators` 私有 | `movePiece` 留在規則層內部使用（測試與 `applyDrop`）；匯出 `flushPendingGenerators` 給 drop.ts |
| `src/game/save/validate.ts` | `isValidPiece` 拒絕 dish | 接受合法的 dish |
| `src/app/(tabs)/index.tsx` | `handleMove` 呼叫 `movePiece`；`InfoBar` 只處理品項與產生器 | 改呼叫 `applyDrop`；`InfoBar` 顯示發明菜 |
| `src/features/board/board.tsx` | `PieceIcon` 只處理品項與產生器 | 加發明菜分支（**不動拖曳手勢**） |

- `findOrderCells`、`sellPiece`、`findSpawns`、`findMerges` 都只看 `kind === 'item'`，發明菜不會被交單、賣出（S3.4 才加賣發明菜）或誤判成合成。
- 存檔：`DishPiece` 的形狀在 S1.5 就定好了，接受它是「接受更多」，不升版（`validate.ts` 開頭的註解）。

### Project Context Rules

- 拖放結果只能由 `resolveDrop` 判定；UI 只能呼叫 `applyDrop`（project-context）。
- 實體只能透過規則層的工廠函式建立（`createDish` 回傳 `[piece, nextState]` 並遞增 `nextId`）。
- 不得重構 `features/board/board.tsx` 已調校好的拖曳手勢（commit e4be9f6）。
- 時間一律由 `apply` 傳入。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: 拖放解析規則（resolveDrop / applyDrop）]
- [Source: _bmad-output/game-architecture.md#NP-1 拖放解析（Drop Resolution）、#NP-3 阿嬤保底計數、#Entity Patterns]
- [Source: _bmad-output/implementation-artifacts/3-1-recipe-and-dish-data.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`drop.ts` 不存在。
- `RecipeDef.id` 是寬鬆的 `string`，從 `findRecipe` 拿到的 id 不能放進 `RecipeId` 的欄位。新增 `Recipe = (typeof RECIPES)[number]`（字面量 id），規則層一律用它；`RECIPES_BY_ID` 也改成這個型別。
- 棋盤元件的測試要包在 `GestureHandlerRootView` 裡（拖曳手勢 v3 會檢查）。

### Completion Notes List

- `drop.ts`：`resolveDrop` 依 move → merge → stack → invent → reject → swap 判定；不合法的拖放回傳 null。`applyDrop` 是 UI 落子的唯一入口：merge 送 `item_merged`；stack 保留目標 id、來源剩 0 份時清空；invent 在目標格放 `createDish`、更新 `inventions`、送 `dish_invented { first }`；reject 只送 `invent_rejected`，state 其餘不變。騰出空格的結果（stack、invent）會放上待放的產生器。
- 判定的小決定：同鏈的兩個品項不走 reject（同階已經是 merge，其餘交換），避免拖兩個同類東西也被算成發明失敗；`affected` 為空時仍然 reject（彈回），只是不會累計阿嬤保底。
- `invention.ts`：`findRecipe`（不分方向）、`canInvent`、`inventableRecipes`、`isIngredientOf`、`createDish`（工廠，遞增 nextId）、`recordInvention`。
- 型別與事件：`DishPiece` 加進 `Piece`；新增 `dish_invented`、`invent_rejected`；`flushPendingGenerators` 匯出給 drop.ts；`movePiece` 只在規則層內部使用。
- 存檔驗證接受合法的發明菜（已知配方、1–3 份），拒絕未知配方與份數 0、4。
- UI 最小接線（RC-4）：棋盤畫面落子改成 `apply((current, now) => applyDrop(current, from, to, now))`；`PieceIcon` 畫得出發明菜，2 份以上顯示 ×N；資訊列顯示「名稱（發明菜）×N」。沒有改動拖曳手勢。搖頭彈回、冒熱氣、正式徽章在 S3.3。
- 驗證：lint 0、tsc 0、jest 394 通過（新增 drop-test 24 個、board-dish-test 1 個、migration-test 淨增 3 個）、iOS 打包成功。
- T7：使用者實機確認通過（2026-11-11）。

### File List

- `src/game/drop.ts`（新增）
- `src/game/__tests__/drop-test.ts`（新增）
- `src/features/board/__tests__/board-dish-test.tsx`（新增）
- `src/game/invention.ts`（修改）
- `src/game/content/recipes.ts`（修改）
- `src/game/types.ts`（修改）
- `src/game/events.ts`（修改）
- `src/game/engine.ts`（修改）
- `src/game/save/validate.ts`（修改）
- `src/game/save/__tests__/migration-test.ts`（修改）
- `src/features/board/board.tsx`（修改：只動 `PieceIcon`、`PieceView`）
- `src/app/(tabs)/index.tsx`（修改）

## Change Log

- 2026-11-11：拖放解析規則與最小 UI 接線；狀態改為 review。
