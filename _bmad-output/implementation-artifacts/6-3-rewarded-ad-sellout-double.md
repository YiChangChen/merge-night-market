---
baseline_commit: 44134e7
---

# Story 6.3: 完售時看廣告加倍

Status: done

## Story

As a 剛完售的玩家,
I want 在完售畫面選擇看一支廣告，讓這一波的獎勵翻倍,
so that 完售的那一刻有更大的回報。

## Acceptance Criteria

1. 完售演出面板上的預留位置（S2.4），在 `canWatchAd(state, 'sellout-double') && ads.isReady('sellout-double')` 時顯示「看廣告獎勵加倍」按鈕，並標示今天還剩幾次（FR38、UX-DR4）。
2. 回傳 `'earned'` 之後，再發一次本波的金幣、體力、XP，並把 `lastSellout.doubled` 設為 true；每一波只能加倍一次。
3. 如果下一波已經開始（`lastSellout` 已清除），按鈕不顯示。
4. 廣告無法播放時隱藏按鈕，完售演出照常結束。

## 範圍（E5 retro D1）

沿用 S6.2 的假的廣告服務（`src/services/ads.ts`）。規則（`canWatchAd`、`grantAdReward`、每日 3 次）在 S6.1 已經完成並測過。

## Tasks / Subtasks

- [x] T1 測試先行（`sellout-show-test`）：
  - 按鈕出現的條件：可以看、有廣告、這一波的紀錄。
  - 剩餘次數。
  - `earned` 後金幣、體力、XP 再發一次，標記已加倍，畫面顯示加倍後的數字。
  - `dismissed` 不給。
  - 沒有廣告時隱藏按鈕，2.8 秒照常結束。
  - 下一波已經開始時不顯示。
  - 今天看滿 3 次時不顯示。
  - 有按鈕時演出延長到 6 秒；播放中不會自動結束；點背景不會在播放中關閉。
- [x] T2 `sellout-show.tsx`：
  - 預留位置換成按鈕「📺 看廣告 獎勵加倍」與「今天還剩 n 次」。
  - 面板改成 `box-none`，讓按鈕可以點。
  - 播放中按鈕顯示「廣告播放中…」。
  - 看完後獎勵列變成兩倍並顯示「獎勵加倍！」，1.2 秒後結束。
- [x] T3 反向驗證（A4）：
  - 拿掉「只有 earned 才發獎勵」。
  - 拿掉「播放中不自動結束」。
  - 以上兩項都要讓測試失敗。
- [x] T4 驗證：lint、tsc、jest；換行都是 LF。
- [x] T5 **（使用者）** 實機：
  - 用除錯「最後一位客人」完售，切換三種廣告模式各試一次。
  - 看完後金幣、體力、XP 加倍。
  - 看滿 3 次後按鈕消失。
  - 量 iPhone 效能數字（E5 retro A6）：冷啟動、分頁切換、拖曳。

### Review Findings

- [x] [Review][Patch] 加倍沒有真的發出時（拒發），畫面仍然顯示「獎勵加倍！」和 ×2 的數字；要依 store 的 `lastSellout.doubled` 判斷（blind） [src/features/overlays/sellout-show.tsx]
- [x] [Review][Patch] `ads.show` reject 時演出會永遠卡住；要用 try/finally 並把錯誤當成沒有廣告（blind） [src/features/overlays/sellout-show.tsx]

## Dev Notes

### 目前狀態

- **`SelloutShow`**（`features/overlays/sellout-show.tsx`）：
  - 在演出開始時記下 `lastSellout` 的獎勵（波次相同時）。
  - 點背景跳過，但前 0.4 秒的點擊不算。
  - 2.8 秒後自動結束。
  - 面板是 `pointerEvents="none"`；`sellout-double-slot` 是一個高 44 的空位。
- **規則**（S6.1）：
  - `canWatchAd(state, 'sellout-double')`：今天看不到 3 次、`lastSellout` 存在、還沒加倍。
  - `grantAdReward` 把整份獎勵再發一次，並結算升級。
- **S6.2 的模式**：
  - `ads.show` 回傳 Promise；`onPress={() => void watch()}`，不把 Promise 回傳給 onPress。
  - `useAdReady` 會跟著除錯面板的模式切換。

### 設計

- **決定時間**：原本 2.8 秒太短，來不及決定要不要看廣告。有按鈕時延長到 `SELLOUT_DECIDE_MS`（6 秒），沒有按鈕時維持 2.8 秒。
- **播放中**：不自動結束；點背景、按返回鍵也不會中斷結果。
  - 就算演出被關掉，`apply(grantAdReward)` 仍然會在看完時執行，玩家不會看了廣告卻拿不到獎勵。
