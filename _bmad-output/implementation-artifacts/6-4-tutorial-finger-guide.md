---
baseline_commit: aa6202c
---

# Story 6.4: 新手手指引導

Status: review

## Story

As a 第一次打開遊戲的玩家,
I want 有一隻手指帶我依序完成合成、出餐、去夜市街升級,
so that 我在一分鐘內就懂這款遊戲要怎麼玩。

## Acceptance Criteria

1. `src/features/tutorial/`，進度記在 `meta.tutorialStep`。新局第一次啟動時，依序引導 3 個步驟，每一步都由實際的 GameEvent 推進，而不是固定時間（FR40、UX-DR11）：
   1. 點產生器並合成一次（收到 `item_merged`）
   2. 完成一張訂單（收到 `order_completed`）
   3. 切到夜市街，升級一個攤位（收到 `stall_upgraded`）
2. 引導期間只顯示手指動畫和一句說明，不遮擋操作；玩家自行完成步驟也算數。
3. 3 步完成後 `tutorialStep` 標記為完成，之後不再出現；中途關閉 App，重開後從同一步繼續。
4. 為了讓第 3 步一定能完成，教學完成前，tea 或 fried 第一次升 Lv2 所需的金幣必須存得到：用 S1.6 的 `expectedOrderCoins` 驗證，新局在 8 張訂單以內就能存到 200 金幣。不夠的話調整新手訂單，並記錄在 `docs/balance.md`。
5. v1 遷移的玩家，`tutorialStep` 在遷移時已設為完成（S1.5），所以不會出現教學。
6. Epic 6 完成定義：新玩家第一天就能完成第一次攤位升級；開飛航模式從冷啟動開始可以完整遊玩，只有廣告按鈕被隱藏（NFR6）。

## Tasks / Subtasks

- [x] T1 規則測試先行：`tutorial-test.ts`
  - `advanceTutorial`：三步依序推進；不是這一步的事件不推進；同一批事件可以連續推進；完成後不再變動。
  - 第 3 步：已經有攤位 ≥ Lv2 時，直接算完成。
  - 教學期間新訂單金幣 ×2.5；教學完成後恢復。
  - 金幣驗證：用 `expectedOrderCoins` 算 8 張訂單；再用 50 個 seed 實際交 8 張單，都要 ≥ 200。
  - v1 遷移不出現教學；`store` 的 `apply` 會推進教學。
- [x] T2 規則：
  - `src/game/tutorial.ts`：`advanceTutorial(state)`，加上 `tutorialDone`、`tutorialOrderCoinMultiplier`。
  - store 的 `apply` 在 action 之後呼叫 `advanceTutorial`。
  - `createOrder` 的一般單金幣在教學期間 ×2.5。
  - BALANCE 新增 `tutorialOrderCoinMultiplier: 2.5`。
  - `docs/balance.md` 記錄這次的調整。
- [x] T3 UI 測試先行：`tutorial-guide-test.tsx`
  - 依步驟指向目標；第 3 步金幣不夠時不顯示手指，只顯示說明。
  - 手指層是 `pointerEvents="none"`。
  - 有阻擋演出（完售、發明、阿嬤提示）時隱藏手指。
  - 教學完成後什麼都不顯示。
  - 棋盤資訊列與夜市街顯示這一步的說明。
- [x] T4 `features/tutorial/`：
  - `tutorial-targets.ts`：目標位置的登記表，以及 `useTutorialTarget(id, active)`（用 `measureInWindow`）。
  - `tutorial-guide.tsx`：根層的手指層，不擋觸控。
  - `tutorialLine(step, …)`：每一步的說明文字。
- [x] T5 目標登記：
  - 棋盤：`board` 外框，手指指向第一個產生器的格子。
  - 第一張訂單：`order`。
  - 分頁列的夜市街按鈕：`tab-street`。
  - 夜市街的攤位：`stall-tea`、`stall-fried`，只在夜市街在前景時登記。夜市街捲動停止時重新量測。
  - 攤位面板的升級按鈕：`upgrade`。
- [x] T6 說明文字：
  - 棋盤畫面：沒有選取棋子時，資訊列顯示這一步的說明。
  - 夜市街：標題列下方顯示一行說明，`pointerEvents="none"`。
- [x] T7 反向驗證（A4、E5 retro A5）：
  - 拿掉「不是這一步的事件不推進」。
  - 拿掉「手指層不擋觸控」。
  - 拿掉「教學期間金幣加成」。
  - 以上三項都要讓測試失敗。
