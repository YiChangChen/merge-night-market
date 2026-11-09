---
baseline_commit: 0194d90
---

# Story 1.5: 存檔 v2 與 v1 遷移

Status: done

## Story

As a 已在玩 v1 的玩家,
I want 更新版本後，我的金幣、等級、棋盤都還在，已解鎖的攤位也都是開著的,
So that 新版本不會讓我失去任何進度。

## Acceptance Criteria

1. `src/game/types.ts` 定義完整的 GameState v2（形狀依架構文件，包含 stalls、queue、inventions、meta、daily、lastSellout、events）；新局時各欄位都是合法的初始值。
2. 讀到 v1 存檔時執行 `migrations[1]`：攤位依 `CHAINS[c].unlockLevel ≤ level` 設為 Lv1，否則 0；產生器原樣保留；訂單補上 `kind: 'normal'`；以遷移後的攤位等級開一波人龍；其他欄位設為空值；`firstLaunchAt = now − 72h`；`meta.tutorialStep` 設為已完成。
3. 遷移後通過 `isValidSaveV2`；金幣、XP、等級、棋盤與遷移前完全相同。
4. 第一次寫入 v2 之前，原始 v1 字串備份到 `merge-night-market/save.v1.bak`。
5. 遷移或驗證失敗時，不覆寫存檔、不開新局，顯示「存檔讀取失敗」畫面並 `log.error`；只有完全沒有存檔時才開新局。
6. `__tests__/fixtures/` 至少 4 份 v1 存檔（新局、Lv3、Lv7 全鏈、棋盤滿且有待放產生器）；`migration-test.ts` 全部通過（NFR5）。
7. 寫入存檔前移除 `events`；存檔只存在本機 AsyncStorage（NFR9）。
8. 在 `types.ts` 註記一次定義完整 v2 的取捨。

## Tasks / Subtasks

- [x] T1 用 v1 的程式產生 4 份 v1 fixture（在修改 engine 之前）
- [x] T2 `types.ts`：GameState v2 與相關型別、`SAVE_VERSION`、取捨註解（AC1、AC8）
- [x] T3 `engine.ts` 改用 v2：`createGame` 產生完整 v2、訂單帶 `kind`、`stallsForPlayerLevel`；`queue.ts` 的 `queueCapacity`（AC1）
- [x] T4 `src/game/save/`：凍結的 v1 型別與驗證、`isValidSaveV2`、`migrations[1]`、`parseSave`／`serializeSave`（AC2、AC3、AC7）
- [x] T5 `services/save.ts`：v1 備份、失敗不覆寫；store 的讀檔狀態；`game-session` 的失敗與重試；「存檔讀取失敗」畫面（AC4、AC5）
- [x] T6 測試：`migration-test.ts`、`save-test.ts`、更新 `engine-test`、`store-test`（AC6）
- [x] T7 驗證：lint、tsc、jest

## Dev Notes

- 架構依據：`game-architecture.md`〈State Management〉GameState v2 草案、〈Data Persistence〉、ADR-02、Decision #14。
- project-context：只要改到存檔形狀，就要遞增 version、新增 `migrations[n]` 與 fixture。

## Dev Agent Record

### Implementation Plan

- **型別**：
  - v2 的唯一定義在 `src/game/types.ts`。
  - `engine.ts` 改從 types 匯入並重新匯出，所以既有的 `import { Order } from '@/game/engine'` 都不必修改。
  - v1 的型別和驗證**凍結**在 `src/game/save/v1.ts`，只給遷移使用。
- **純函式**：解析、遷移、驗證都在規則層的 `src/game/save/`：
  - `parseSave(raw, now)` 回傳三種結果：`empty`、`loaded { state, migratedFrom }`、`failed { reason, version }`。
  - 失敗原因分五種：`corrupt-json`、`unknown-version`、`newer-version`、`migration-failed`、`invalid`。
  - `serializeSave` 寫入前會拿掉 `events`。
- **I/O**：`services/save.ts` 負責讀寫。
  - 只要遷移過，就先把 v1 原始字串寫到 `save.v1.bak`（已有備份時不覆寫），之後才回傳 `ready`。
  - 備份失敗就整個回傳 `failed`，不冒「v1 被覆寫後無法復原」的風險。
