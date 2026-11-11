---
baseline_commit: 71e3fa6
---

# Story 4.4: 阿嬤保底提示

Status: review

## Story

As a 玩家,
I want 同一道配方試錯 5 次之後，阿嬤跳出來直接告訴我兩個材料，而且一開放發明，她就先教我第一道,
so that 不管多不會猜，我都不會卡關。

## Acceptance Criteria

1. `src/game/invention.ts` 的 `recordRejection`（NP-3），由 `applyDrop` 在 reject 時呼叫。發生一次無效的發明嘗試時，`affected` 中每一道配方的 `failures` 都 +1，已發現的配方不計入（FR31）。
2. 某道配方的 `failures` 達到 5，而且不在 `meta.hintedRecipes` 裡時，把它加入 `hintedRecipes`，並 push `hint_shown { recipe }`。
3. 每道配方只會提示一次。
4. `upgradeStall` 讓 tea 和 fried 兩攤第一次同時達到 Lv2 時，對 `'tea-fried'` 走同一條路徑發出提示（FR32）。
5. FxController 收到 `hint_shown` 後，在 Overlay Host 顯示阿嬤立繪和對話框，直接說出兩個材料的名稱（UX-DR7）；點一下關閉。
6. `invention-test.ts` 涵蓋：一次失敗同時讓多道配方 +1、第 5 次觸發提示、不會重複提示、已發現的配方不計數、教學提示觸發。
7. Epic 4 完成定義：在只靠線索和提示、不看外部資料的情況下，可以發現所有已開放的配方；阿嬤立繪定稿；線索台詞改用 `docs/content.md` 的定稿，E4 範圍內的 `TODO(content)` 清零。

## Tasks / Subtasks

- [x] T1 美術：阿嬤立繪去背接上（`process-e4-art.py`，只移除和邊緣相連的洋紅，避免吃掉紫色外套），`art-manifest` #42 定稿；`content/characters.ts` 匯出 `GRANDMA_ART`（AC7）
- [x] T2 測試先行：`invention-test.ts`（AC1–AC4、AC6）、`drop-test.ts`（reject 會累計）、`stalls-test.ts`（教學提示）
- [x] T3 規則：`BALANCE.hintAfterFailures = 5`；`recordRejection`、`hintRecipe`（共用路徑：加入 `hintedRecipes`、送出 `hint_shown`）；`applyDrop` 的 reject 呼叫 `recordRejection`；`upgradeStall` 在 tea、fried 都到 Lv2 時提示 `tea-fried`；`GameEvent` 加上 `hint_shown`（AC1–AC4）
- [x] T4 演出：overlay store `hint` 與排隊（一次失敗可能同時讓兩道到 5 次）；FxController 處理 `hint_shown`；`features/overlays/grandma-hint.tsx`：左下角阿嬤立繪、右上方對話框「憨孫，{材料 A}配{材料 B}啦！」，點一下關閉（前 0.4 秒不接受點擊）；Overlay Host 疊在最上層、返回鍵先關它；棋盤冒熱氣在提示期間暫停（AC5）
- [x] T5 元件測試：提示內容、點一下關閉、排隊、返回鍵
- [x] T6 E4 完成定義檢查：`TODO(content)` 為 0；每一道配方都有線索台詞；提示路徑能涵蓋所有配方（AC7）
- [x] T7 反向驗證（E3 retro A4）：拿掉「已發現不計數」與「只提示一次」的檢查，確認測試失敗
- [x] T8 驗證：lint、tsc、jest、iOS 打包
- [x] T9 **（使用者）** 實機：tea、fried 升到 Lv2 時阿嬤教紅茶鹽酥雞套餐；組錯 5 次後阿嬤說出答案；**記下 iPhone 數字：分頁切換中位數，以及棋盤拖曳的感受**（E3 retro A1，寫進 E4 retro）

## Dev Notes

- **資料已經準備好**：S3.2 的 reject 帶著 `affected`（尚未發現、兩攤都 Lv2、含其中一個材料的配方）；E3 審查後，`affected` 為空時改走交換，不會進到這裡。
- **recordRejection(state, affected)**：對每一道配方：已發現就跳過；`failures + 1`；達到 5 次而且還沒提示過 → `hintRecipe`。新建的發明紀錄用 `{ discovered: false, made: 0, failures: 1, clueSeen: false }`，保留既有的 `clueSeen`。
- **事件順序**：`invent_rejected` 先送出，接著才是 `hint_shown`（演出：品項先彈回，阿嬤再出現）。
- **教學提示**：在 `upgradeStall` 結尾檢查「tea、fried 都 ≥ Lv2、`tea-fried` 還沒提示也還沒發現」。用 `hintedRecipes` 判斷「第一次」，所以不管先升哪一攤、之後再升 Lv3，都只會提示一次。
- **對話**：依 `docs/content.md` 的阿嬤口吻：「憨孫，紅茶配鹽酥雞啦！」——材料名稱用 `CHAINS[c].items[level − 1].name`，第二行補「拖在一起試試看」。
- **演出模式**：沿用 S3.4 的發明演出（overlay token、排隊、前 0.4 秒不接受點擊、`accessibilityViewIsModal`、`announceForAccessibility`）。
- **不擋操作太久**：提示不會自動消失（玩家需要時間看），點任何地方關閉。

