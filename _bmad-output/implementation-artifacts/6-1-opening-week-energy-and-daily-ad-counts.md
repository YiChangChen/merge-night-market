---
baseline_commit: aa6202c
---

# Story 6.1: 開幕週體力與每日廣告計數

Status: review

## Story

As a 新玩家,
I want 前 3 天體力上限是 200，看廣告的次數每天台北時間午夜歸零,
so that 我在最容易流失的前幾天玩得夠盡興，規則也清楚好懂。

## Acceptance Criteria

1. `maxEnergy(state, now)`：`now < meta.firstLaunchAt + 72h` 時回傳 200，否則回傳 100（FR36）。這是衍生值，不存檔。
2. 新局的初始體力是 200。`syncEnergy` 改用 `maxEnergy(state, now)` 判斷體力是否已滿。開幕週結束時，超過 100 的體力保留，但要降回 100 以下才會再自然回復。
3. `needsTick` 的體力條件改成「體力 < `maxEnergy(state, now)`」；`daily-test.ts` 補上「開幕週內體力 150 時 `needsTick` 為 true」。
4. v1 遷移的玩家，`firstLaunchAt = now − 72h`，所以不享有開幕週。
5. `dateKeyUTC8(now)` 以 UTC+8 計算日期；`syncDaily` 在 dateKey 變大時把 `adEnergyUsed` 和 `adDoubleUsed` 歸零。dateKey 變小（時鐘倒退）時視為還沒換日，不歸零。
6. 依 NP-4 實作 `canWatchAd(state, placement)` 與 `grantAdReward(state, placement, now)`：
   - `energy`：每日上限 5 次，每次 +20 體力。
   - `sellout-double`：每日上限 3 次，而且 `lastSellout` 必須存在、`doubled` 為 false；獎勵是把整份完售獎勵再發一次。
   - 超過上限或條件不符時，回傳原本的 state。
7. `daily-test.ts` 與 `time-test.ts` 涵蓋以下情境：
   - 開幕週的邊界（71:59 / 72:00）
   - 超過上限的體力
   - 跨日歸零
   - 裝置時區改變不影響結果
   - 時鐘倒退
   - 每日上限
   - 同一波重複加倍
   - `grantAdReward` 連續呼叫兩次

## Tasks / Subtasks

- [x] T1 測試先行：`daily-test.ts`（maxEnergy 邊界、syncDaily、canWatchAd、grantAdReward），`time-test.ts`（dateKeyUTC8、syncAll 含 syncDaily、needsTick），`engine-test`（新局 200、開幕週回復到 200、結束後超過 100 保留且不回復）
- [x] T2 BALANCE：`openingWeekMaxEnergy: 200`、`adEnergy: 20`、`adEnergyDailyLimit: 5`、`adDoubleDailyLimit: 3`；`maxEnergy: 100` 保留，作為開幕週後的上限
- [x] T3 `src/game/levels.ts`：把 `xpToNextLevel`、`applyLevelUps` 從 engine 移出（engine 重新匯出）。這樣 daily 可以處理完售加倍時 XP 造成的升級，又不會和 engine 互相 import
- [x] T4 `src/game/daily.ts`：`maxEnergy`、`dateKeyUTC8`、`syncDaily`、`Placement`、`canWatchAd`、`adRemaining`、`grantAdReward`（事件 `ad_rewarded`）
- [x] T5 engine：`createGame` 的體力用 `maxEnergy(state, now)`；`syncEnergy`、`msUntilNextEnergy` 改用 `maxEnergy`
- [x] T6 time：`syncAll` 最後加上 `syncDaily`；`needsTick` 加上體力 < `maxEnergy`，以及換日（`dateKeyUTC8(now) > daily.dateKey`）；`time.ts` 重新匯出 `dateKeyUTC8`
- [x] T7 HUD：體力上限顯示改成 `maxEnergy(state, now)`（開幕週顯示 /200）
- [x] T8 反向驗證（A4、E5 retro A5）：拿掉「時鐘倒退不歸零」、「doubled 為 true 時不能再加倍」、「開幕週結束後超過 100 不回復」，確認測試失敗
- [x] T9 驗證：lint、tsc、jest；換行都是 LF（E5 retro A4）
- [x] T10 **（使用者）** 實機：除錯「開新局」後 HUD 顯示 ⚡ 200/200；用掉一些體力後會回復到 200

