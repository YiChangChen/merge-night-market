---
baseline_commit: b16292b
---

# Story 2.1: 人龍波次規則

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 玩家,
I want 每出一張訂單，今晚的客流就少一人，清空時拿到完售獎勵，過幾分鐘下一波再來,
so that 我在棋盤上的每個動作都有一個看得見的十分鐘級目標。

## Acceptance Criteria

1. `src/game/queue.ts` 實作架構文件 NP-2 的狀態機。ACTIVE（`cooldownEndsAt = null`）時完成一張訂單：`queue.remaining − 1`。
2. `queueCapacity(state) = min(8 + 2 × Σ已開攤位等級, 20) + queue.bonus`；新局為 12，`bonus` 恆為 0（FR17）。（S1.5 已實作，保留不動）
3. `remaining` 歸 0 時：
   - 發放完售獎勵：金幣 5 × length、體力 +10、XP + length（XP 會觸發升級）
   - 寫入 `lastSellout { wave, coins, energy, xp, doubled: false }`
   - `cooldownEndsAt = now + 3 分鐘`
   - push `queue_sold_out { wave, length }`（FR19）
4. COOLDOWN 期間完成訂單，只給訂單本身的基本獎勵，不動人龍（FR20）。
5. `syncQueue(state, now)`：`now ≥ cooldownEndsAt` 時開新一波，`wave + 1`，`length = remaining = queueCapacity`，清除 `lastSellout`。
6. ACTIVE 期間重開或升級攤位，`growActiveWave` 讓 length 與 remaining 同時 + Δ（上限 20）；COOLDOWN 期間不變（FR18）。
7. 時鐘倒退時，`cooldownEndsAt − now` 會被截到 3 分鐘以內，冷卻不會被拉長。
8. 規則層提供純函式 `needsTick(state, now)`，store 的 1 秒 tick 只在它回傳 true 時運作。本 story 的條件是「體力 < 100」或「冷卻中」。回到前景時立刻 `syncAll`（已有，保留）。
9. `queue-test.ts` 補上 `needsTick` 的測試：體力滿且人龍進行中時回傳 false。
10. `queue-test.ts` 涵蓋以下情境：一般消化、剛好完售、冷卻中出單、冷卻結束、波中升級、冷卻中升級、上限 20、時鐘倒退。

## Tasks / Subtasks

- [x] T1 測試先行：新增 `src/game/__tests__/queue-test.ts`，先寫紅燈（AC1–AC10）
  - [x] 一般消化：ACTIVE、remaining 12 → 完成訂單後 11，金幣只多訂單本身的金額
  - [x] 剛好完售：remaining 1 → 0；金幣 + 訂單 + 5 × length、體力 + 訂單 + 10、XP + 訂單 + length；`lastSellout` 正確；`cooldownEndsAt = NOW + 180_000`；events 依序是 `order_completed` 再 `queue_sold_out`
  - [x] 完售 XP 觸發升級（升級體力 +20 也要加上）
  - [x] 冷卻中出單：queue 與 lastSellout 不變，只拿基本獎勵，沒有 `queue_sold_out`
  - [x] 冷卻結束：`syncQueue(state, cooldownEndsAt)` 開新波（剛好等於也算）；`cooldownEndsAt − 1` 時不變且回傳**同一個參考**
  - [x] 波中升級／重開：length、remaining 同時 + 2；冷卻中升級：queue 不變，下一波才用新容量
  - [x] 上限 20：Σ等級夠高時 capacity 截在 20，`growActiveWave` 不超過 20
  - [x] 時鐘倒退：`cooldownEndsAt − now > 3 分鐘` 時截成 `now + 3 分鐘`
  - [x] 自我修復：`remaining = 0` 且 `cooldownEndsAt = null`（不該出現的狀態）時 `syncQueue` 直接開新波，不會永遠卡住
  - [x] `needsTick`：體力滿 + ACTIVE → false；體力 < 100 → true；冷卻中 → true