- [x] T8 驗證：lint、tsc、jest；換行都是 LF
- [x] T9 **（使用者）** 實機：
  - 除錯「開新局」後跟著手指走完 3 步，確認手指位置正確、不擋操作。
  - 中途關掉 App 重開，從同一步繼續。
  - 開飛航模式冷啟動，可以完整遊玩（NFR6）。

## Dev Notes

### 目前狀態

- `meta.tutorialStep` 從 S1.5 就有，新局是 0；v1 遷移時設為 `BALANCE.tutorialSteps`（3）；存檔驗證限制在 0–3。
- 事件來源：
  - `item_merged`：`drop.ts` 合成時送出。
  - `order_completed`：`engine.completeOrder`。
  - `stall_upgraded`：`stalls.upgradeStall`。
- store 的 `apply`：syncAll → action → 分派事件 → 清空事件。
- `tutorialHint`（S4.4，阿嬤的教學提示）是另一個機制，和這個 story 無關，不要動。
- 棋盤畫面（`src/app/(tabs)/index.tsx`）由上往下是 Hud、QueueMeter、Orders、InfoBar、Board。InfoBar 沒有選取棋子時，顯示固定文字「點產生器出食材，拖曳相同品項合成」。

### 金幣（AC4）

- Lv1 的訂單都是 L2（每張 10 金幣、2 XP）。做完 5 張升 Lv2，之後每張期望 15 金幣。前 8 張合計約 85 金幣，`docs/balance.md` 在 S1.6 已經記下這個問題。
- 調整：教學期間（`tutorialStep < 3`）建立的一般單，金幣 ×2.5，在建立訂單時鎖定（RC-3）。Lv1 每張 25，8 張最少 200（前 7 張一定是 Lv1，第 8 張至少 25）。教學完成後新訂單恢復原價。
- 貴客單與線索單不受影響（教學期間還沒有發明菜，不會出現）。

### 教學推進（規則層）

- `advanceTutorial(state)` 是純函式，只看這一批的 `state.events` 與攤位等級。
  - step 0 + `item_merged` → 1
  - step 1 + `order_completed` → 2
  - step 2 + `stall_upgraded`，或已經有攤位 ≥ Lv2 → 3
  - 同一批事件可以連續推進：例如交單讓 XP 升級，又剛好是下一步的事件。
- 玩家自行完成也算：推進只看事件，不管有沒有照手指做。
- 放在 store 的 `apply`，在 action 之後執行，所以每個動作都會經過（E4 retro：觸發放在每次結算都會經過的地方）。

### 手指（UI）

- **目標登記**：元件用 `useTutorialTarget(id, active)` 回報自己在視窗中的位置；不在前景或卸載時登記為 null。
- **手指層**：
  - 掛在根層的 `TutorialGuide`，`pointerEvents="none"`。
  - 依步驟挑目標，手指以上下擺動的動畫指向目標中心。
  - 目標不存在時（例如在別的分頁）就不顯示。
- **第 3 步的目標優先順序**：升級按鈕（攤位面板開著）→ 夜市街上有錢可以升級的攤位（tea 優先）→ 分頁列的夜市街按鈕。
  - 金幣不夠時（tea 和 fried 都還不能升級）不顯示手指，只顯示說明和目前金幣（x/200），免得玩家一直被帶去夜市街。
- **隱藏手指**：有阻擋演出（完售、發明、阿嬤提示）時隱藏。手指不擋觸控，但會蓋住演出畫面。
- **底下有什麼（E5 retro A1）**：手指只是一個約 40 pt 的圖示，畫在目標上面，不攔截觸控。說明文字放在既有的位置（資訊列、夜市街標題下方），不另外佔版面。

### 會佔位的機制（E4 retro A3）

這個 story 沒有會佔位的東西：手指與說明都不攔截觸控，教學完成後消失。

### Project Context Rules

- 規則層是純 TS；UI 只透過 selector 讀 store、透過 `apply` 改狀態。
- Reanimated 用 `.get()`／`.set()`。
- RNTL 14：`render`、`fireEvent`、`act` 都要 await。
- 換行用 LF（E5 retro A4）。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]（FR40、UX-DR11、NFR6）
- [Source: docs/balance.md]（S1.6 觀察）
- [Source: epic-5-retro-2026-11-11.md]（A1–A5）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 新手金幣倍率讓 `stall-orders-test` 2 個測試失敗（拿開局訂單和原價比較）。這兩個測試要測的是攤位加成，改成在教學已完成的局裡測。`info-bar-test` 同理：教學期間資訊列顯示的是教學說明。
- 手指層的 `features/tutorial` 依賴 overlays（隱藏手指的條件），攤位面板又要登記升級按鈕，兩者會互相 import。拆成三個檔案：
  - `tutorial-targets`：只依賴 game。
  - `tutorial-line`：只依賴 game。
  - `tutorial-guide`：依賴 overlays，只在根層使用。
  - 面板、棋盤、夜市街、分頁列只 import 前兩個。
