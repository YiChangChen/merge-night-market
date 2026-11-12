---
baseline_commit: 04d008b
---

# Story 6.2: 體力不足時看廣告補體力

Status: review

## Story

As a 體力用完的玩家,
I want 點一下看完廣告就能 +20 體力，不用乾等,
so that 我可以把這一局玩完，而且是不是要看廣告由我決定。

## Acceptance Criteria

1. 點產生器時體力不足（`getSpawnBlocker = 'no-energy'`）會顯示體力不足的提示。只有在 `canWatchAd(state, 'energy') && ads.isReady('energy')` 都成立時，才顯示「看廣告 +20 體力」按鈕，並標示今天還剩幾次（FR37）。
2. 按下按鈕後 `await ads.show('energy')`。只有回傳 `'earned'` 時才執行 `apply(s => grantAdReward(s, 'energy', now))`；`'dismissed'` 或 `'unavailable'` 時不給任何東西（NP-4）。
3. 離線、廣告沒有庫存或載入失敗時，按鈕會被隱藏，提示改成只顯示下一點體力的回復倒數（FR39）。
4. 不加入任何插頁或橫幅廣告；廣告只換時間（體力），不換內容（NFR10）。
5. production profile 透過 `extra` 注入正式的 ad unit ID；development 和 preview 一律使用 `TestIds`；`app.config.ts` 內含 iOS ATT 的 `NSUserTrackingUsageDescription` 文案。
   - **依 E5 retro D1 延後**：這一項和真實 AdMob 一起在 S1.4 做。`app.config.ts` 已經有 `adUnitIds` 的注入（S1.1）。
6. 廣告播放結束後回到遊戲，棋盤和拖曳都可以正常操作。

## 範圍（E5 retro D1）

目前沒有開發版建置環境，接不了 AdMob。這個 story 依 NP-4 的 `AdService` 介面接一個**假的實作**，先把流程、每日上限與獎勵做完並測好；接真的 AdMob（S1.4）時只換實作。

- 假的廣告服務：
  - 除錯工具開著時，模擬播放 1.2 秒後回傳設定的結果：看完、跳過、沒有廣告，可以在除錯面板切換。
  - 正式版沒有除錯工具，`isReady` 一律為 false，按鈕不會出現（NFR10：寧可不給，也不給假的）。

## Tasks / Subtasks

- [x] T1 測試先行：
  - `ads-test.ts`：假實作的三種模式；停用時 `unavailable`；`show` 等待模擬時間。
  - `energy-prompt-test.tsx`：
    - 倒數與按鈕。
    - 剩餘次數。
    - `earned` 才發獎勵並關閉。
    - `dismissed` 不給。
    - 沒有廣告時隱藏按鈕、只顯示倒數。
    - 今天看滿 5 次時隱藏按鈕。
    - 播放中不能連點。
    - 體力回來自動關閉。
  - `debug-test`：體力歸零、廣告次數歸零。
- [x] T2 `src/services/ads.ts`：`AdService` 介面（`init`、`isReady`、`show`）、假實作與模式設定（zustand），以及 `useAdReady(placement)`。
- [x] T3 `features/energy/energy-prompt.tsx`：
  - 卡片：「體力不足」、下一點體力倒數，按鈕顯示今天還剩幾次。
  - 播放中按鈕顯示「廣告播放中…」並停用。
  - 拿到獎勵後關閉，並提示「+20 體力」。
  - 點背景或 ✕ 可以關閉。
- [x] T4 棋盤畫面：點產生器遇到 `no-energy` 時打開提示卡，取代原本的 toast；分頁失焦時關閉。
- [x] T5 除錯面板「廣告（假）」區：
  - 模式：看完、跳過、沒有廣告。
  - 「體力歸零」「廣告次數歸零」（`debugDrainEnergy`、`debugResetAdCounts`）。
- [x] T6 反向驗證（A4）：
  - 拿掉「只有 earned 才發獎勵」。
  - 拿掉「沒有廣告時隱藏按鈕」。
  - 以上兩項都要讓測試失敗。
- [x] T7 驗證：lint、tsc、jest；換行都是 LF。
- [x] T8 **（使用者）** 實機：
  - 用除錯「體力歸零」後點產生器，看提示卡與按鈕。
  - 切換三種模式各試一次：看完 → +20；跳過 → 沒有獎勵；沒有廣告 → 只有倒數。
  - 看滿 5 次後按鈕消失。

## Dev Notes

### 目前狀態

- 規則（S6.1）：
  - `canWatchAd(state, 'energy')`：體力 < 1，而且今天看不到 5 次。
  - `adRemaining`、`grantAdReward`（+20、計數 +1、送出 `ad_rewarded`；重複呼叫是安全的）。
- 棋盤畫面 `handleTapCell`：遇到 `no-energy` 時顯示 toast「體力不足，稍等一下再來」。
- HUD 已經有下一點體力的倒數（`msUntilNextEnergy`），每秒更新，並加上除錯快轉的 `timeOffsetMs`。
- 架構 NP-4 的流程：

  ```
  按鈕可見 = canWatchAd(state, placement) && ads.isReady(placement)
  點擊 → await ads.show(placement)
    'earned'      → apply(s => grantAdReward(s, placement, now))
    'dismissed'   → 什麼都不做
    'unavailable' → 什麼都不做（按鈕因為 isReady 變成 false 而隱藏）
  ```

