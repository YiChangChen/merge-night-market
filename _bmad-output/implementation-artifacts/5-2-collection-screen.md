---
baseline_commit: 7a55be9
---

# Story 5.2: 收藏冊畫面

Status: done

## Story

As a 玩家,
I want 從夜市街右上角打開收藏冊，看自己集了幾張卡、每張卡幾顆星，以及老闆說的故事,
so that 我有一個每週都想把它集滿的目標。

## Acceptance Criteria

1. `src/app/collection.tsx`（presentation: modal）與 `src/features/collection/`。
2. 玩家點夜市街右上角的收藏冊入口，以網格顯示 10 張卡牌，最上方顯示收集進度「x/10」（FR35、UX-DR8）。
3. 每張卡依狀態顯示：未發現而且沒看過線索 → 剪影；未發現但 `clueSeen` → 剪影加上線索台詞；已發現 → 卡面、菜名、星等。
4. ★5 的卡顯示金框（FR34）。
5. 點已發現的卡會打開詳情，顯示卡面、故事、老闆頭像與名字、目前製作次數，以及下一顆星還差幾份。
6. 關閉收藏冊後回到夜市街，原本的捲動位置不變。
7. 收藏冊只用 selector 訂閱 `inventions` 切片。

## Tasks / Subtasks

- [x] T1 規則：`src/game/cards.ts` 加上 `madeToNextStar(made)`（還差幾份到下一顆星；★5 回傳 null）；`cards-test` 補邊界值
- [x] T2 除錯：`debug.ts` 加上 `debugAddCardMade(state, amount)`（已發現的卡各 +amount 份）與 `debugRevealClues(state)`（未發現的卡都標成看過線索）；除錯面板加「卡牌」區（各 +1、+5、線索全看過），方便實機看各種星等與金框
- [x] T3 元件測試先行：`features/collection/__tests__/collection-test.tsx`（AC2–AC5、AC7）、`tabs-navigation-test` 加上入口（AC1、AC2、AC6）
- [x] T4 卡牌元件 `card-view.tsx`：依寬度等比縮放；三種狀態；卡面依 `CARD_FACE_INSET` 放在框後；名牌寫菜名與星等；★5 金框。S5.3 的演出會共用這個元件
- [x] T5 收藏冊 `collection-screen.tsx`：標題、進度 x/10、關閉；2 欄網格；點已發現的卡開詳情
- [x] T6 詳情 `card-detail.tsx`：同一個畫面裡的覆蓋層：大卡、故事、老闆頭像與名字、製作次數、下一顆星還差幾份（★5 顯示已滿星）；點關閉或返回鍵回到網格
- [x] T7 路由與入口：`src/app/collection.tsx`、根層 `Stack.Screen name="collection"`（modal）；夜市街右上角空位換成入口按鈕（≥ 44 pt）
- [x] T8 反向驗證（A4）：拿掉「★5 換金框」與「clueSeen 才顯示線索」，確認測試失敗
- [x] T9 驗證：lint、tsc、jest
- [x] T10 **（使用者）** 實機：開收藏冊、看三種狀態、用除錯按鈕升到 ★5 看金框、點卡看詳情；關閉後夜市街捲動位置不變

### Review Findings

- [x] [Review][Patch] 網格卡牌的無障礙標籤被外層 Pressable 吃掉；未發現的卡也沒有 disabled 狀態（blind） [src/features/collection/collection-screen.tsx:60]
- [x] [Review][Patch] Android TalkBack 開詳情時仍能點到底下的網格與標題列（`accessibilityViewIsModal` 只對 iOS 有效）（edge） [src/features/collection/collection-screen.tsx:56]
- [x] [Review][Patch] 從深連結直接開啟收藏冊時沒有上一頁可回，`router.back()` 無效（blind） [src/features/collection/collection-screen.tsx:51]
- [x] [Review][Patch] 寬螢幕一排會放 3 張卡，不是 2 欄（blind） [src/features/collection/collection-screen.tsx:121]
- [x] [Review][Patch] `starText` 收到 0–5 以外的星等會拋錯；要限制在 0–5 之間（blind） [src/features/collection/card-view.tsx:26]