## Dev Notes

### 目前狀態

- **engine.ts**：
  - `createGame` 的體力是 `BALANCE.maxEnergy`（100）。
  - `syncEnergy` 依經過時間回復體力。已滿時只更新 `energyUpdatedAt`；獎勵可以超過上限，超過時不回復。
  - `msUntilNextEnergy` 只接收 `energy` 和 `energyUpdatedAt`。
  - `applyLevelUps` 是私有函式，`completeOrder` 會用到。
- **time.ts**：`syncAll` 的順序是 energy → queue → orders → tutorialHint。`needsTick` 的體力條件寫死 `BALANCE.maxEnergy`。
- **types.ts**：`meta.firstLaunchAt`、`daily { dateKey: '', adEnergyUsed, adDoubleUsed }`、`lastSellout { wave, coins, energy, xp, doubled }` 在 S1.5 已經定義，存檔形狀不用改（`SAVE_VERSION` 維持 2）。
- **migrations.ts**：v1 遷移時 `firstLaunchAt = now − BALANCE.openingWeekMs`，所以 AC4 已經成立，只要補測試。
- **queue.ts**：完售時寫入 `lastSellout`（`doubled: false`），下一波開始時清成 null。
- **HUD**（`src/app/(tabs)/index.tsx`）：顯示 `⚡ energy/BALANCE.maxEnergy` 與下一點的倒數。

### 規則細節

- **`maxEnergy(state, now)`**：只看 `meta.firstLaunchAt`，型別用 `Pick<GameState, 'meta'>`。
- **跨過開幕週邊界的離線回復**：一律用 `now` 當下的上限。例如第 70 小時體力 50，離線到第 80 小時，回來後最多回復到 100。這是簡化，玩家不會吃虧到原本就有的體力。
- **`dateKeyUTC8(now)`**：`new Date(now + 8h)` 再取 UTC 的年、月、日，和裝置時區無關。格式是 `YYYY-MM-DD`，可以直接用字串比大小。
- **`syncDaily`**：
  - `dateKeyUTC8(now) > daily.dateKey` 時，計數歸零並寫入新的 dateKey。空字串比任何日期都小，所以第一次結算會寫入當天日期。
  - 日期相同或變小時回傳同一個參考，不產生新 state。
- **`canWatchAd(state, placement)`**：只看 state，不看時間。呼叫端要先 `syncDaily`；`grantAdReward` 內部會先執行。
  - `energy`：`adEnergyUsed < 5`，而且體力不足（`energy < BALANCE.spawnEnergyCost`，和 `getSpawnBlocker` 的 `no-energy` 同一個條件；S6.2 的按鈕也只在這時出現）。
  - `sellout-double`：`adDoubleUsed < 3`、`lastSellout` 存在、`doubled` 為 false。
- **`adRemaining(state, placement)`**：今天還剩幾次，給 S6.2、S6.3 的按鈕顯示。
- **`grantAdReward`**：
  - 先 `syncDaily`，再檢查 `canWatchAd`；不能看就回傳 sync 後的 state。重複呼叫是安全的：第二次時加倍已經標記，或體力已經足夠。
  - `energy` 給 +20 體力，可以超過上限，和其他獎勵一樣。
  - `sellout-double` 再發一次 coins、energy、xp，標記 `doubled: true`，`adDoubleUsed + 1`，並用 `applyLevelUps` 結算升級。
  - 送出 `{ type: 'ad_rewarded', placement }`。
- **`needsTick`**：
  - 體力條件：`energy < maxEnergy(state, now)`。
  - 換日：`dateKeyUTC8(now) > daily.dateKey` 時回傳 true，每天只會成立一次，因為結算後 dateKey 就更新了。這樣跨過午夜時，S6.2、S6.3 顯示的剩餘次數也會跟著更新。

### 會佔位的機制（E4 retro A3）

這個 story 沒有新增會佔位的東西。

### 測試

