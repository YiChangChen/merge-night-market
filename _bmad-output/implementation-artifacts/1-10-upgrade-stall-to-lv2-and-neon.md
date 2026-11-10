---
baseline_commit: 224c097
---

# Story 1.10: 升級攤位到 Lv2 與招牌通電

Status: done

## Story

As a 玩家,
I want 花金幣把攤位升到 Lv2，看霓虹招牌多亮一段,
So that 我每次回來都能讓夜市更熱鬧一點。

## Acceptance Criteria

1. 玩家在夜市街點一個 Lv1 攤位，金幣足夠時（tea 200、fried 200、noodle 400、dumpling 600、sweet 900）按下「升級」：`upgradeStall(state, stall, now)` 扣金幣、攤位升到 Lv2，並 push `stall_upgraded`；FxController 播放招牌通電演出，霓虹點亮到第 2 段（FR14）。
2. 該攤的新訂單金幣加成 +10%（FR15，由 S1.6 的公式自動計算）。
3. Lv2 攤位的面板會顯示 Lv3 的條件，但按鈕是鎖住的，並提示「需要發明菜（即將開放）」。
4. 從新局開始可以把 tea、fried 升到 Lv2；玩家升到 Lv3 後也能重開麵線攤（Epic 1 完成定義）。
5. Epic 1 結束時，在 Pixel 6a release build 上量一次 NFR1–3，結果記入 retro。
6. `docs/art-manifest.md` 的 E1 批次（夜市街背景、攤位外觀 20、霓虹 5、老闆頭像 5）全部是「定稿」，而且程式碼中屬於 E1 範圍的 `TODO(content)` 清零。
7. 時程檢查點：E1 retro 時如果已經超過 W3，啟動範圍調整評估（例如簡化 E5 的升星演出），由使用者決定。

## Tasks / Subtasks

- [x] T1 測試先行：`stalls-test.ts` 加上升級費用、`upgradeCheck`、`upgradeStall`、Epic 1 完成定義
- [x] T2 `content/stalls.ts` 的 `upgradeCoins`（FR12）；`stalls.ts` 的 `upgradeCheck`、`upgradeStall`（AC1–AC3）
- [x] T3 招牌通電演出：overlay store 的 `neonPowerOn`、FxController 處理 `stall_upgraded`、`NeonSign` 通電動畫（AC1）
- [x] T4 攤位面板的升級區塊：Lv1→Lv2 可升級；Lv2 顯示 Lv3 條件並鎖住；Lv3 顯示已是最高等級（AC1、AC3）
- [x] T5 驗證：lint、tsc、jest、iOS／Android 打包
- [x] T6 AC5：延後處理。使用者沒有 Android 手機，Pixel 6a 的 NFR1–3 量測已記入 deferred-work，最晚在 S7.6 之前完成
- [x] T7 AC6：E1 批次 31 張美術定稿並接上，`src/` 裡的 `TODO(content)` 已清零（2026-11-10）
- [x] T9 **（使用者）** 實機檢查夜市街的新美術與棋盤畫面（2026-11-10 通過）
- [x] T8 AC7：時程檢查點移到 Epic 1 retro 處理

## Dev Agent Record

### Implementation Plan

- **費用**：`STALLS[c].upgradeCoins` 為 `{ 2, 3 }`，依 FR12：Lv2 是 200／200／400／600／900，Lv3 是 600／600／1000／1500／2000。
- **規則**：
  - `upgradeCheck` 回傳目標等級、金幣、是否需要發明菜，以及是否可以升級。
  - Lv2→Lv3 的 `needsDish` 為 true，E3 之前 `ok` 一律是 false，並留下 `TODO(S3.5)`。
  - 鐵捲門（要先重開）和 Lv3（最高級）回傳 null。
  - `upgradeStall` 扣金幣、等級 +1，並 push `stall_upgraded`。S3.5 會擴充成 `upgradeStall(state, stall, now, recipe)`。
- **加成**：S1.6 的 `orderCoins` 本來就依攤位等級計算，升級後新訂單自動 +10%；已經存在的訂單金幣不變（RC-3）。
- **通電演出**：
  - FxController 收到 `stall_upgraded` 時呼叫 `playNeonPowerOn`。
  - `StallView` 把序號傳給 `NeonSign`；最新亮起的那一段（`level − 1`）先用 `withSequence` 閃幾下，再穩定亮起。
  - 0.9 秒後用 JS 計時收尾，回到一般的閃爍。
- **面板**：
  - 升級區塊顯示目標等級、效果、金幣條件，Lv3 另外顯示發明菜條件。
  - 按鈕文字依狀態切換：「升級（🪙N）」／「金幣不足」／「需要發明菜（即將開放）」。
  - 按下後關閉面板，讓玩家看到招牌通電。

### Debug Log

- 這次全部用 Edit 工具修改 `content/stalls.ts`，沒有再發生腳本替換比對不到的問題。
- 畫面測試第一次就全部通過。通電演出的清除，用假計時器驗證了「1 秒後清除，霓虹回到全亮兩段」。

### Completion Notes