- RN 0.88 的 View ref 型別改成 `ComponentRef<typeof View>`。React Compiler 的 lint 會擋「render 時讀取 hook 回傳的 ref」，改成 callback ref，面板裡用解構後的名稱。
- `git stash pop` 在 autocrlf 設定下把 4 個檔案寫回 CRLF，用 LF 檢查腳本修正。
- Prettier 重排了 `tab-bar.tsx` 一行原本沒動的程式，已還原。
- 實機回饋（飛航模式下）：
  - **手指位置偏上**：大約差一個狀態列的高度。原因是棋盤只在 onLayout 時量一次；安全區晚一步套用後整個畫面下移，但棋盤相對父層的位置沒變，所以不會再觸發 onLayout。修正：教學期間每 0.5 秒重新量測，教學完成後在顯示提示前重量一次。
  - **合成提示**：產生兩個相同品項後，手指應該消失，改成提示哪兩個可以合成；教學完成後也要當作小提示。新增：
    - 規則層 `findMergePair`。
    - 第 1 步有一對可以合成時，圈出兩格，手指示範拖曳。
    - 沒有手指要指時，棋盤停著 6 秒（`IDLE_HINT_MS`），顯示同樣的提示；棋盤一變動就消失並重新計時。
  - 反向驗證：第 1 步不改提示 → 1 個失敗；不等閒置就提示 → 1 個失敗。
  - **第 2 步卡住**：手指固定指第一個產生器（手搖飲），但這局的訂單都要炸物的生雞肉；第 2 步又只指訂單，玩家不知道要做什麼。修正：新增規則層 `tutorialFocus`／`tutorialFocusLine`（`src/game/tutorial-focus.ts`），依第一張一般單決定：
    - 第 1 步：指訂單要的那條鏈的產生器；有一對可以合成時提示合成，訂單要的鏈優先。
    - 第 2 步：
      - 有訂單做得出來時，指那張訂單（訂單目標改成每一格各自登記 `order-0`～`order-2`）。
      - 否則提示合成訂單要的品項（只合成比需要的階數低的）。
      - 再沒有，就指那條鏈的產生器。
    - 說明文字寫出品項名稱，例如「點炸物鍋做出「生雞肉」，再點訂單出餐」。
    - `findMergePair` 加上篩選條件。
    - 反向驗證：不看訂單、指第一個產生器 → 5 個失敗。
  - **小提示改成晃動**（使用者要求）：教學完成後的合成小提示，不再用「框加手指」，改成讓可以合成的兩個品項左右晃動。
    - `features/tutorial/merge-hint.ts` 的 `useIdleMergePair`：教學第 3 步起，棋盤在前景、沒有演出蓋住，棋盤停著 6 秒時回傳那一對。
    - 棋盤畫面把結果傳給 `Board` 的 `hintCells`，`BoardCell` 用 `Wobble` 包住棋子並晃動。
    - 手指層只保留教學第 1、2 步的「圈兩格」。
    - 反向驗證：不等閒置 → 1 個失敗；棋盤不晃 → 1 個失敗。
  - **升級演出太快**（使用者實機回饋，第 3 步升級時發現；不在原本的 AC 範圍，屬於體驗修正）：
    - 招牌通電 `NEON_POWER_ON_MS` 從 0.9 秒拉長到 2 秒，多閃幾下。
    - 外觀交叉淡入從 0.28 秒放慢到 0.6 秒；變大時先長到 1.12 倍再彈回。
    - 新增 `street/upgrade-burst.tsx`：白光一閃、8 顆星星往外散開、「升級！」加「Lv2 店面」彈出後往上飄走。只在升級（Lv2、Lv3）時播放，重開攤位由鐵捲門演出負責。
    - 升級後的阿嬤提示延後 `HINT_AFTER_UPGRADE_MS` 從 1 秒改成 2.2 秒，等慶祝播完。
    - 反向驗證：重開也播慶祝 → 1 個失敗。