### 會佔位的機制（E4 retro A3）

提示卡會擋住棋盤：
- 離開方式：✕、點背景、拿到獎勵、體力自然回到 1 以上時自動關閉、切換分頁時關閉。
- 播放中不能關閉，避免拿到獎勵時卡片已經不在。

### 底下有什麼（E5 retro A1）

提示卡置中蓋在棋盤上，背景半透明。玩家主動點了產生器才會出現，關閉後回到棋盤。

### 測試

- 假實作的模擬時間用 fake timers 推進。
- 金額（E5 retro A3）：+20 只有一種組合；連續看 5 次後的第 6 次不給，由 S6.1 的 `daily-test` 涵蓋。

### Project Context Rules

- 服務層（`src/services`）可以用 `Date.now`；規則層不行。
- UI 只透過 `apply` 改狀態；獎勵唯一入口是 `grantAdReward`。
- 換行用 LF（E5 retro A4）。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2]（FR37、FR39、NFR10）
- [Source: _bmad-output/game-architecture.md]（NP-4）
- [Source: epic-5-retro-2026-11-11.md]（D1）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- RNTL 14 的 `fireEvent.press` 會等 onPress 回傳的 Promise。播放廣告的 `watch()` 要等假計時器推進才結束，所以測試逾時。改成 `onPress={() => void watch()}`：播放在背景進行，畫面靠 `playing` 狀態更新。
- 實機回饋：
  - 新手引導的「圈兩格」畫在根層最上面，蓋住了提示卡。修正：提示卡的開關移到 overlay store（`energyPrompt`），引導在提示卡開著時讓開；棋盤分頁失焦時關閉提示卡，免得夜市街上的引導一直被藏起來。
  - 按鈕文字太長換成兩行，改成按鈕只寫「📺 看廣告 +20 體力」，剩餘次數放在下面一行。
  - 反向驗證：引導不讓開 → 1 個失敗。
- 反向驗證（A4）：
  - 跳過也給獎勵 → 1 個失敗。
  - 沒有廣告也顯示按鈕 → 1 個失敗。
  - 還原後全部通過。

### Completion Notes List

- `src/services/ads.ts`：
  - `AdService` 介面（`init`、`isReady`、`show` → `'earned' | 'dismissed' | 'unavailable'`），依 NP-4。
  - 假的實作：除錯工具開著時模擬播放 1.2 秒，回傳設定的結果；正式版 `isReady` 一律 false，按鈕不出現。
  - `useFakeAds`（模式）、`useAdReady`（給 UI）。接真的 AdMob（S1.4）時只換實作。
- `features/energy/energy-prompt.tsx`：體力不足提示卡。
  - 內容：下一點體力的倒數；按鈕只在 `canWatchAd && isReady` 時出現，並顯示今天還剩幾次。
  - 獎勵：只有 `earned` 才經由 `grantAdReward` 發獎勵，之後關閉並提示「+20 體力！」。
  - 跳過時不給；沒有廣告時只有倒數；看滿 5 次時顯示「今天的廣告次數用完了」。
  - 播放中按鈕停用、不能關閉；體力自然回來時自動關閉；✕ 或點背景也能關閉。
- 棋盤畫面：點產生器遇到 `no-energy` 時打開提示卡，取代原本的 toast；分頁不在前景時不顯示。
- 除錯面板「廣告」區：模式（看完、跳過、沒有廣告），以及「體力歸零」「廣告次數歸零」（`debugDrainEnergy`、`debugResetAdCounts`）。
- AC5（正式 ad unit ID、ATT 文案）依 D1 延後到 S1.4；`app.config.ts` 的 `adUnitIds` 注入在 S1.1 就有了。
- 沒有插頁或橫幅廣告（NFR10）。
- 驗證：
  - jest 45 suites／708 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功。

### File List

- `src/services/ads.ts`、`src/services/__tests__/ads-test.ts`（新增）
- `src/features/energy/`（新增：`index.ts`、`energy-prompt.tsx`、`__tests__/energy-prompt-test.tsx`）
- `src/app/(tabs)/index.tsx`
- `src/features/debug/debug-panel.tsx`
- `src/features/overlays/overlay-store.ts`、`src/features/tutorial/tutorial-guide.tsx`、`__tests__/tutorial-guide-test.tsx`（提示卡開著時引導讓開）
- `src/game/debug.ts`、`src/game/__tests__/debug-test.ts`

## Change Log

- 2026-11-12：S6.2 實作完成（假的廣告服務、體力不足提示卡、除錯廣告模式），狀態改為 review，等實機確認（T8）。
- 2026-11-12：實機回饋修正：引導不再疊在提示卡上；按鈕文字改成一行。
- 2026-11-12：使用者實機確認通過（T8）。
