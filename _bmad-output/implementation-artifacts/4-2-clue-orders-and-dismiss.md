---
baseline_commit: 8be1a9c
---

# Story 4.2: 線索單與「請客人先走」

Status: review

## Story

As a 玩家,
I want 有時候上門的客人只說一句「好想來杯紅茶配鹹酥的……」，10 分鐘後就離開,
so that 我能從客人的話裡猜出還沒發現的配方。

## Acceptance Criteria

1. 還有「尚未發現、兩攤都已達 Lv2」的配方時，`rollVip` 判定為貴客單後，有 50% 機率改為線索單（`kind: 'clue'`、`recipe`、`expiresAt = now + 10 分鐘`），並設 `inventions[recipe].clueSeen = true`（FR29）。
2. 線索單顯示該配方的 `clue` 台詞，部分台詞是味道描述（內容在 `recipes.ts`，FR30）。
3. 線索單無法完成，不扣人龍，計入「同時最多 1 張」的上限。
4. `syncOrders`：`now ≥ expiresAt` 時移除線索單並補上一張新訂單；時鐘倒退時，剩餘時間截到最多 10 分鐘。
5. `needsTick` 擴充：存在 `kind: 'clue'` 的訂單時也回傳 true，讓線索單的倒數和到期移除在體力已滿時照常運作；`vip-test.ts` 補上「體力已滿、有線索單時 `needsTick` 為 true」。**（本 story 修訂，見 Dev Notes：改成「線索單到期，或時鐘倒退需要截短」時回傳 true）**
6. `dismissOrder(state, orderId)` 只能用在 `kind: 'clue'`，移除後補上新訂單，不扣人龍（RC-9）。
7. `vip-test.ts` 補上：沒有可用配方時不會產生線索單、到期移除、提前請走、對非線索單呼叫 dismiss 時回傳原 state。

## Tasks / Subtasks

- [x] T1 測試先行：`vip-test.ts` 補上 AC1、AC3–AC7 的情境；時間情境照 E2 retro A3 測四種：正常、到期、時鐘倒退、快轉後歸零
- [x] T2 `createOrder(state, now)`、`rollVip(state, now)`：建立訂單需要時間（線索單的 `expiresAt`）；呼叫端 `createGame`、`completeOrder` 傳入 `now`
- [x] T3 `vip.ts`：線索候選、`clueOrder`、`rollVip` 的 50% 分支（設 `clueSeen`）、`syncOrders`、`dismissOrder`；`BALANCE` 加上 `clueChance`、`clueDurationMs`（AC1、AC3、AC4、AC6）
- [x] T4 `time.ts`：`syncAll` 加上 `syncOrders`；`needsTick` 加上線索單到期或需要截短（AC4、AC5）
- [x] T5 存檔驗證接受線索單（已知配方、需求為空、`expiresAt` 是有限數字、獎勵為 0）
- [x] T6 最小 UI（E3 retro A3）：線索單的訂單標籤顯示台詞，第二行顯示「線索客人」；倒數與「請客人先走」按鈕在 S4.3
- [x] T7 架構文件〈Time & Day Rollover〉同步線索單的 `needsTick` 條件
- [x] T8 反向驗證（E3 retro A4）：拿掉「沒有候選就不產生線索單」與「只能請走線索單」的檢查，確認測試會失敗
- [x] T9 驗證：lint、tsc、jest、iOS 打包
- [x] T10 **（使用者）** 實機：發現第一道菜、另外兩攤也 Lv2 後，偶爾出現線索客人；除錯面板快轉 10 分鐘後線索單離開、補上新訂單

## Dev Notes

### AC5 的修訂（和 E2 的 needsTick 修正一致）

字面上的 AC5（只要有線索單就回傳 true）會在體力滿時造成**整整 10 分鐘每秒存檔**：體力滿時 `syncEnergy` 每次都會產生新 state（deferred-work 已記錄），這正是 E2 審查修掉的問題。架構文件規定「只在需要改變 state 時回傳 true」。所以線索單比照人龍冷卻：

- `now ≥ expiresAt`（到期，要移除並補單）→ true
- `expiresAt − now > 10 分鐘`（時鐘倒退，要截短）→ true
- 其他 → false；倒數畫面由 S4.3 的訂單卡自己計時

AC5 的意圖（體力已滿時線索單也會照常到期移除）不變，測試改成「體力已滿、線索單到期時為 true；還沒到期時為 false」。

### 規則細節

