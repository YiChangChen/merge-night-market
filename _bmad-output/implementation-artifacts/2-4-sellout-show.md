---
baseline_commit: 11438df
---

# Story 2.4: 完售演出

Status: done

## Story

As a 玩家,
I want 人龍清空的瞬間看到煙火和全街招牌一起閃爍，並清楚看到拿了多少獎勵,
so that 每一波完售都是一個值得停下來慶祝的小高潮。

## Acceptance Criteria

1. FxController 訂閱 `queue_sold_out`。完售發生時，不論玩家在棋盤還是夜市街，Overlay Host 都會播放「完售！」演出：煙火、所有已開攤位的招牌一起閃爍，並顯示本波獎勵（金幣、體力、XP）（FR19、UX-DR4）。
2. 演出可以點一下跳過，結束後回到原本的畫面，棋盤狀態保持不變。
3. 演出面板預留「看廣告獎勵加倍」按鈕的位置，在 E6 之前一律隱藏。
4. 演出期間，每秒 tick 照常運作，不會卡住。
5. 演出依 Story 1.3 的渲染方案（純 RN + Reanimated）實作，在 iPhone 實機上播放時不掉幀（Android 效能統一在 S7.6 前複驗）。
6. Epic 2 完成定義：新局可以完整消化一波 12 人，冷卻後出現下一波；升級攤位後，下一波的長度確實增加。Epic 2 結束時在 iPhone 實機上量一次 NFR1–3（暫定），結果記入 retro。

## Tasks / Subtasks

- [x] T1 overlay store：`sellout: { wave: number; token: number } | null`、`playSellout(wave)`、`finishSellout()`；FxController 處理 `queue_sold_out`（AC1）
- [x] T2 `features/overlays/sellout-show.tsx`：全螢幕演出（AC1–AC3、AC5）
  - [x] 半透明背景，點任何地方跳過；約 2.8 秒後自動結束（JS 計時器收尾，和 `RollingShutter` 相同做法）
  - [x] 「完售！」標題彈入；第 N 波
  - [x] 本波獎勵讀 `state.lastSellout`（只在 `lastSellout.wave === sellout.wave` 時顯示，避免讀到別波的資料）：🪙 +金幣、⚡ +體力、⭐ +XP
  - [x] 煙火：3 組固定位置的爆炸，每組 10 顆粒子向外擴散並淡出，依序延遲施放；全部是 Reanimated、`pointerEvents="none"`
  - [x] 「看廣告獎勵加倍」預留固定高度的空位，E6 之前不渲染按鈕
- [x] T3 Overlay Host 顯示完售演出，疊在攤位面板上面；Android 返回鍵先關演出（AC2）
- [x] T4 全街招牌一起閃爍：`StallView` 讀 `sellout.token`，傳給 `NeonSign`；已開攤位的整塊招牌快速閃 3 下。夜市街失焦（`animate = false`）時不播（AC1）
- [x] T5 測試（AC1–AC4）
  - [x] FxController：`queue_sold_out` → `sellout` 有值
  - [x] SelloutShow：顯示波次與 `lastSellout` 的獎勵；點一下呼叫 `finishSellout`；時間到自動結束；沒有加倍按鈕；不寫入遊戲 state
  - [x] Overlay Host：返回鍵關閉演出
- [x] T6 驗證：lint、tsc、jest、iOS 打包
- [x] T7 **（使用者）** 實機：棋盤上完售看到演出、點一下跳過、夜市街上完售時招牌一起閃；Epic 2 完成定義走一次；用 `--no-dev --minify` 量 FPS（記入 E2 retro）

## Dev Notes

- **現況**：`OverlayHost`（根層）目前只有攤位面板；`FxController` 處理 `stall_reopened`、`stall_upgraded`；overlay store 的演出用遞增序號（`++sequence`）當 token，同一個演出連續觸發也會重播。沿用同樣的模式。
- **事件順序**：S2.1 已經保證 `order_completed` 在 `queue_sold_out` 前面。
- **獎勵資料**：`queue_sold_out` 事件只有 `wave`、`length`；獎勵數字讀 `state.lastSellout`（S2.1 寫入，下一波開始時清除）。演出期間如果冷卻已經結束（例如除錯快轉），`lastSellout` 會變成 null，這時只顯示標題，不顯示數字。
- **不寫入遊戲狀態**：演出只讀 state，跳過或結束都只改 overlay store。AC4 的 tick 在 `services/game-session.ts`，與 UI 無關，演出不會阻擋它。
- **招牌閃爍**：`NeonSign` 外層包一個 `Animated.View`，在 `flash` token 改變且 `animate` 為 true、`level > 0` 時跑 `withSequence` 閃 3 下。不要改動既有三段霓虹的閃爍和通電邏輯。
- **煙火**：沿用 S1.3 原型的方式（約 30 顆粒子），位置和顏色固定（features 層雖然沒有禁用 `Math.random`，但固定值測試比較穩定）。
- **加倍按鈕**：S6.3 才會接上 `canWatchAd`、`grantAdReward`。這裡只留一個固定高度、`testID="sellout-double-slot"` 的空 View。

