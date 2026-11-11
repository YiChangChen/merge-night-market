---
baseline_commit: 4ac869d
---

# Story 3.4: 首次發明演出與賣出發明菜

Status: done

## Story

As a 玩家,
I want 第一次發明某道菜時看到「老闆發明！」的全螢幕慶祝，多做出來的發明菜也能賣錢,
so that 發現新菜是一件大事，棋盤滿了也有辦法清出空間。

## Acceptance Criteria

1. FxController 訂閱 `dish_invented`。`first` 為 true 時，Overlay Host 播放「老闆發明！」全螢幕演出，畫面包含發明菜、菜名、發明這道菜的老闆頭像與名字（FR25、UX-DR5；★1 卡牌的部分在 E5 接上）。
2. `first` 為 false 時，只在棋盤上做一個小的成功提示，不播放全螢幕演出。
3. 點選發明菜後，資訊列顯示菜名、份數，以及「賣出 🪙{dishSellPrice}」按鈕（沿用品項的點選 + 賣出按鈕，`src/features/board/` 的 InfoBar，UX-DR12）；每按一次只賣 1 份；`count` 歸 0 時清空格子，並取消選取（FR24、RC-6）。
4. `engine-test.ts` 補上測試：賣出發明菜時 count 3 → 2 → 1 → 清空，金幣累計正確。

## Tasks / Subtasks

- [x] T1 測試先行：`engine-test.ts` 賣出發明菜 3 → 2 → 1 → 清空、金幣累計、清空時放上待放產生器（AC4）
- [x] T2 規則：`sellPiece` 支援發明菜（一次 1 份）；`dishSellPrice` 移到 `engine.ts`（`invention.ts` 重新匯出，避免 engine ↔ invention 循環依賴）（AC3、AC4）
- [x] T3 資訊列搬到 `src/features/board/info-bar.tsx`（AC 指定的位置）：發明菜顯示「名稱 ×份數」與「賣出 🪙價格」；棋盤畫面賣出後，格子清空才取消選取（AC3）
- [x] T4 overlay store：`invention { recipe, token }`、`dishMade { recipe, token }`；FxController 依 `first` 分流（AC1、AC2）
- [x] T5 `features/overlays/invention-show.tsx`：全螢幕「老闆發明！」——光芒、發明菜大圖、菜名、老闆頭像與名字、預留 ★1 卡牌的位置；點一下跳過、約 3.2 秒自動結束；讀螢幕軟體唸出菜名與老闆（AC1）
- [x] T6 `dish-made-toast`：不擋操作的小提示「又做出一份 {菜名}！」，約 1.6 秒消失（AC2）
- [x] T7 Overlay Host：發明演出疊在最上層；返回鍵依序關閉 發明演出 → 完售演出 → 攤位面板
- [x] T8 測試：FxController 分流、演出內容與跳過／自動結束、提示、返回鍵、資訊列賣出
- [x] T9 驗證：lint、tsc、jest、iOS 打包
- [x] T10 **（使用者）** 實機：第一次發明的全螢幕演出、再做一次只有小提示、點選發明菜賣出 3 → 2 → 1 → 清空

## Dev Notes

- **賣出規則**：`sellPiece(state, cell)` 對發明菜：金幣 + `dishSellPrice(recipe)`；`count > 1` 時減 1、保留 id；`count === 1` 時清空並 `flushPendingGenerators`。產生器仍然不能賣。
- **取消選取**：棋盤畫面的 `handleSell` 目前一律 `setSelected(null)`。改成賣完後讀新的 state，格子空了才取消，發明菜還有剩時保持選取，方便連續賣。
- **演出模式**：沿用 S2.4 完售演出的寫法（overlay store 的遞增 token、`key={token}` 重播、JS 計時收尾、`accessibilityViewIsModal`、`announceForAccessibility`）。老闆頭像與名字來自 `STALLS[recipe.owner]`（`art.owner`、`owner.name`）。
- **提示的位置**：發明只會在棋盤上發生，所以提示放在 Overlay Host 的上方、`pointerEvents="none"`，不擋拖曳。
- **E5 的界線**：★1 卡牌（收藏冊）在 E5，這裡只留 `testID="invention-card-slot"` 的空位。
- 同一次拖放不會同時觸發完售與發明（完售只發生在交單），所以兩個全螢幕演出不會互相搶。

### Project Context Rules