- 時區：測試裡模擬裝置時區改變的方式是比較 `dateKeyUTC8` 的結果和 `Date.prototype.getTimezoneOffset` 無關。用固定的 UTC 時間戳驗證：UTC 15:59 → 當天；UTC 16:00 → 隔天。
- 金額（E5 retro A3）：完售加倍的金幣、體力、XP 都和 `lastSellout` 完全相同，用多組 lastSellout 驗證。

### Project Context Rules

- 規則層是純 TS，不得使用 `Date.now` 或 `Math.random`；`new Date(timestamp)` 可以用。
- 模組不能互相 import（S4.1 的做法：把共用的部分搬到獨立模組）。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]（FR36）
- [Source: _bmad-output/game-architecture.md]（Time & Day Rollover、NP-4）
- [Source: epic-5-retro-2026-11-11.md]（D1、A3–A5）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 加上換日條件後，8 個舊測試失敗：
  - 舊測試把 `BALANCE.maxEnergy`（100）當成「體力已滿」，但新局在開幕週內，上限是 200。測試時間都在開幕週內，所以改成 `openingWeekMaxEnergy`。
  - 新局的 `dateKey` 是空字串，第一次結算一定會產生新 state，`store-test`「action 沒有改變 state 時不觸發更新」因此失敗。改成 `createGame` 開局就寫入當天日期；v1 遷移的存檔仍是空字串，由第一次結算補上。
- 反向驗證（A4）：
  - 時鐘倒退也歸零 → 2 個失敗。
  - 已加倍還能再加倍 → 2 個失敗。
  - `syncEnergy` 的上限不看開幕週 → 2 個失敗。
  - 還原後全部通過。
- 用 Bash 長 heredoc 寫多個檔案時被 shell 解析失敗，改用 Write 工具與 scratchpad 的 .py。

### Completion Notes List

- `daily.ts`（新增）：
  - `maxEnergy`：開幕週 200，之後 100；只需要 `meta.firstLaunchAt`。
  - `dateKeyUTC8`：依時間戳計算，和裝置時區無關。
  - `syncDaily`：日期變大才歸零；同一天或時鐘倒退時回傳同一個參考。
  - `Placement`、`adRemaining`、`canWatchAd`、`grantAdReward`：energy +20；sellout-double 把整份完售獎勵再發一次並結算升級；兩者都送出 `ad_rewarded`。重複呼叫是安全的。
- `levels.ts`（新增）：`xpToNextLevel`、`applyLevelUps` 從 engine 移出（engine 重新匯出），讓 daily 能結算升級，又不必和 engine 互相 import。
- engine：
  - 新局體力 200，`daily.dateKey` 開局就是當天日期。
  - `syncEnergy`、`msUntilNextEnergy` 改用 `maxEnergy`。開幕週結束後，超過 100 的體力保留但不回復。
- time：
  - `syncAll` 最後加上 `syncDaily`。
  - `needsTick` 的體力條件改用 `maxEnergy`，並加上換日條件（每天只成立一次）。
  - 重新匯出 `dateKeyUTC8`。
- BALANCE 新增 `openingWeekMaxEnergy: 200`、`adEnergy: 20`、`adEnergyDailyLimit: 5`、`adDoubleDailyLimit: 3`；事件新增 `ad_rewarded`。
- HUD：體力上限改成依開幕週顯示（⚡ x/200）。
- 存檔形狀不變，`SAVE_VERSION` 維持 2。v1 遷移不享有開幕週，由測試確認。
- 驗證：
  - jest 38 suites／647 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。

### File List

- `src/game/daily.ts`、`src/game/levels.ts`（新增）
- `src/game/engine.ts`、`src/game/time.ts`、`src/game/events.ts`、`src/game/content/balance.ts`
- `src/app/(tabs)/index.tsx`（HUD 體力上限）
- `src/game/__tests__/daily-test.ts`、`time-test.ts`（新增）
- `src/game/__tests__/engine-test.ts`、`queue-test.ts`、`vip-test.ts`、`debug-test.ts`

## Change Log

- 2026-11-11：S6.1 實作完成（開幕週體力上限、每日廣告計數、canWatchAd／grantAdReward），狀態改為 review，等實機確認（T10）。
- 2026-11-11：使用者實機確認通過（T10）。