## Dev Notes

### 目前狀態

- **夜市街** `features/street/street-screen.tsx`：標題列左邊是設定（`router.push('/settings')`），右邊是同尺寸空位 `<View style={styles.iconButton} />`，S5.2 換成收藏冊入口。夜市街本身不訂閱 store。
- **根層** `src/app/_layout.tsx`：Stack 有 `(tabs)`、`settings`、`debug`（都是 modal）。收藏冊照 settings 的模式加一個 modal。modal 疊在 tabs 上面，夜市街不會卸載，所以捲動位置自然保留（AC6）；不要用 `router.replace` 或重新導向。
- **內容**：`CARDS_BY_RECIPE[id]` 有 `art`、`story`、`owner`；`CARD_FRAMES.normal/gold`；`CARD_FACE_INSET`（左右 8%、上 6%、下 10%）。菜名在 `RECIPES_BY_ID[id].name`、線索在 `.clue`、剪影用發明菜圖示 `.art`（透明底）。老闆名字 `STALLS[owner].owner.name`、頭像 `STALLS[owner].art.owner`。
- **星等**：`cardStars(made)`（S5.1）。

### 卡牌元件

- 比例 3:4；寬度由父層給。卡面（`expo-image`，`contentFit="cover"`）依 `CARD_FACE_INSET` 定位，卡框鋪滿整張卡疊在上面。
- 名牌位置：卡框下方約 18%（窗口底端約 82%）。文字放在 `top: 84%`、`bottom: 4%`、左右 12% 的區域，置中：第一行菜名，第二行星等（★ 實心＋☆ 空心，共 5 顆）。字級跟著卡寬縮放。
- 剪影：深色底，中央放發明菜圖示，`tintColor` 設成深色，看得出形狀但看不出是什麼；名牌寫「？？？」。
- 線索：剪影上加一個半透明底的對話框，顯示線索台詞（字級小、最多 3 行）。
- 金框只在 ★5；其他（含剪影）都用一般框。
- 無障礙：已發現「{菜名}，{n} 星」；未發現「還沒發現的發明菜」；有線索再加「線索：{台詞}」。

### 收藏冊

- `useGameStore((s) => s.state.inventions)`，只訂閱這個切片（AC7）。進度 = `discovered` 為 true 的數量。
- 網格：2 欄，`ScrollView` 加 `flexWrap`（只有 10 張，不需要 FlatList）。卡寬 = `min((螢幕寬 − 左右邊距 − 間距) / 2, 180)`。
- 詳情用同一個畫面裡的絕對定位覆蓋層，不另開路由；Android 返回鍵先關詳情（`BackHandler`），沒有詳情時交給 modal 預設行為。
- 選取用 `recipe` 記住（E3 retro A5）；如果該卡變成未發現（例如除錯開新局），就不顯示詳情。

### 會佔位的機制（E4 retro A3）

收藏冊是 modal，關閉鍵與返回鍵都能離開；詳情覆蓋層可以點關閉或按返回鍵離開。

### 測試

- `collection-test.tsx`：直接 render `CollectionScreen`（包 `SafeAreaProvider`），用 store 設定 inventions：
  - 進度：2 張已發現 → 「2/10」。
  - 三種狀態：沒紀錄 → 「？？？」且沒有線索；`clueSeen` → 顯示 `RECIPES_BY_ID[id].clue`；已發現 → 菜名與星等文字。
  - 金框：made 15 的卡 `testID` 帶 `gold`，made 14 的卡是一般框。
  - 詳情：點已發現的卡 → 故事、老闆名字、「已製作 n 份」、「再做 m 份升到 ★k」；★5 → 「已滿星」；點未發現的卡不會開詳情；關閉詳情回到網格。
- `tabs-navigation-test`：夜市街右上角 `open-collection` 開啟收藏冊，顯示「0/10」；關閉後回到夜市街。
- `debug-test`：`debugAddCardMade` 只加已發現的卡；`debugRevealClues` 只標未發現的卡。

### Project Context Rules