### Project Context Rules

- 副作用（演出）只能訂閱 `GameEvent`；FxController 絕不同步呼叫 `apply`。
- 熱路徑不寫 log、不 `setState`；動畫用 Reanimated shared value。
- `StyleSheet.absoluteFill`（RN 0.88 沒有 `absoluteFillObject`）。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: 完售演出]（FR19、UX-DR4）
- [Source: _bmad-output/game-architecture.md]（Overlay Host、FxController、Spike A 場景）
- [Source: _bmad-output/implementation-artifacts/2-1-queue-wave-rules.md]（`lastSellout`、事件順序）
- [Source: _bmad-output/implementation-artifacts/1-10-upgrade-stall-to-lv2-and-neon.md]（overlay token 模式）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- Prettier 連帶重新排版了沒改到的 `stall-panel.tsx`，已還原，只保留這個 story 的改動。

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- overlay store：`sellout { wave, token }`、`playSellout`、`finishSellout`；FxController 收到 `queue_sold_out` 就播放。
- `SelloutShow`：深藍半透明背景，3 組固定位置的煙火（每組 10 顆粒子，依序延遲 0／350／700 ms），「完售！」彈入，第 N 波，本波獎勵讀 `lastSellout`（波次相符才顯示）。`sellout-double-slot` 預留 44 pt 空位給 S6.3。點任何地方或 2.8 秒後結束，只改 overlay store，不寫入遊戲狀態。
- Overlay Host：完售演出疊在攤位面板上面（key = token，同一波重複觸發也會重播）；返回鍵先關演出再關面板。
- 夜市街：`StallView` 把 `sellout.token` 傳給 `NeonSign`，已開攤位的整塊招牌閃 3 下；失焦或鐵捲門時不閃，等級或焦點改變也不會重播。
- 驗證：lint 0、tsc 0、jest 302 通過（新增 sellout-show-test 7 個）、iOS 打包成功。
- T7：使用者實機確認通過（2026-11-10），包含 E2 完成定義與 iPhone 上的流暢度。

### File List

- `src/features/overlays/sellout-show.tsx`（新增）
- `src/features/overlays/__tests__/sellout-show-test.tsx`（新增）
- `src/features/overlays/overlay-store.ts`（修改）
- `src/features/overlays/fx-controller.ts`（修改）
- `src/features/overlays/overlay-host.tsx`（修改）
- `src/features/street/neon-sign.tsx`（修改）
- `src/features/street/stall-view.tsx`（修改）

## Change Log

- 2026-11-10：完售演出；狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 b16292b..7ae4012）

- [x] [Review][Patch] 全街招牌閃爍實際上幾乎看不到：完售只會在棋盤發生，當下夜市街失焦就不播，切回夜市街也不補播；點一下跳過還會把閃爍中斷。改成每個序號播一次：演出期間切到夜市街時補播，跳過不中斷。測試只檢查 testID，要改成驗證真的有播 [src/features/street/neon-sign.tsx]
- [x] [Review][Patch] 完售演出的 accessibilityLabel 蓋掉了獎勵文字，讀螢幕軟體聽不到拿了多少；也沒有 accessibilityViewIsModal，焦點會跑到底下的棋盤 [src/features/overlays/sellout-show.tsx]
- [x] [Review][Decision] （補跑 auditor）完售演出的背景約 80% 不透明，在夜市街完售時，底下的招牌閃爍幾乎看不見 — 要調淡背景讓街景透出來，還是維持現狀 → 使用者決定：調淡到約 45%（已套用）
- [x] [Review][Patch] （補跑 edge）演出途中冷卻到期（例如除錯快轉）時 lastSellout 被清除，獎勵列會突然消失、面板跳動；改成演出開始時記下獎勵 [src/features/overlays/sellout-show.tsx]