- AC1：
  - `upgradeStall` 由 `stalls-test` 驗證：扣金幣、Lv2、事件，而且存檔仍然合法。
  - 面板流程由 `stall-panel-test` 驗證：按下升級後面板關閉，霓虹亮兩段，其中最新的一段正在通電。
- AC2：`stalls-test` 驗證升級後 `orderCoins([{tea, 2}])` 是 11（10 × 1.1）。
- AC3：Lv2 攤位的面板顯示「升級到 Lv3 大店」、金幣條件和「1 份含這一攤食材的發明菜（即將開放）」，按鈕停用並顯示「需要發明菜（即將開放）」。規則層也驗證了金幣再多都不能升到 Lv3。
- AC4：`stalls-test` 的「Epic 1 完成定義」用一局新遊戲把 tea、fried 升到 Lv2，再讓玩家 Lv3 加上 300 金幣重開麵線攤。
- **AC5 沒有達成**：沒有 Pixel 6a。iPhone 上的量測已經在 S1.3 完成；Android 複驗記在 deferred-work，最晚在 S7.6 之前完成。
- **AC6 已達成（2026-11-10）**：
  - **來源**：使用者產出 5 張素材表，分別是攤位與老闆（洋紅底）、補圖的 3 個攤位、5 個霓虹招牌（黑底）、夜市街背景，以及第一版的深色底素材表。
  - **處理**：用 `art-source/scripts/process-e1-art.py` 處理，總共 41 個 WebP，約 3.1 MB。
    - 攤位與老闆依洋紅色去背，依物件之間的空隙自動切圖，最近鄰放大 3 倍。
    - 霓虹依亮度去背，再切成三層。
    - 第一版深色底素材表曾經用 rembg 試著去背，但效果不好（半透明、身體被切掉），所以改請使用者重產純色底的版本。
  - **接上程式**：
    - `STALLS[c].art`（外觀 4 張、霓虹 3 層、老闆頭像）和 `STREET_BACKGROUND` 都在 `content/`。
    - `StallView` 依等級顯示外觀圖，等級越高圖越大。
    - `NeonSign` 疊三層圖，沒亮的那幾段以 12% 不透明度隱約顯示，通電演出沿用 S1.10 的寫法。
    - `RollingShutter` 改成用鐵捲門的圖往上收。
    - 夜市街的背景圖取代原本程式畫的燈泡串，`string-lights.tsx` 已刪除。
  - **檢查**：`src/` 裡的 `TODO(content)` 是 0；`content-stalls-test` 新增檢查，確認 41 個檔案都存在，也都接上了；美術清單 E1 的 31 列都標為定稿。
  - 原始素材表搬到 `art-source/`，不會被打包。
- AC7：要在 E1 retro 時處理。
- **測試**：`stalls-test` 增加 11 個（code review 更正：原本誤寫為 12）、`stall-panel-test` 增加 5 個，共 221 個通過；lint、tsc 也通過，iOS 和 Android 打包成功。

## File List

- src/game/content/stalls.ts（修改：upgradeCoins）
- src/game/stalls.ts（修改：upgradeCheck、upgradeStall）
- src/game/__tests__/stalls-test.ts（修改）
- src/features/overlays/overlay-store.ts、fx-controller.ts、stall-panel.tsx（修改）
- src/features/overlays/__tests__/stall-panel-test.tsx（修改）
- src/features/street/neon-sign.tsx、stall-view.tsx（修改：通電演出）
- _bmad-output/implementation-artifacts/1-10-upgrade-stall-to-lv2-and-neon.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-10：實機檢查通過（iPhone 16），包括夜市街新美術和修正後的棋盤訂單列。狀態改為 done。AC5 延後（deferred-work），AC7 交給 Epic 1 retro。
- 2026-11-10：E1 美術定稿並接上（AC6），等待實機檢查。
- 2026-11-10：完成 Story 1.10 的程式部分：升級到 Lv2、招牌通電演出、攤位面板的升級區塊。AC5（Android 量測）與 AC6（E1 美術）受阻，狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 194119f..main）

- [x] [Review][Patch] 素材尺寸超過規範上限，卻標為定稿：老闆頭像 699–807 px（上限 512）、霓虹圖層寬 1262–1370 px（上限 1024）。縮到上限以內，並在 content 測試加上尺寸檢查 [assets/images/owners, assets/images/stalls/*/neon-*.webp]
- [x] [Review][Patch] 面板把「訂單金幣 +10%」寫死在畫面上，違反「元件不得寫死數字」；改成從 `BALANCE.stallOrderBonusPerLevel` 計算 [src/features/overlays/stall-panel.tsx]
- [x] [Review][Patch] 美術清單第 1 列的路徑還寫 `street/background-*.webp`（切塊），實際是單一檔 `street/background.webp` [docs/art-manifest.md]
- [x] [Review][Patch] Completion Notes 寫「stalls-test 增加 12 個」，實際是 11 個 [本檔案]
- [x] [Review][Defer] 目前快速連點「升級」不會重複扣款，因為第二次判定時 Lv3 需要發明菜。S3.5 開放 Lv3 之後，在面板關閉前連點可能升兩級 [src/features/overlays/stall-panel.tsx] — deferred, 在 S3.5 加上「按下後立刻停用按鈕」的防護