- **store**：
  - 新增 `status`：`loading`、`ready`、`failed`，以及 `failLoad`、`resetLoad`。
  - 讀檔失敗時 `state` 維持 null，自動存檔和背景存檔都會因此跳過，原檔不會被覆寫。
  - `events` 改成必填：分派後設為 `[]`，不再刪除這個欄位。
- **畫面**：`SaveErrorScreen` 有「重試」按鈕（呼叫 `retryLoadGame`），**刻意不提供「開新局」**。存檔來自較新版本時，提示玩家先更新 App。

### Debug Log

- **fixture 的來源**：先寫一個暫時的 Jest 產生器，用 v1 版本的 `createGame` 產出 4 份 fixture，產生後就刪除。這樣 fixture 是真正的 v1 格式，不是照 v2 想像出來的。
- **測試寫法的問題，不是產品 bug**：`save-test` 的 session 測試在整份檔案一起跑時會失敗，單獨跑卻會通過。原因是前一個測試對 AsyncStorage mock（本身就是 `jest.fn`）用了 `spyOn` 加 `mockRestore`，把 mock 的實作清掉了。改成 `jest.mocked(...).mockRejectedValueOnce` 就修好了，這個陷阱也記進 project-context。
- **反向驗證**：暫時拿掉 `backupV1` 呼叫，`save-test` 有 3 個測試失敗；還原後全部通過。

### Completion Notes

- AC1：
  - v2 的欄位：stalls、queue、inventions、meta、daily、lastSellout、events，以及 Order 的 `kind`、`recipe?`、`expiresAt?`。
  - 新局的初始值：只有 tea、fried 是 Lv1；人龍 12 人；`firstLaunchAt = now`；`tutorialStep = 0`；`dateKey = ''`（S6.1 的 syncDaily 會補上）；`events = []`。
- AC2：`migrateV1ToV2` 完全照 AC 實作。v1 玩家的 `tutorialStep = BALANCE.tutorialSteps`（3），`firstLaunchAt = now − BALANCE.openingWeekMs`。人龍長度：新局 12 人、Lv3 是 14 人、Lv7 是 18 人。
- AC3：4 份 fixture 遷移後都通過 `isValidSaveV2`。coins、xp、level、board、energy、energyUpdatedAt、pendingGenerators、nextId、rngSeed 全部和遷移前相同；訂單只多了 `kind: 'normal'`。
- AC4、AC5、AC7：由 `save-test.ts` 驗證以下情況：
  - 遷移時會先備份 v1；已有備份時不覆寫。
  - 存檔損毀時回傳 failed，不動任何資料。
  - 備份失敗時停止遷移。
  - session 讀檔失敗後 600 ms 內，主存檔完全沒有被寫入。
  - 寫入的存檔不含 `events`。
- AC6：`migration-test.ts` 共 37 個測試：4 份 fixture × 3 組檢查，加上攤位、人龍、meta、全滿棋盤、`parseSave` 的 6 種失敗、v2 原樣讀回，以及 `isValidSaveV2` 的 11 種接受和拒絕情況。
- **刻意的設計決定**：
  - `RecipeId` 暫時是 `string`，S3.1 會改成字面量聯集。
  - `DishPiece` 已經定義，`isValidSaveV2` 也接受 `kind: 'dish'`，所以存檔格式在 v2 就已經保留了發明菜，E3 不需要升版。但 `DishPiece` **還沒加進 `Piece` 聯集**，要到 S3.2 才會加，以免現在就要改動 board.tsx 的拖曳實作。
  - `queueCapacity` 先放在 `src/game/queue.ts`，S2.1 再補上波次狀態機。
  - `BALANCE` 新增 `openingWeekMs`、`tutorialSteps`。
- **服務層測試的例外**：專案規則是服務層不寫單元測試，但存檔的資料安全是 NFR5 的核心，AC 也要求用自動化測試驗證，所以新增 `src/services/__tests__/save-test.ts`，這個例外已經記進 project-context。
- **驗證**：`npx expo lint`、`npx tsc --noEmit`、`npx jest`（106 個）全部通過。
- **實機驗證**：2026-11-09 由使用者在 iPhone 16 的 Expo Go 上，用手機裡既有的 v1 存檔測試。遷移後進度完整，沒有出現讀檔失敗。

