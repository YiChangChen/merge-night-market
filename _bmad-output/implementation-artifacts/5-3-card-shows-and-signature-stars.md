---
baseline_commit: 7a55be9
---

# Story 5.3: 卡牌演出與招牌菜星等

Status: done

## Story

As a 玩家,
I want 第一次發明時拿到 ★1 卡，升星時看到演出，夜市街的招牌菜也掛著星等徽章,
so that 收藏進度在遊戲裡處處看得見。

## Acceptance Criteria

1. `dish_invented { first: true }` 的「老闆發明！」演出加入 ★1 卡牌的展示，完成 UX-DR5。
2. 收到 `card_starred` 時，Overlay Host 播放升星演出：卡牌加上新的星等；升到 ★5 時另外播放換金框的效果。
3. 夜市街上的招牌菜顯示該菜目前的星等徽章（FR13）。
4. 升星演出點一下就能跳過，也不會擋住連續操作。
5. Epic 5 完成定義：10 張卡都能收集並升到 ★5；貴客單報酬正確反映加成；卡面 10 張與卡框 2 種定稿；卡牌故事改用 `docs/content.md` 的定稿；E5 範圍內的 `TODO(content)` 清零。Epic 結束時在 iPhone 實機上量測 NFR1–3（暫定），結果記入 retro。

## Tasks / Subtasks

- [x] T1 元件測試先行：`invention-show-test`（★1 卡）、新增 `star-show-test`（FxController、星等由舊變新、★5 金框、點卡跳過、時間到自動結束、排隊、不擋操作、蓋掉同一道菜的小提示）、`stall-view-test`（招牌菜星等徽章、只在星等改變時重繪）
- [x] T2 `CardView` 加上可選的 `stars` 參數（演出用來先顯示升星前的星等）
- [x] T3 overlay store：`starred` 與 `pendingStarred` 排隊（同 `invention`）；`reset` 一併清掉
- [x] T4 FxController：`card_starred` → 先收掉同一道菜的小提示，再播升星演出
- [x] T5 `star-show.tsx`：畫面上方的小卡牌，先顯示舊星等，再彈一下換成新星等；★5 換金框，加上光芒掃過與「金框解鎖！」；點卡跳過；其餘區域 `box-none`，不擋棋盤
- [x] T6 `invention-show.tsx`：保留的位置換成 ★1 卡牌（`CardView`），在老闆之後登場；光芒舞台稍微縮小，小螢幕也放得下
- [x] T7 `stall-view.tsx`：招牌菜旁加上星等徽章；selector 直接回傳星等數字，同一道菜多做幾份但沒升星時不重繪
- [x] T8 反向驗證（A4）：拿掉「★5 才換金框」與「星等 selector」，確認測試失敗
- [x] T9 驗證：lint、tsc、jest；Epic 5 完成定義逐項核對（`TODO(content)` 清零、美術定稿、故事定稿）
- [x] T10 **（使用者）** 實機：發明新菜看 ★1 卡；用除錯按鈕把製作次數加到門檻前一份，再做一份看升星演出（含 ★5 金框）；夜市街 Lv3 招牌菜的星等徽章；量測 NFR1–3 記入 retro

### Review Findings

- [x] [Review][Patch] 升星演出整塊面板都能點，位置剛好蓋住訂單卡與棋盤上緣，擋到連續操作；應該只有卡牌本身可以點，位置也要往上移（auditor，中） [src/features/overlays/star-show.tsx]
- [x] [Review][Patch] 升星演出會疊在首次發明的全螢幕演出上面；發明演出播放時，升星演出要先等（blind，中） [src/features/overlays/overlay-host.tsx:68]
- [x] [Review][Patch] ★5 標題應該是「★5 金框解鎖！」（規格），目前是「★5 升星！」再另外加一行（auditor） [src/features/overlays/star-show.tsx]
- [x] [Review][Patch] 升星演出還在排隊時就收掉了「又做出一份」小提示，這次製作暫時沒有任何回饋（blind） [src/features/overlays/fx-controller.ts]
- [x] [Review][Patch] Android 的 `rotateY` 沒有 `perspective`，翻牌動畫可能變形（blind） [src/features/overlays/invention-show.tsx]
- [x] [Review][Patch] 招牌菜的 made 是 0 時（存檔不一致），徽章會顯示「★0」（blind） [src/features/street/stall-view.tsx]
- [x] [Review][Defer] 美術腳本先寫入正式素材才檢查內縮，檢查失敗時壞檔已經寫進 assets [art-source/scripts/process-e5-art.py:62] — deferred, 工具鏈；目前的輸出已驗證正確
- [x] [Review][Defer] 匯入存檔沒有呼叫 `useOverlayStore.reset()`，和註解不一致 [src/game/save-transfer.ts:54] — deferred, pre-existing

## Dev Notes

### 目前狀態

- **FxController**（`features/overlays/fx-controller.ts`）：`dish_invented` 的 first 為 true 時播全螢幕演出，否則顯示小提示 `showDishMade`。`card_starred` 目前落在 `default`。
- **事件順序**（S5.1，`game/drop.ts`）：同一批事件裡先送 `dish_invented { first: false }`，再送 `card_starred`。`card_starred` 只在 `before >= 1` 時送出，所以不會和首次發明同時出現。
- **Overlay Host**：由下往上依序是攤位面板、完售、發明、阿嬤、小提示。`blocking` 的層會攔截返回鍵；升星演出不擋操作，所以不列入。
- **InventionShow**：`invention-card-slot` 是 8 pt 高的空位，S5.3 換成卡牌。演出長 3.2 秒，剛出現的 0.4 秒內點擊不算。
- **StallView**：Lv3 時把招牌菜掛在霓虹下方（`stall-${chain}-signature`），這時還沒有星等。這個元件有 `memo`，而且只訂閱自己的攤位。