- Expo Router：路由放 `src/app/`，畫面元件放 `src/features/collection/`。
- 規則層純 TS；UI 只透過 selector 讀 store、透過 `apply` 改狀態。
- RNTL 14：`render`／`fireEvent`／`act` 都要 await；用到 safe area 的元件測試要包 `SafeAreaProvider`。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2: 收藏冊畫面]（FR34、FR35、UX-DR8）
- [Source: _bmad-output/game-architecture.md]（`collection.tsx` modal、`features/collection/`）
- [Source: _bmad-output/implementation-artifacts/5-1-card-data-and-star-bonus.md]（`CARD_FACE_INSET`、`cardStars`）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 路由測試一開始在關閉收藏冊後回到棋盤：測試的路由沒有根層 Stack，開 modal 時分頁被換掉。測試補上和 `_layout.tsx` 相同的根層 Stack，並檢查關閉後夜市街是同一個元件實體（沒有卸載），代表捲動位置會保留。反向驗證：拿掉根層 Stack → 失敗。
- 反向驗證（A4）：金框條件改成 ★4 以上 → 1 個失敗；線索條件改成「有紀錄就顯示」→ 1 個失敗。還原後全部通過。
- Prettier 重排了 `tabs-navigation-test` 兩段原本沒動的程式，已還原。
- 實機回饋：菜名在名牌上偏上、星星掉到名牌下方。原因是名牌只容得下一行字，菜名和星星兩行疊在一起放不下。修正：名牌只放菜名，並依兩種卡框實際量到的名牌位置垂直置中（一般框約 83%–97%，金框約 81.7%–96%）；星星移到卡面底部、名牌正上方。

### Completion Notes List

- `CardView`（`features/collection/card-view.tsx`）：依寬度等比縮放；卡面依 `CARD_FACE_INSET` 放在卡框後；名牌寫菜名與 ★☆；★5 金框（金框上的菜名和星星改用深色，避免看不清楚）。剪影用發明菜圖示加 `tintColor`；看過線索的卡在剪影上加線索對話框。S5.3 會共用。
- 收藏冊：2 欄網格、進度 x/10、✕ 關閉；只訂閱 `inventions`（讀檔前用固定的空物件，避免重繪）。點已發現的卡開詳情，未發現的卡停用。
- 詳情：同一畫面的覆蓋層；大卡、菜名、老闆頭像與「名字・攤位」、故事、已製作 n 份、再做 m 份升到 ★k（★5 顯示已滿星）；返回鍵先關詳情。
- 入口：夜市街右上角 📖（44 pt），和左上角設定對稱；根層加 `collection` modal。
- 除錯面板「卡牌」區：已發現的卡各 +1／+5 份、線索全看過（不送升星事件）。
- 驗證：jest 35 suites／596 tests 全過；`expo lint` 0；`tsc --noEmit` 0；iOS 打包成功。
- T10 使用者實機確認通過（名牌位置修正後）。

### File List

- `src/app/collection.tsx`（新增）
- `src/app/_layout.tsx`
- `src/features/collection/index.ts`、`card-view.tsx`、`card-detail.tsx`、`collection-screen.tsx`（新增）
- `src/features/collection/__tests__/collection-test.tsx`（新增）
- `src/features/street/street-screen.tsx`
- `src/features/debug/debug-panel.tsx`
- `src/features/tabs/__tests__/tabs-navigation-test.tsx`
- `src/game/cards.ts`（`madeToNextStar`）
- `src/game/debug.ts`（`debugAddCardMade`、`debugRevealClues`）
- `src/game/__tests__/cards-test.ts`、`debug-test.ts`

## Change Log

- 2026-11-11：S5.2 實作完成（收藏冊、卡牌元件、詳情、入口、除錯按鈕），狀態改為 review，等實機確認（T10）。
- 2026-11-11：E5 code review。網格按鈕帶卡牌無障礙標籤與停用狀態；詳情開著時對讀螢幕軟體隱藏網格與標題列；深連結開啟時關閉改回夜市街；寬螢幕固定 2 欄；`starText` 限制 0–5。
