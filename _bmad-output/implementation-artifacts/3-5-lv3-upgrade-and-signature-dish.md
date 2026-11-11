---
baseline_commit: d2a2f19
---

# Story 3.5: Lv3 升級與招牌菜

Status: done

## Story

As a 玩家,
I want 選一道含這攤食材的發明菜上架，把攤位升到 Lv3 大店，招牌全亮,
so that 我做出來的發明菜可以變成夜市街上看得見的成就。

## Acceptance Criteria

1. Lv2 攤位的面板：金幣足夠（600／600／1000／1500／2000），而且棋盤上至少有 1 份含該鏈的發明菜時，面板列出棋盤上所有符合條件的發明菜，讓玩家選一道（FR12、RC-7、UX-DR3）。
2. 確認之後執行 `upgradeStall(state, stall, now, recipe)`：扣金幣、從任一格扣 1 份該發明菜（RC-8）、攤位升到 Lv3、`signatureDish = recipe`，並 push `stall_upgraded`。
3. 夜市街上這一攤換成大店外觀，霓虹全亮，招牌下方顯示招牌菜（FR13、FR14；星等徽章在 E5 接上）。
4. 招牌菜確定後不能更換。沒有符合條件的發明菜時，按鈕停用，並提示需要哪一條鏈的發明菜。
5. 升級後如果人龍在 ACTIVE 狀態，會依 NP-2 立刻加長。
6. `stalls-test.ts` 補上測試：缺少發明菜、指定的發明菜不含該鏈、從 3 份中扣掉 1 份、扣到 0 份時清空格子。
7. Epic 3 完成定義：10 道配方都能觸發；無效組合不會扣資源；可以完成一次 Lv3 升級；`art-manifest` 的 E3 批次全部定稿，配方名稱用 `docs/content.md` 的定稿，E3 範圍內的 `TODO(content)` 清零。Epic 結束時在 iPhone 實機上量測 NFR1–3（暫定），結果記入 retro。

## Tasks / Subtasks

- [x] T1 測試先行：`stalls-test.ts`（AC2、AC4–AC6）與 `drop-test.ts`「10 道配方都能觸發」（AC7）
- [x] T2 規則：`upgradeCheck` 多回傳 `candidates`（棋盤上含該鏈的發明菜，不重複，依 RECIPES 順序），Lv3 的 `ok` 需要至少一道；`upgradeStall(state, chain, now, recipe?)` 的 Lv3 分支：檢查 recipe 是候選之一 → 扣金幣 → 從第一個放著這道菜的格子扣 1 份（剩 0 份清空並放上待放產生器）→ Lv3、`signatureDish` → `growActiveWave` → `stall_upgraded`（AC1、AC2、AC4、AC5）
- [x] T3 攤位面板：Lv2 顯示金幣與「含這一攤食材的發明菜」兩個條件；列出候選發明菜（圖示＋名稱）讓玩家選一道；選好且金幣足夠才能升級；提示「招牌菜確定後不能更換」；沒有候選時按鈕停用並說明需要哪一攤的食材（AC1、AC4）
- [x] T4 防連點（S1.10 審查留下的待辦）：按下重開或升級後立刻擋住第二次（ref），避免快速連點升兩級
- [x] T5 夜市街：Lv3 攤位在外觀上方（招牌下方）顯示招牌菜的圖示與名稱；只訂閱這一攤的 `signatureDish`（AC3）
- [x] T6 元件測試：面板的候選列表、選擇後升級、沒有候選時停用與提示、防連點；夜市街顯示招牌菜
- [x] T7 E3 完成定義檢查：`TODO(content)` 清零、art-manifest #32–#41 定稿（AC7）
- [x] T8 驗證：lint、tsc、jest、iOS 打包
- [x] T9 **（使用者）** 實機：做一道含 tea 的發明菜 → 手搖飲吧台升 Lv3、選招牌菜 → 夜市街大店外觀、霓虹全亮、招牌菜顯示；並記下 iPhone 的 FPS 感受（E3 retro 用）

## Dev Notes

- **現況**：`upgradeCheck` 對 Lv2→Lv3 一律回傳 `needsDish: true`、`ok: false`，面板顯示「需要發明菜（即將開放）」；`upgradeStall(state, chain, _now)` 只處理 Lv1→Lv2。`STALLS[c].upgradeCoins[3]` 已經是 600／600／1000／1500／2000。
- **候選發明菜**：`recipe.a.chain === chain || recipe.b.chain === chain`，而且棋盤上有這道菜。每條鏈有 4 道配方，所以最多 4 個候選。
- **扣哪一格**：AC 說「任一格」，取棋盤上第一個放著這道菜的格子（index 最小），結果可以預測、方便測試。
- **招牌菜不能更換**：只有 Lv2→Lv3 會設定 `signatureDish`，Lv3 沒有下一級，自然不能再改。
- **面板訂閱**：選擇候選需要讀 `board`。面板開著時不能拖曳棋子，所以訂閱 `board` 不影響效能；仍然用 `useShallow` 只取需要的欄位。
- **人龍加長**：`upgradeStall` 已經在回傳前呼叫 `growActiveWave`（S2.1），Lv3 分支沿用。
- **招牌菜的位置**：放在外觀區塊的頂端（霓虹招牌正下方），用絕對定位，不改變攤位高度，5 個攤位的底部仍然對齊。
- **E5 的界線**：招牌菜的星等徽章在 E5。

