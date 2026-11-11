---
baseline_commit: ca1b164
---

# Story 3.3: 棋盤上的發明菜與搖頭彈回

Status: review

## Story

As a 玩家,
I want 在棋盤上看到發明菜和它疊了幾份，組錯時品項搖頭彈回原位，高階品項還會冒熱氣,
so that 我一眼看得懂剛剛那一拖發生了什麼事。

## Acceptance Criteria

1. `board.tsx` 落子時呼叫 `apply((s, now) => applyDrop(s, from, to, now))`（S3.2 已接上）。判定結果是 reject 時，被拖的品項播放搖頭動畫後彈回原格（UX-DR6），不消耗任何東西。
2. 發明菜在格子裡顯示圖示，右下角標示份數（×2、×3）；發明菜不能和品項合成。
3. L4 以上的品項和發明菜有冒熱氣的小動畫，畫面失焦時暫停（UX-DR9）。
4. 拖曳的手勢與手感保持不變（不重構 e4be9f6 的拖曳實作），落子的判定一律交給規則層。
5. 在 iPhone 實機上棋盤擺滿 L4+ 品項時，拖曳仍維持 60 FPS（NFR1；Android 效能統一在 S7.6 前複驗）。

## Tasks / Subtasks

- [x] T1 放開後的動畫依規則層的判定決定：`Board` 新增 `previewDrop(from, to)` prop，棋盤畫面用 `resolveDrop` 實作（讀當下的 store state）。純函式 `releasePlan(kind)` 決定要不要把目標滑回來源、被拖的棋子落在哪裡、要不要搖頭，並寫測試（AC1、AC4）
- [x] T2 reject：被拖的棋子在放開處左右搖 3 下，再滑回原格；目標不動。仍然呼叫 `onMove`，讓規則層送出 `invent_rejected`（AC1）
- [x] T3 發明菜份數徽章：右下角、和品項階數不同的底色，只在 2、3 份時顯示（AC2）
- [x] T4 冒熱氣：L4+ 品項與發明菜，兩縷白煙往上飄並淡出；整個棋盤共用一個時鐘 shared value，各格只用相位差；`Board` 新增 `animate` prop，棋盤分頁失焦時停止（AC3、AC5）
- [x] T5 元件測試：份數徽章、冒熱氣只出現在 L4+ 與發明菜、`releasePlan` 的各種判定
- [x] T6 驗證：lint、tsc、jest、iOS 打包
- [x] T7 **（使用者）** 實機：組錯時搖頭彈回、發明與疊加的落點、份數徽章、冒熱氣、切到夜市街再回來；棋盤擺滿 L4+ 時拖曳順不順（AC5，記下感受）

## Dev Notes

### 不能動的部分（AC4）

`board.tsx` 的手勢設定（`panConfig`、`usePanGesture`、`handlers` ref、`beginPress`／`startDrag`／`finishGesture`、浮動圖層、`liftedCell`）全部不改。這個 story 只改 `dropAt` 放開之後「要播什麼動畫」的分支，以及棋子的顯示（`PieceView`、`BoardPiece`）。

### 放開後的動畫（現況 → 改法）

現況：`dropAt` 遇到 `canMerge` 就直接 `onMove`（合成特效接手）；其餘情況被拖的棋子滑到落點，如果目標格有棋子，就把它滑回來源（交換）。

改法：`const kind = previewDrop?.(from, to) ?? (canMerge ? 'merge' : target ? 'swap' : 'move')`，再用 `releasePlan(kind)`：

| 判定 | 目標滑回來源 | 被拖的棋子 | 搖頭 |
|---|---|---|---|
| move | 否 | 滑到落點 | 否 |
| swap | 是 | 滑到落點 | 否 |
| merge | 否 | 不滑（合成特效接手） | 否 |
| stack | 否 | 滑到落點（疊上去） | 否 |
| invent | 否 | 滑到落點（變成發明菜，S3.4 再加演出） | 否 |
| reject | 否 | 在放開處搖頭，再滑回原格 | 是 |

- 搖頭用 `Glide` 加一個 `shake` 旗標：前段在放開處左右擺動，後段才滑回原格；時間拉長到約 420 ms。仍然用 JS 計時器收尾（現有模式）。
- `previewDrop` 由棋盤畫面提供：`(from, to) => resolveDrop(useGameStore.getState().state, from, to)?.kind ?? null`。只在放開時呼叫一次，不訂閱 store。