- 副作用只能訂閱 `GameEvent`；FxController 不同步呼叫 `apply`。
- 獎勵（金幣）只能在規則層增加。
- 數值放 `content/balance.ts`；只屬於演出的時間常數可以放在元件裡。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: 首次發明演出與賣出發明菜]（FR24、FR25、UX-DR5、UX-DR12、RC-6）
- [Source: _bmad-output/implementation-artifacts/2-4-sellout-show.md]（全螢幕演出的模式）
- [Source: _bmad-output/implementation-artifacts/3-2-drop-resolution-rules.md]（`dish_invented` 事件）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`dishSellPrice` 不在 engine，新增的 2 個賣出測試失敗。
- `invention.ts` 原本 import `engine.ts` 的 `baseCost`。如果 `sellPiece` 反過來要用 `dishSellPrice`，就會互相 import，所以把 `dishSellPrice` 移到 engine，`invention.ts` 重新匯出，既有的 import 不變。
- 小提示用到 `useSafeAreaInsets`；實際 App 由 expo-router 根層提供 `SafeAreaProvider`（已確認 `ExpoRoot`），只有測試要自己包。

### Completion Notes List

- 賣出發明菜：`sellPiece` 一次賣 1 份，金幣 + `dishSellPrice`；還有剩時保留 id，最後一份賣完才清空並放上待放的產生器。產生器仍然不能賣。
- 資訊列搬到 `src/features/board/info-bar.tsx`（AC 指定的位置）：發明菜顯示「名稱 ×份數」與「賣出 🪙價格」。棋盤畫面賣出後，格子空了才取消選取，發明菜還有剩時保持選取，可以連續賣。
- `FxController`：`dish_invented` 的 `first` 為 true 時播放全螢幕演出，否則顯示小提示。
- `InventionShow`：深藍背景，標題「老闆發明！」落下，發明菜大圖彈出，背後有負責老闆的霓虹色光芒慢慢轉動，接著是菜名，最後老闆頭像與「{老闆}的新菜色」淡入。預留 `invention-card-slot` 給 E5 的 ★1 卡牌。點一下跳過或 3.2 秒後結束；讀螢幕軟體會唸出老闆與菜名。
- `DishMadeToast`：畫面上方「又做出一份 {菜名}！」，1.6 秒後消失，`pointerEvents="none"` 不擋拖曳。
- Overlay Host：疊放順序是攤位面板 → 完售 → 發明 → 小提示；返回鍵依序關閉發明 → 完售 → 面板（小提示不擋操作，不算）。
- 驗證：lint 0、tsc 0、jest 413 通過（新增 engine-test 2 個、invention-show-test 6 個、info-bar-test 3 個）、iOS 打包成功。
- T10：使用者實機確認通過（2026-11-11）。

### File List

- `src/features/overlays/invention-show.tsx`（新增）
- `src/features/overlays/dish-made-toast.tsx`（新增）
- `src/features/overlays/__tests__/invention-show-test.tsx`（新增）
- `src/features/board/info-bar.tsx`（新增，由 `(tabs)/index.tsx` 搬出）
- `src/features/board/__tests__/info-bar-test.tsx`（新增）
- `src/features/overlays/overlay-store.ts`、`fx-controller.ts`、`overlay-host.tsx`（修改）
- `src/features/board/index.ts`（修改）
- `src/game/engine.ts`、`src/game/invention.ts`（修改）
- `src/game/__tests__/engine-test.ts`（修改）
- `src/app/(tabs)/index.tsx`（修改）

## Change Log

- 2026-11-11：首次發明演出、重複發明小提示、賣出發明菜；狀態改為 review。

### Review Findings（code review 2026-11-11，範圍 4157530..22879ef）

- [x] [Review][Patch] （三層都抓到）選取記的是格子編號：棋盤滿時賣掉最後一份，待放的產生器會補進同一格，選取跑到產生器上；Lv3 升級用掉被選取格子的最後一份也一樣。改成記住棋子 id，id 不同就取消選取 [src/app/(tabs)/index.tsx]
- [x] [Review][Patch] 3.2 秒內連續兩次首次發明，第二次會蓋掉第一次的演出；改成排隊依序播放 [src/features/overlays/overlay-store.ts]
- [x] [Review][Patch] 光芒的無限動畫沒有在卸載時取消 [src/features/overlays/invention-show.tsx]
- [x] [Review][Patch] 演出一出現就能被點掉，發明後緊接著點產生器的那一下會直接關掉慶祝；前 0.4 秒不接受點擊（完售演出一併處理） [invention-show.tsx、sellout-show.tsx]
- [x] [Review][Patch] 小提示是唯一的覆蓋層時，結束時整層卸載，淡出動畫播不出來 [src/features/overlays/overlay-host.tsx]
- [x] [Review][Defer] Android TalkBack 仍可聚焦到演出底下的畫面（`accessibilityViewIsModal` 只對 iOS 有效） — deferred：要在根層佈局切換 importantForAccessibility，和 S7.x 無障礙檢查一起做