## File List

- src/game/types.ts（新增）
- src/game/queue.ts（新增）
- src/game/save/index.ts、migrations.ts、validate.ts、v1.ts（新增）
- src/game/save/__tests__/migration-test.ts（新增）
- src/game/save/__tests__/fixtures/save-v1-{new-game,lv3,lv7-all-chains,full-board-pending}.json（新增）
- src/game/engine.ts（修改：改用 v2 型別、createGame v2、訂單 kind、stallsForPlayerLevel；移除 v1 的 isValidSave）
- src/game/content/balance.ts（修改：openingWeekMs、tutorialSteps）
- src/game/store.ts（修改：讀檔狀態、events 必填）
- src/game/time.ts（修改：型別改從 types 匯入）
- src/game/__tests__/engine-test.ts、store-test.ts（修改）
- src/services/save.ts（修改：parseSave、v1 備份、失敗不覆寫）
- src/services/game-session.ts（修改：讀檔失敗、重試）
- src/services/__tests__/save-test.ts（新增）
- src/features/errors/save-error-screen.tsx（新增）、index.ts（修改）
- src/app/index.tsx（修改：讀檔失敗時顯示 SaveErrorScreen）
- _bmad-output/project-context.md（修改：AsyncStorage mock 陷阱、服務層測試例外）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：完成 Story 1.5：GameState v2、v1→v2 遷移與 4 份 fixture、v1 備份、讀檔失敗畫面與不覆寫保證。狀態改為 review。

### Review Findings（code review 2026-11-09，範圍 e4be9f6..main）

- [x] [Review][Patch]（原 Decision，使用者選擇加上「備份後開新局」：先把原檔存到 save.corrupt.bak 再開新局；newer-version 仍只提示更新）存檔讀取失敗時只有「重試」：損毀、驗證失敗、遷移失敗都是固定結果，重試永遠失敗，玩家就卡死了。需要決定要不要提供「備份後開新局」這個出口。[src/features/errors/save-error-screen.tsx]
- [x] [Review][Patch] 驗證器接受發明菜棋子和 vip／clue 訂單，但現在的引擎和畫面處理不了它們：存檔「合法」卻在 render 時崩潰，ErrorBoundary 重試也救不回來。在 E3／E4 實作之前一律拒絕 [src/game/save/validate.ts:28-55]
- [x] [Review][Patch] 驗證器只檢查型別，沒有檢查語意。以下資料能通過驗證，但會讓畫面或規則崩潰：
  - 訂單需求的階數超出該鏈範圍、需求是空陣列
  - id、nextId 不是正整數，或 nextId 不大於現有的最大 id
  - level 不是 ≥ 1 的整數
  - 金幣、體力、XP 為負數
  - id 重複
  - pendingGenerators 重複，或該鏈的產生器已經在棋盤上

  [src/game/save/validate.ts]
- [x] [Review][Patch] 讀檔流程沒有 `.catch`：遷移或解析途中意外拋出例外時，畫面會永遠停在載入中，也不會留下 log [src/services/game-session.ts:26-32, src/services/save.ts]
- [x] [Review][Patch] 備份 key 寫死成 `save.v1.bak`：之後的 v2→v3 遷移會把 v2 資料寫進 v1 的 key，或者因為已經有 v1 備份而沒有備份到 v2；改成依來源版本命名 [src/services/save.ts:16,48]
- [x] [Review][Patch] 人龍數值（8、2、20）寫死在 queue.ts，違反「數值只放在 content/balance.ts」[src/game/queue.ts:5-7]
- [x] [Review][Patch] engine.ts 結尾留下一行描述已刪除函式的註解 [src/game/engine.ts:最後一行]
- [x] [Review][Defer] `createGame(now, seed)` 的 `now` 不在最後一個參數 [src/game/engine.ts] — deferred, pre-existing（v1 就是這個簽名），呼叫端很多，之後整理規則層時一起改
- [x] [Review][Defer] production 的 AdMob ad unit ID 沒有在建置時檢查是否存在 [app.config.ts] — deferred, 屬於 S6.2 的範圍