- [x] T2 數值：`content/balance.ts` 加上 `queueCooldownMs: 3 * 60 * 1000`、`selloutCoinsPerCustomer: 5`、`selloutEnergy: 10`、`selloutXpPerCustomer: 1`（AC3、AC7）
- [x] T3 `queue.ts`：`advanceQueue(state, now)`、`syncQueue(state, now)`、`growActiveWave(state)`（AC1、AC3–AC7）
- [x] T4 `engine.ts` 的 `completeOrder` 使用 `now`：基本獎勵之後呼叫 `advanceQueue`，再 `applyLevelUps`（AC1、AC3、AC4）
- [x] T5 `stalls.ts` 的 `reopenStall`、`upgradeStall` 最後呼叫 `growActiveWave`（AC6）
- [x] T6 `time.ts`：`syncAll` = syncEnergy → syncQueue；新增 `needsTick(state, now)`（AC5、AC7、AC8）
- [x] T7 `services/game-session.ts` 的 tick 改用 `needsTick`（AC8）
- [x] T8 除錯面板加一行人龍狀態（「第 N 波 已出單 x/length」或「已完售，冷卻中」），以及「剩最後 1 位」按鈕，讓實機用時間快轉驗證完售與冷卻。S2.2 之前，這是在手機上唯一看得到人龍的地方
- [x] T9 驗證：`npx expo lint`、`npx tsc --noEmit`、`npx jest`；既有測試（engine、stalls、store、balance-doc、migration）全部通過
- [ ] T10 **（使用者）** 實機：開啟除錯面板，用「+2 分」等快轉，確認完售後進入冷卻、冷卻結束後開新波

## Dev Notes

### 現況（要修改的檔案）

| 檔案 | 現在 | 這個 story 要改的 | 必須保留 |
|---|---|---|---|
| `src/game/queue.ts` | 只有 `queueCapacity`（S1.5） | 加上 `advanceQueue`、`syncQueue`、`growActiveWave` | `queueCapacity` 的簽名 `Pick<GameState, 'stalls' \| 'queue'>`，`createGame` 與 `migrations.ts` 都在用 |
| `src/game/engine.ts` | `completeOrder(state, id, _now)` 不使用 `now`；流程是扣品項 → 加獎勵 → `flushPendingGenerators` → `applyLevelUps` → 補新訂單 → push `order_completed` | 加獎勵之後呼叫 `advanceQueue(next, now)`，然後才 `applyLevelUps`（完售 XP 要一起算升級） | 新訂單仍依**升級後**的等級產生；`order_completed` 必須排在 `queue_sold_out` **前面** |
| `src/game/stalls.ts` | `reopenStall`、`upgradeStall` 的 `_now` 不使用 | 回傳前呼叫 `growActiveWave` | 事件內容與順序、`ensureGenerator` |
| `src/game/time.ts` | `syncAll = syncEnergy` | `syncAll = syncQueue(syncEnergy(state, now), now)`；新增 `needsTick` | — |
| `src/services/game-session.ts` | tick 條件是 `state.energy < BALANCE.maxEnergy` | 改成 `needsTick(state, now)`；`now = Date.now() + store.timeOffsetMs`（服務層可以用 `Date.now()`，要加上快轉偏移量，與 store 的時間一致） | 前景時 `settle()`、背景時 `saveNow()` |
| `src/features/debug/debug-panel.tsx` | 摘要有時間快轉量等資訊 | 加一行人龍狀態 | 其他除錯功能 |

### 規則細節（NP-2，[Source: _bmad-output/game-architecture.md#NP-2 人龍波次（Queue Wave）]）

```ts
// queue.ts —— 不得 import engine.ts（engine 已經 import queue，會循環依賴）
export function advanceQueue(state: GameState, now: number): GameState {
  const q = state.queue;
  if (q.cooldownEndsAt !== null || q.remaining <= 0) return state; // COOLDOWN：不動人龍（FR20）
  const remaining = q.remaining - 1;
  if (remaining > 0) return { ...state, queue: { ...q, remaining } };
  // SOLD_OUT：以本波最終 length 計算（波中升級後的長度）
  const coins = BALANCE.selloutCoinsPerCustomer * q.length;
  const energy = BALANCE.selloutEnergy;
  const xp = BALANCE.selloutXpPerCustomer * q.length;
  return {
    ...state,
    coins: state.coins + coins,
    energy: state.energy + energy,   // 可以超過上限，和訂單獎勵一樣
    xp: state.xp + xp,
    queue: { ...q, remaining: 0, cooldownEndsAt: now + BALANCE.queueCooldownMs },
    lastSellout: { wave: q.wave, coins, energy, xp, doubled: false },
    events: [...state.events, { type: 'queue_sold_out', wave: q.wave, length: q.length }],
  };
}
```