- **線索候選**：尚未發現（`!inventions[r]?.discovered`）、兩攤都 ≥ Lv2 的配方，依 RECIPES 順序。vip.ts 直接判斷，不 import invention.ts（invention 重新匯出了 engine 的 `dishSellPrice`，會繞回 engine ↔ vip）。
- **擲骰順序**：符合資格 → 擲貴客機率 → 有線索候選時再擲 50%：線索 → 從候選挑一道；否則（或沒有候選）→ 從已發現的配方挑貴客。沒有候選時不多擲一次。
- **線索單的形狀**：`{ id, kind: 'clue', recipe, requirements: [], coins: 0, xp: 0, energy: 0, expiresAt: now + 10 分鐘 }`。建立時把 `inventions[recipe].clueSeen` 設成 true（沒有紀錄時建立一筆 `{ discovered: false, made: 0, failures: 0, clueSeen: true }`）。
- **不能完成**：`findOrderCells` 對線索單已經回傳 null（S4.1）。
- **syncOrders(state, now)**：沒有線索單、或還沒到期也不需要截短時，回傳**同一個參考**。到期：移出線索單、`createOrder` 補一張（補的這張也可能是貴客或線索），新的排在最後。
- **dismissOrder(state, orderId, now)**：只對線索單有效，其他回傳原 state；移出後補一張新訂單，不動人龍。簽名照專案規則把 `now` 放最後（架構寫的是 `(state, orderId)`，補上 now 是因為補單可能又產生線索單）。

### 要修改的檔案

| 檔案 | 改動 |
|---|---|
| `engine.ts` | `createOrder(state, now)`；`createGame`、`completeOrder` 傳入 now |
| `vip.ts` | 線索相關函式 |
| `time.ts` | `syncAll`、`needsTick` |
| `save/validate.ts` | 接受線索單 |
| `content/balance.ts` | `clueChance: 0.5`、`clueDurationMs: 10 分鐘` |
| `(tabs)/index.tsx` | 線索單標籤 |
| `game-architecture.md` | needsTick 條件 |

### Project Context Rules

- 規則層純 TS；亂數用 seeded RNG；時間由參數傳入（now 放最後）。
- `syncAll` 屬於熱路徑：沒有變化時回傳原參考，不配置大物件。
- 新增倒數計時必須同步擴充 `needsTick`，並只在需要改變 state 時回傳 true。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: 線索單與「請客人先走」]（FR29、FR30、RC-9）
- [Source: _bmad-output/game-architecture.md#Time & Day Rollover]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-11-10.md]（A3 時間情境）
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-11-11.md]（A3 跨 story 界線、A4 反向驗證）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`syncOrders`、`dismissOrder` 不存在。
- `syncOrders`／`dismissOrder` 要補新訂單（engine 的 `createOrder`），而 engine 已經 import vip 的 `rollVip`：放進 vip.ts 會互相依賴。改放在新的 `src/game/orders.ts`，架構文件 RC-9 同步。
- 反向驗證（E3 retro A4）：拿掉線索候選的過濾 → 3 個測試失敗；讓任何訂單都能請走 → 1 個測試失敗；還原後全部通過。

### Completion Notes List

- `createOrder(state, now)`、`rollVip(state, now)`：線索單需要 `expiresAt`；`createGame`、`completeOrder` 傳入 now。
- `vip.ts`：線索候選（尚未發現、兩攤都 ≥ Lv2）；貴客判定成立且有候選時再擲 50%：線索單（`clueOrder`，沒有需求與獎勵、10 分鐘後離開），並記下 `inventions[recipe].clueSeen = true`。沒有候選時不多擲，S4.1 的亂數序列不變。
- `orders.ts`：`replaceOrder`（engine，移出並補一張排在最後）、`syncOrders`（到期移除補單、時鐘倒退截到 10 分鐘、沒變化回傳原參考）、`dismissOrder`（只對線索單，不動人龍）、`clueNeedsSync`。
- `time.ts`：`syncAll` = 體力 → 人龍 → 線索單；`needsTick` 在線索單到期或需要截短時回傳 true（AC5 修訂，理由見 Dev Notes），體力滿、線索單還在倒數時不每秒存檔。
- 存檔驗證：接受線索單（已知配方、需求為空、`expiresAt` 有限、獎勵為 0）；一般單與貴客單不能有 `expiresAt`。
- 最小 UI（E3 retro A3）：線索單的標籤顯示台詞、第二行「線索客人」；倒數與「請客人先走」按鈕在 S4.3。
- 驗證：lint 0、tsc 0、jest 468 通過（vip-test 新增 13 個）、iOS 打包成功。
- T10：使用者實機確認通過（2026-11-11）。

### File List

- `src/game/orders.ts`（新增）
- `src/game/vip.ts`、`src/game/engine.ts`、`src/game/time.ts`、`src/game/save/validate.ts`、`src/game/content/balance.ts`（修改）
- `src/game/__tests__/vip-test.ts`、`src/game/save/__tests__/migration-test.ts`（修改）
- `src/app/(tabs)/index.tsx`（修改：線索單標籤）
- `_bmad-output/game-architecture.md`（needsTick 條件、RC-9 檔案位置）

## Change Log

- 2026-11-11：線索單與請客人先走（規則）；狀態改為 review。