### Project Context Rules

- 規則層純 TS；事件只由規則層送出，FxController 只讀。
- 熱路徑不寫 log；演出用 Reanimated。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await；用到 safe area 的元件測試要包 `SafeAreaProvider`。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4: 阿嬤保底提示]（FR31、FR32、UX-DR7）
- [Source: _bmad-output/game-architecture.md#NP-3 阿嬤保底計數（Pity Counter）]
- [Source: docs/content.md]（阿嬤口吻）、[docs/art-prompts-e4.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 美術：阿嬤的紫色外套接近洋紅，E3 的全圖顏色門檻會把外套吃掉。改成從圖片邊緣出發、只移除和邊緣相連的洋紅（黑色輪廓線把外套和背景隔開），邊緣一圈混色像素去色偏。淺色、深色背景上檢查都乾淨。
- 紅燈：`recordRejection`、`hintRecipe` 不存在，`hint_shown` 沒有送出。
- 反向驗證（E3 retro A4）：讓已發現的配方也計數 → 1 個測試失敗；讓同一道配方可以重複提示 → 2 個測試失敗；還原後全部通過。

### Completion Notes List

- 美術：`art-source/grandma-hint.png` → `assets/images/characters/grandma.webp`（762 × 1024），`content/characters.ts` 匯出 `GRANDMA_ART`；art-manifest #42 定稿。
- 規則：`BALANCE.hintAfterFailures = 5`；`hintRecipe`（加入 `hintedRecipes`、送出 `hint_shown`，只一次）；`recordRejection`（尚未發現的 affected 各 +1，保留 `clueSeen`，到 5 次提示）。`applyDrop` 的 reject 先送 `invent_rejected` 再累計，阿嬤出現在彈回之後。`upgradeStall` 結尾：tea、fried 都 ≥ Lv2 而且還沒發現紅茶鹽酥雞套餐時，教學提示（只一次）。
- 演出：overlay store `hint` 與排隊；FxController 處理 `hint_shown`；`GrandmaHint`：阿嬤從左下角滑進來（約 260 pt 高），右上方的對話框寫「阿嬤／憨孫，紅茶配鹽酥雞啦！／拖在一起試試看，就是「紅茶鹽酥雞套餐」」，點任何地方關閉（前 0.4 秒不算），讀螢幕軟體會唸出台詞。Overlay Host 疊在最上層，返回鍵先關它；提示期間棋盤冒熱氣暫停。
- E4 完成定義：`TODO(content)` 為 0；10 道配方都有線索台詞（content-test）與阿嬤台詞（`hintLine` 測試）；阿嬤立繪定稿。
- 驗證：lint 0、tsc 0、jest 489 通過（新增 invention-test 6 個、stalls-test 2 個、drop-test 1 個、grandma-hint-test 5 個）、iOS 打包成功（阿嬤立繪 131 KB）。
- 除錯面板加上「開新局」（使用者要測教學提示，而原本只能在讀檔失敗時開新局）：`debugNewGame` 由目前的種子推一步產生新種子；面板按下後先跳出確認，確認後把目前存檔複製到剪貼簿當備份，再換成新的一局（可以用「從剪貼簿匯入」還原）。新增 debug-test 1 個、debug-panel-test 1 個，jest 共 491 個。
- T9：使用者實機確認通過（2026-11-11）。iPhone 16（`--no-dev --minify`）分頁切換 11 次，中位數 33 ms（寫進 E4 retro）。

### File List

- `art-source/grandma-hint.png`、`art-source/scripts/process-e4-art.py`、`assets/images/characters/grandma.webp`（新增）
- `src/game/content/characters.ts`、`src/features/overlays/grandma-hint.tsx`、`src/features/overlays/__tests__/grandma-hint-test.tsx`（新增）
- `src/game/invention.ts`、`src/game/drop.ts`、`src/game/stalls.ts`、`src/game/events.ts`、`src/game/content/balance.ts`、`src/game/content/index.ts`（修改）
- `src/features/overlays/overlay-store.ts`、`fx-controller.ts`、`overlay-host.tsx`（修改）
- `src/app/(tabs)/index.tsx`（修改：提示期間暫停冒熱氣）
- `src/game/debug.ts`、`src/features/debug/debug-panel.tsx`（修改：開新局）
- 測試：`invention-test.ts`、`stalls-test.ts`、`drop-test.ts`（修改）
- `docs/art-manifest.md`（#42 定稿）

## Change Log

- 2026-11-11：阿嬤保底提示與教學提示；狀態改為 review。