### 升星演出

- 位置：畫面上方（安全區下方約 72 pt）置中，卡寬 128 pt。外層 `pointerEvents="box-none"`，只有卡牌本身可以點（點了就跳過）。
- 時間軸：卡牌彈出時先顯示舊星等（`stars − 1`），0.45 秒後換成新星等並再彈一下。一般升星長 2 秒；★5 長 2.8 秒，換星等的同時換成金框、光芒掃過，並顯示「金框解鎖！」。
- 文字：「★{n} 升星！」；★5 顯示「★5 金框解鎖！」。無障礙會唸出「{菜名} 升到 {n} 星」。
- 排隊：演出還在播時又有升星，依序播放（同發明演出）。
- 小提示：同一次製作會同時送出 `dish_invented`（小提示）和 `card_starred`。升星演出已經包含這個資訊，所以收到 `card_starred` 時先收掉小提示。

### 招牌菜星等

- `useGameStore((s) => cardStars(s.state?.inventions[dish]?.made ?? 0))` 回傳數字。製作次數改變但星等沒變時不會重繪。
- 招牌菜一定是已經發明過的菜（S3.5 從棋盤上選），星等至少 ★1。

### 會佔位的機制（E4 retro A3）

升星演出不攔截返回鍵也不擋操作，時間到自動消失。

### Project Context Rules

- UI 只讀事件，不在訂閱者裡呼叫 `apply`。
- Reanimated 用 `.get()`／`.set()`。
- RNTL 14：`render`、`fireEvent`、`act` 都要 await。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3]（FR13、UX-DR5）
- [Source: 5-1-card-data-and-star-bonus.md]（`card_starred`）
- [Source: 5-2-collection-screen.md]（`CardView`）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 發明演出原本的測試用 `getByText(菜名)`，加上卡牌之後菜名會出現兩次（大標和卡牌名牌），改成檢查出現 2 次。
- 反向驗證（A4）：升星演出的金框條件改成 ★4 以上 → 1 個失敗；招牌菜 selector 改成回傳製作次數 → 2 個失敗（重繪、徽章文字）；`CardView` 忽略 `stars` 參數 → 2 個失敗。還原後全部通過。
- 用 Python 改寫檔案時，Windows 會把換行改成 CRLF，導致 Prettier 檢查不過；已全部改回 LF（HEAD 也是 LF）。

### Completion Notes List

- 升星演出 `overlays/star-show.tsx`：位置在畫面上方，卡寬 128 pt。卡牌先顯示舊星等，0.45 秒後換成新星等並再彈一下。★5 換金框、光芒掃過，並顯示「金框解鎖！」。一般升星 2 秒、★5 2.8 秒。只有卡牌本身能點（點了跳過），外層 `box-none` 不擋棋盤，也不攔截返回鍵。
- overlay store 新增 `starred`／`pendingStarred` 排隊（`reset` 一併清掉）；FxController 收到 `card_starred` 時先收掉同一次製作的「又做出一份」小提示，再播升星演出。
- `CardView` 新增可選的 `stars` 參數（演出先顯示升星前的星等）；`collection` 匯出 `CARD_ASPECT`。
- 「老闆發明！」演出：保留的位置換成 ★1 卡牌（寬 112，翻轉登場，在老闆之後出現），完成 UX-DR5；光芒舞台從 1.6 倍縮成 1.35 倍、發明菜從 168 縮成 150，小螢幕也放得下。
- 夜市街招牌菜：名稱後面加上 ★n 徽章（★5 改用金色）；selector 直接回傳星等，多做幾份但沒升星時不重繪；有無障礙標籤「招牌菜 {菜名}，{n} 星」。
- Epic 5 完成定義：`TODO(content)` 0 個；E5 美術 #43–54 全部定稿；卡牌故事由 `content-test` 檢查與 `docs/content.md` 逐字一致；升星加成與貴客單金幣由 `cards-test` 檢查。iPhone 上的 NFR1–3 量測留在 T10／retro。
- 驗證：jest 36 suites／606 tests 全過；`expo lint` 0；`tsc --noEmit` 0；Prettier 通過；iOS 打包成功。

### File List

- `src/features/overlays/star-show.tsx`（新增）
- `src/features/overlays/__tests__/star-show-test.tsx`（新增）
- `src/features/overlays/overlay-store.ts`、`fx-controller.ts`、`overlay-host.tsx`、`invention-show.tsx`
- `src/features/overlays/__tests__/invention-show-test.tsx`
- `src/features/collection/card-view.tsx`（`stars` 參數）、`index.ts`（匯出 `CARD_ASPECT`）
- `src/features/street/stall-view.tsx`
- `src/features/street/__tests__/stall-view-test.tsx`

## Change Log

- 2026-11-11：S5.3 實作完成（升星演出、發明演出的 ★1 卡牌、招牌菜星等徽章），狀態改為 review，等實機確認（T10）。
- 2026-11-11：E5 code review。升星演出改成畫面頂端的橫向小橫幅（卡寬 84），只有卡牌能點；發明演出播放時升星演出先等；★5 標題改成「★5 金框解鎖！」；升星要排隊時保留小提示；翻牌動畫加 perspective；招牌菜沒有製作紀錄時不顯示 ★0。
- 2026-11-11：使用者實機確認通過（T10）；狀態改為 done。