### 冒熱氣（AC3、AC5）

- 觸發條件：`piece.kind === 'item' && piece.level >= 4`，或 `piece.kind === 'dish'`。產生器、L1–L3 不冒。
- 效能：棋盤擺滿時最多 56 格。全部共用 `Board` 裡的一個 `steamClock`（`withRepeat(withTiming(1))`），每縷煙的 `useAnimatedStyle` 依格子編號加相位差，只有一個動畫在跑。`animate = false` 時 `cancelAnimation` 並歸零，煙隱藏。
- 只畫在棋盤格裡（`BoardPiece`），浮動圖層、滑動、飛行、合成特效裡的複本不畫，避免多餘的 animated view。
- `animate` 由棋盤畫面的 `useIsFocused()` 傳入（夜市街用同樣的做法）。

### Project Context Rules

- 不得重構 `features/board/board.tsx` 已調校好的拖曳手勢（commit e4be9f6）。
- 拖放結果只能由 `resolveDrop` 判定；UI 只能呼叫 `applyDrop`。
- 熱路徑（手勢 callback、worklet、render）不寫 log、不配置大物件、不 `setState`。
- 動畫用 Reanimated shared value，在 UI 執行緒執行。
- RNTL 14 的 `render`、`act` 要 await；棋盤元件要包在 `GestureHandlerRootView` 裡測。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。只格式化這次新增的部分，不要整檔重排 `board.tsx`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: 棋盤上的發明菜與搖頭彈回]（UX-DR6、UX-DR9、NFR1）
- [Source: _bmad-output/implementation-artifacts/3-2-drop-resolution-rules.md]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-11-10.md]（A2 實機描述、A4 演出要可觀察）

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- RNTL 14 的元素沒有 `findAll`，改用 `within(...)` 限定在某一格查詢。
- `board.tsx` 在 HEAD 本來就不符合 Prettier（整檔 CRLF 差異）。依 Dev Notes 不整檔重排，只確認新增的程式碼格式正確。

### Completion Notes List

- `release-plan.ts`：`releasePlan(kind)` 把規則層的判定換成動畫計畫（目標要不要滑回、被拖的棋子落在哪裡、要不要搖頭），6 種判定都有測試。
- `Board`：新增 `previewDrop`（放開時查一次 `resolveDrop`，不訂閱 store）與 `animate` props。`dropAt` 只改了「放開之後播什麼」的分支：合成照舊交給合成特效；組錯在放開處左右搖 3 下（幅度漸小）後滑回原格，目標不動，仍然呼叫 `onMove` 讓規則層送出 `invent_rejected`；發明、疊加的棋子滑到落點，不會把目標滑回來源；只有交換才把目標滑回。手勢設定（`panConfig`、`usePanGesture`、各個 handler）完全沒動，diff 已確認。
- 發明菜份數：右下角深橘底白字 ×2、×3，和品項階數的米色底區分；1 份不顯示。
- 冒熱氣：L4+ 品項與發明菜，兩縷白煙往上飄並淡出，相位依格子錯開。整個棋盤共用一個 `steamClock`（1.8 秒循環），只有一個動畫在跑；棋盤分頁失焦（`useIsFocused`）時停止並移除煙霧。只畫在棋盤格裡，浮動、滑動、飛行、合成特效的複本不畫。
- 驗證：lint 0、tsc 0、jest 402 通過（新增 release-plan-test 6 個、board-dish-test 淨增 2 個）、iOS 打包成功。
- T7：使用者實機確認通過（2026-11-11），包含棋盤擺滿 L4+ 時拖曳順暢（AC5）。

### File List

- `src/features/board/release-plan.ts`（新增）
- `src/features/board/__tests__/release-plan-test.ts`（新增）
- `src/features/board/__tests__/board-dish-test.tsx`（修改）
- `src/features/board/board.tsx`（修改：`dropAt` 放開後的分支、`PieceGlide` 搖頭、`PieceView` 份數徽章、冒熱氣、props）
- `src/app/(tabs)/index.tsx`（修改：`previewDrop`、`animate`）

## Change Log

- 2026-11-11：搖頭彈回、發明菜份數徽章、冒熱氣；狀態改為 review。