- **看完後**：獎勵列顯示兩倍的數字和「獎勵加倍！」，1.2 秒後結束。
- **跳過**：什麼都不給，重新開始 6 秒的倒數。
- **按鈕判斷**：在 render 時讀 store。`lastSellout` 被清除（下一波開始）或已經加倍時，按鈕消失。

### 會佔位的機制（E4 retro A3）

完售演出原本就會擋住畫面，這次延長了：
- 有按鈕時最長 6 秒，點背景可以跳過。
- 播放中最長是假廣告的 1.2 秒；接真的廣告之後，由廣告 SDK 的關閉決定。

### Project Context Rules

- 獎勵唯一入口是 `grantAdReward`；UI 不自己加金幣。
- RNTL 14：`render`、`fireEvent`、`act` 都要 await；fake timers 用 `advanceTimersByTimeAsync`。
- 換行用 LF。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]（FR38、UX-DR4）
- [Source: 6-1、6-2 story 檔]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 「看完」的測試一開始體力對不上：`apply` 先結算體力回復，測試局的時間差讓體力自然回復，另外 XP 讓玩家升級又加了升級體力。改成把體力放在上限以上，並把升級體力算進預期。
- 反向驗證（A4）：
  - 跳過也給 → 1 個失敗。
  - 「播放中不自動結束」第一版測試抓不到：假廣告只播 1.2 秒，比 6 秒短，計時器有沒有暫停都不會在播放中觸發。改成讓 `ads.show` 一直不結束、推進 12 秒，拿掉暫停後就失敗（1 個失敗）。
  - 還原後全部通過。
- 切字串改測試時多留了一個 `});`，整個測試檔沒跑；已修正並重跑。
- 實機回饋：完售後的冷卻期間，畫面上仍有客人而且可以出餐，看起來像 bug。這符合 FR20（冷卻期間出餐照常給基本獎勵，但不計入人龍），使用者選擇維持規格、只改畫面（方案 A）：
  - 冷卻期間一般單標「加班」，貴客標「貴客・加班」，讀螢幕軟體加上「不計入人龍」（`order-card.tsx`）。
  - 反向驗證：不標加班 → 失敗。
- iPhone 效能（E5 retro A6，使用者量測）：分頁切換 17 次平均 38 ms（E5：35 ms；NFR3 ≤ 300 ms），冷啟動約 3 秒（E5：約 2 秒；NFR2 ≤ 3 秒，剛好在門檻上）。

### Completion Notes List

- `sellout-show.tsx`：預留位置換成「📺 看廣告 獎勵加倍」與「今天還剩 n 次」。
  - **出現條件**：這一波的紀錄還在、還沒加倍、今天還有次數（`canWatchAd`），而且 `isReady`。
  - **看完**：經由 `grantAdReward` 再發一次金幣、體力、XP，並結算升級；畫面的獎勵列變成兩倍並顯示「獎勵加倍！」，1.2 秒後結束。
  - **跳過**：什麼都不給，按鈕還在。
  - **沒有廣告、下一波已經開始、今天看滿 3 次**：不顯示按鈕，演出 2.8 秒照常結束。
- **決定時間**：有按鈕時演出延長到 6 秒（`SELLOUT_DECIDE_MS`）；播放中不自動結束，點背景也不會關掉。
- **獎勵保證**：就算演出被關掉，看完的獎勵照樣發。
- 面板改成 `box-none`，只有按鈕可以點；點面板以外的地方仍然是跳過。
- 驗證：
  - jest 45 suites／716 tests 全過。
  - `expo lint` 0、`tsc --noEmit` 0。
  - Prettier 通過，換行都是 LF。
  - iOS 打包成功。

### File List

- `src/features/overlays/sellout-show.tsx`
- `src/features/overlays/__tests__/sellout-show-test.tsx`
- `src/features/orders/order-card.tsx`、`__tests__/order-card-test.tsx`（冷卻期間的加班標示）

## Change Log

- 2026-11-12：S6.3 實作完成（完售加倍按鈕、延長決定時間、播放中不結束），狀態改為 review，等實機確認（T5）。
- 2026-11-12：冷卻期間的訂單標成「加班」（使用者選 A）；記錄 iPhone 效能數字。
- 2026-11-12：使用者實機確認通過（T5：三種廣告模式、加倍獎勵）。
- 2026-11-12：Epic 6 code review。「已加倍」以遊戲狀態為準、廣告出錯當成沒有廣告。狀態改為 done。