- **事件順序**：`completeOrder` 目前在最後才 push `order_completed`。插入 `advanceQueue` 之後，`queue_sold_out` 會先進 `events`。要調整成 `order_completed` 在前，例如先 push `order_completed`，再呼叫 `advanceQueue`；或在最後重新排列。S2.4 的完售演出要蓋在出單演出之後。
- **syncQueue**：
  1. `cooldownEndsAt === null && remaining > 0` → 原樣回傳（**同一個參考**，store 才不會每秒產生新 state 並觸發存檔）。
  2. `cooldownEndsAt === null && remaining === 0`（不該出現，例如手改存檔）→ 直接開新波。
  3. 冷卻中、`cooldownEndsAt − now > queueCooldownMs`（時鐘倒退）→ 截成 `now + queueCooldownMs`。
  4. `now ≥ cooldownEndsAt` → 開新波：`wave + 1`、`length = remaining = queueCapacity(state)`、`cooldownEndsAt = null`、`lastSellout = null`。只開一波，不補發離線期間「錯過」的波次（波次要靠出單消化）。
  5. 其他 → 原樣回傳。
- **growActiveWave**：照架構文件的程式碼。`queueCapacity` 已經含上限 20 與 `bonus`。`delta` 取 `max(0, …)`，所以除錯面板調低等級也不會讓人龍變短。
- **needsTick(state, _now)**：`state.energy < BALANCE.maxEnergy || state.queue.cooldownEndsAt !== null`。`now` 先保留在簽名裡，S6.1 的開幕週體力上限 `maxEnergy(state, now)` 會用到。架構文件規定：新增任何倒數計時，都要同步擴充這個函式。[Source: game-architecture.md#Time & Day Rollover]
- **完售獎勵不含攤位加成**；`lastSellout` 留給 S6.3 的「看廣告加倍」（`grantAdReward` 會把整份再發一次）。
- 不需要改存檔形狀：`queue` 與 `lastSellout` 在 S1.5 已經定好，`isValidQueue` 也接受冷卻狀態。**不要**遞增 `SAVE_VERSION`。
- 衍生值不存檔：人龍上限一律由 `queueCapacity` 即時計算。[Source: project-context.md]

### 和其他 story 的界線

- S2.2 才做棋盤頂端的計量條；S2.3 做 `distributeQueue` 與夜市街頭像；S2.4 做完售演出（FxController 訂閱 `queue_sold_out`）。這個 story **不碰 UI**，只有 T8 的除錯摘要例外。
- 線索單（S4.2）不能完成，所以不會扣人龍；貴客單（E4）完成時照樣扣（GDD M3：「每完成 1 張訂單（含貴客單）人龍 −1」）。目前所有可完成的訂單都會走 `advanceQueue`，之後不需要再改。

### 測試要求

- 規則層不 mock 任何東西。用固定的 `NOW` 和 seed；需要特定 queue 狀態時，直接展開 `createGame(NOW, 1)` 後覆寫 `queue`、`stalls`、`board`、`orders`，不要依賴隨機結果。
- 完成訂單的測試需要棋盤上剛好有訂單要的品項：參考 `engine-test.ts`、`stall-orders-test.ts` 既有的 helper（例如把 `order.requirements` 對應的品項放上棋盤）。
- `store-test.ts`：可以補一個 apply 在冷卻中、時間未到時不產生新 state 的測試（`syncQueue` 回傳同一個參考）。
- `balance-doc-test` 會同步 `docs/balance.md`。只新增 BALANCE 欄位不影響期望金幣表，但如果測試會列出 BALANCE 的鍵，要一起更新文件。

### 前一個 Epic 的心得（E1 retro）

- **時間一律從 `apply` 拿 `now`**，規則層禁用 `Date.now()`（lint 會擋）。`completeOrder`、`reopenStall`、`upgradeStall` 已經在 S1.10 審查後改成接收 `now`，UI 的呼叫端是 `apply((state, now) => …)`，**不需要**改 UI。
- 除錯面板的時間快轉（`advanceTime`）會立刻 `apply` 一次，所以快轉超過冷卻時間時，會馬上開新波。
- 實機驗證：設定 `.env.local` 的 `EXPO_GO_DEBUG_TOOLS=1`，然後執行 `npx expo start --go --tunnel --no-dev --minify`。在設定畫面長按版本號 2 秒，就能打開除錯面板。

### Project Structure Notes

- 新檔案只有 `src/game/__tests__/queue-test.ts`。其餘都是修改既有檔案，路徑符合架構文件〈E2 排隊人龍〉：`game/queue.ts`。
- `queue.ts` 只能 import `./content` 和 `./types`；`time.ts` 可以 import `./engine` 和 `./queue`。

### Project Context Rules

- 規則層（`src/game/**`）是純 TS：不 import react、RN、expo、services、features、ui、zustand（只有 store.ts 例外）；禁止 `Date.now`、`Math.random`、`new Date()`、`performance.now`。
- 所有規則函式都是 `(state, ..., now) => state`，`now` 放在最後一個參數。
- 獎勵（金幣、體力、XP）只能在規則層增加。
- 副作用（演出、音效、埋點）一律訂閱 `GameEvent`；事件型別名稱是 snake_case 過去式。`queue_sold_out` 已經定義在 `events.ts`。
- 熱路徑（每秒 tick、`syncAll`）不寫 log、不配置大物件。`syncQueue` 沒有變化時，要回傳原本的參考。
- 數值只放在 `src/game/content/balance.ts`，元件與服務不得寫死數字。
- 測試放在同層的 `__tests__/`，檔名 `<module>-test.ts`；RNTL 14 的 `render`、`fireEvent`、`act` 都要 await。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。
- 完成前執行 lint、tsc、jest。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: 人龍波次規則]
- [Source: _bmad-output/game-architecture.md#NP-2 人龍波次（Queue Wave）]
- [Source: _bmad-output/game-architecture.md#Time & Day Rollover]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/gdd.md#M3 排隊人龍]
- [Source: _bmad-output/project-context.md]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-11-10.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`queue-test.ts` 先跑，`syncQueue`、`growActiveWave`、`needsTick` 都不存在（is not a function）。
- 「剛好完售」的測試一開始預期錯誤：完售的 14 XP 會讓 Lv1 玩家升級，多出 20 體力。改成在 Lv10 下測試，升級的情況另外由「完售的 XP 會觸發升級」測試涵蓋。

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `queue.ts`：新增 `advanceQueue`（出單 −1，清空時完售）、`syncQueue`（冷卻結束開新波、時鐘倒退截短、remaining 0 卻沒冷卻時自我修復；沒有變化時回傳同一個參考）、`growActiveWave`。仍然只 import `content` 與 `types`。
- `completeOrder`：`order_completed` 改在發放獎勵時就放進 events，接著呼叫 `advanceQueue`，所以事件順序固定是 `order_completed` → `queue_sold_out`；完售 XP 和訂單 XP 一起結算升級。
- `reopenStall`、`upgradeStall`：回傳前呼叫 `growActiveWave`（事件內容不變）。
- `time.ts`：`syncAll` = syncEnergy → syncQueue；新增 `needsTick`。`game-session.ts` 的每秒 tick 改用它，時間加上除錯快轉偏移量。
- 除錯面板：人龍狀態一行、「剩最後 1 位」（`debugQueueLastCustomer`，冷卻中不動作）。Prettier 重新排版了這個檔案裡原本超過 100 字的按鈕行，沒有行為變化。
- 沒有改存檔形狀，`SAVE_VERSION` 維持 2。
- 驗證：lint 0、tsc 0、jest 274 通過（新增 queue-test 21 個、debug-test 1 個、debug-panel-test 1 個）。
- T10 待使用者在 iPhone 上驗證。

### File List

- `src/game/queue.ts`（修改）
- `src/game/time.ts`（修改）
- `src/game/engine.ts`（修改）
- `src/game/stalls.ts`（修改）
- `src/game/debug.ts`（修改）
- `src/game/content/balance.ts`（修改）
- `src/services/game-session.ts`（修改）
- `src/features/debug/debug-panel.tsx`（修改）
- `src/game/__tests__/queue-test.ts`（新增）
- `src/game/__tests__/debug-test.ts`（修改）
- `src/features/debug/__tests__/debug-panel-test.tsx`（修改）

## Change Log

- 2026-11-10：實作人龍波次規則（NP-2）、`needsTick`、除錯面板的人龍狀態；狀態改為 review。