### Project Context Rules

- 獎勵與扣除只在規則層；UI 只透過 `apply` 呼叫 `upgradeStall`。
- 時間一律由 `apply` 傳入。
- 元件只用 selector 訂閱切片。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5: Lv3 升級與招牌菜]（FR12–FR14、RC-7、RC-8、UX-DR3）
- [Source: _bmad-output/implementation-artifacts/1-10-upgrade-stall-to-lv2-and-neon.md]（升級流程、防連點的待辦）
- [Source: _bmad-output/deferred-work.md]（S3.5 開放 Lv3 時要防止連點升兩級）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- 紅燈：`stalls-test` 8 個失敗（`upgradeCheck` 沒有 `candidates`、Lv3 分支不存在）。
- 「扣到 0 份時清空」的測試一開始預期產生器會放在剛空出的格子；實際上 `flushPendingGenerators` 放在第一個空格，改成檢查「格子清空，而且產生器有放上棋盤」。
- 防連點測試一開始只檢查結果，但規則層本身就會擋第二次（Lv3 沒有下一級），所以不拿掉 guard 也會通過。改成直接數 `apply` 呼叫次數；暫時拿掉 guard 時確認測試會失敗，再還原。

### Completion Notes List

- 規則：`upgradeCheck` 多了 `candidates`（棋盤上含這一攤食材的發明菜，不重複、依配方順序），Lv3 的 `ok` 需要至少一道。`upgradeStall(state, chain, now, recipe?)` 的 Lv3 分支：recipe 必須是候選之一 → 扣金幣 → 從第一個放著這道菜的格子扣 1 份（扣到 0 清空並放上待放產生器）→ Lv3 與 `signatureDish` → `growActiveWave` → `stall_upgraded`。招牌菜只在這裡設定一次，Lv3 沒有下一級，所以不能更換。
- 攤位面板（Lv2）：金幣、「1 份含這一攤食材的發明菜（棋盤上有 N 道／棋盤上沒有）」兩個條件；候選發明菜以圖示加名稱的選項列出（radio），選中的加金框；提示「招牌菜確定後不能更換」。按鈕文字依狀態顯示：金幣不足、需要含{攤位}食材的發明菜、先選一道招牌菜、升級（🪙600）。選好的菜如果不在棋盤上了（例如被賣掉），視為還沒選。
- 防連點：重開與升級都用 ref 擋住面板關閉前的第二次按壓（S1.10 審查的待辦，已在 deferred-work 標記解決）。
- 夜市街：Lv3 攤位在外觀頂端（霓虹招牌正下方）掛「招牌：{菜名}」，左邊是發明菜圖示，金框深藍底；絕對定位，不改變攤位高度。星等徽章在 E5。
- E3 完成定義：`drop-test` 新增「10 道配方都能觸發」；`src/` 的 `TODO(content)` 為 0，「即將開放」的占位文字已移除；art-manifest #32–#41 都是定稿。
- 驗證：lint 0、tsc 0、jest 433 通過、iOS 打包成功。
- T9：使用者實機確認通過（2026-11-11）。

### File List

- `src/game/stalls.ts`（修改）
- `src/game/__tests__/stalls-test.ts`（修改）
- `src/game/__tests__/drop-test.ts`（修改）
- `src/features/overlays/stall-panel.tsx`（修改）
- `src/features/overlays/__tests__/stall-panel-test.tsx`（修改）
- `src/features/street/stall-view.tsx`（修改）
- `_bmad-output/deferred-work.md`（防連點待辦標記解決）

## Change Log

- 2026-11-11：Lv3 升級與招牌菜、防連點；狀態改為 review。

### Review Findings（code review 2026-11-11，範圍 4157530..22879ef）

- [x] [Review][Patch] 金幣不足時按鈕只顯示「金幣不足」，條件列也沒有說是哪一攤的食材；條件列改成「1 份含{攤位}食材的發明菜」 [src/features/overlays/stall-panel.tsx]
- [x] [Review][Patch] `upgradeStall` 直接組新的攤位物件，沒有展開原本的欄位；之後新增的欄位會被丟掉 [src/game/stalls.ts]
- [x] [Review][Patch] 招牌菜沒有綁定 Lv3：除錯面板把 Lv3 調低時保留招牌菜，夜市街仍顯示，之後再升級會被覆寫。徽章只在 Lv3 顯示，除錯調低時清除招牌菜 [stall-view.tsx、src/game/debug.ts]