- 反向驗證（A4）：
  - 任何教學事件都推進 → 10 個失敗。
  - 拿掉新手金幣 → 3 個失敗。
  - 手指層擋觸控 → 1 個失敗。
  - 還原後全部通過。

### Completion Notes List

- 規則（`src/game/tutorial.ts`）：
  - `advanceTutorial`：依這一批事件推進，順序是合成 → 出餐 → 升級；不是這一步的事件不推進，同一批事件可以連續推進。第 3 步在已經有攤位 ≥ Lv2 時直接完成。
  - store 的 `apply` 在 action 之後呼叫；`hydrate` 也檢查一次。
  - `tutorialDone`、`tutorialOrderCoinMultiplier`。
- 新手金幣（AC4）：教學期間建立的一般單金幣 ×2.5（`BALANCE.tutorialOrderCoinMultiplier`），8 張最少 200。驗證方式：`expectedOrderCoins` 推算，加上 50 個 seed 實測。調整記錄在 `docs/balance.md`。
- 手指（`features/tutorial/`）：
  - 目標登記表與 `useTutorialTarget`（`measureInWindow`；不在前景或教學完成時不量測）。
  - 根層的 `TutorialGuide` 不擋觸控，依步驟指向：產生器格子 → 第一張訂單 → 夜市街分頁、攤位、升級按鈕。
  - 第 3 步金幣不夠時不指。
  - 有全螢幕演出時隱藏；攤位面板開著時，只有第 3 步顯示。
- 說明文字：
  - 棋盤資訊列：沒有選取棋子時顯示這一步的說明。
  - 夜市街：標題下方的說明列（第 3 步），金幣不夠時顯示「目前 x/200」。
- 目標登記：
  - 棋盤外框、第一張訂單：棋盤分頁在前景時。
  - 分頁列的夜市街按鈕。
  - 手搖飲、炸物攤位：夜市街在前景時；捲動停止後重新量測。
  - 攤位面板的升級按鈕：只有開局的兩攤。
- 合成提示（實機回饋後新增）：
  - `findMergePair` 找出棋盤上第一對可以合成的相同品項。
  - 第 1 步有一對時，圈出兩格並示範拖曳。
  - 教學完成後，或沒有手指要指時，棋盤閒置 6 秒顯示同樣的提示。
  - 整層不擋觸控。
- 目標量測：教學期間每 0.5 秒重新量測（修正實機上的位置偏移）。棋盤目標在教學完成後仍然登記，給合成小提示用。
- v1 遷移不出現教學（測試確認）。存檔形狀不變。
- 驗證：
  - jest 42 suites／692 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功。

### File List

- `src/game/tutorial.ts`、`src/game/tutorial-focus.ts`（新增）
- `src/game/store.ts`、`src/game/engine.ts`、`src/game/content/balance.ts`
- `src/features/tutorial/`（新增：`index.ts`、`tutorial-targets.ts`、`tutorial-target-view.tsx`、`tutorial-line.tsx`、`tutorial-guide.tsx`、`__tests__/tutorial-guide-test.tsx`）
- `src/app/_layout.tsx`、`src/app/(tabs)/index.tsx`
- `src/features/board/info-bar.tsx`、`src/features/tabs/tab-bar.tsx`、`src/features/street/stall-view.tsx`、`src/features/street/street-screen.tsx`、`src/features/overlays/stall-panel.tsx`
- `src/game/__tests__/tutorial-test.ts`、`tutorial-focus-test.ts`（新增）、`stall-orders-test.ts`
- `src/features/board/__tests__/info-bar-test.tsx`
- `docs/balance.md`
- `src/features/street/upgrade-burst.tsx`（新增）、`stall-view.tsx`、`neon-sign.tsx`；`src/features/overlays/fx-controller.ts`、`__tests__/stall-panel-test.tsx`（升級演出）

## Change Log

- 2026-11-11：S6.4 實作完成（教學推進、新手訂單金幣 ×2.5、手指引導與說明），狀態改為 review，等實機確認（T9）。
- 2026-11-11：實機回饋修正：手指位置（定時重新量測）、新增合成提示（第 1 步與閒置小提示）。
- 2026-11-11：實機回饋修正：第 1、2 步依第一張訂單指產生器、提示合成或指訂單（tutorialFocus），說明寫出品項名稱。
- 2026-11-11：教學完成後的合成小提示改成晃動那一對品項（使用者要求）。
- 2026-11-11：升級演出拉長到 2 秒並加入慶祝效果（使用者實機回饋）。
- 2026-11-11：使用者實機確認通過（T9：教學 3 步、合成提示、升級演出、飛航模式）。
