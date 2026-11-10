---
baseline_commit: 334843d
---

# Story 2.3: 夜市街的排隊頭像

Status: done

## Story

As a 玩家,
I want 在夜市街看到客人在各攤前排隊，攤位越強、隊伍越長,
so that 攤位實力直接變成眼前的人潮。

## Acceptance Criteria

1. 規則層的純函式 `distributeQueue(state)`，依各攤等級比例把 `remaining` 人分配到已開的攤位，總和恆等於 `remaining`。
2. 玩家切到夜市街時，每攤前方顯示分配到的客人頭像（沿用 12 種客人美術）。
3. 每攤最多畫 N 個頭像，N 依 Story 1.3 的結論（每攤 4 個）；超過的部分顯示「+k」（FR43）。
4. 出單後回到夜市街，看到的人數已經更新。
5. COOLDOWN 期間街上沒有排隊；新一波開始時，客人依序入列。
6. 夜市街失焦時，排隊的循環動畫暫停。
7. `queue-test.ts` 補上 `distributeQueue` 的測試：總和守恆、鐵捲門攤位分到 0、各攤等級相同時平均分配。

## Tasks / Subtasks

- [x] T1 `queue.ts`：`distributeQueue(state)`，最大餘數法；餘數相同時依 `CHAIN_IDS` 順序（tea → fried → noodle → dumpling → sweet），結果穩定（AC1、AC7）
  - [x] 測試：總和守恆（多組等級與人數）、鐵捲門分到 0、等級相同平均分配、等級比例（Lv2 對 Lv1 = 2:1）、冷卻中全部為 0
- [x] T2 `src/features/street/stall-queue.tsx`：每攤一排頭像（AC2–AC6）
  - [x] 只訂閱「這一攤分到的人數」和 `queue.wave`（都是數字），拖曳棋子不會重繪
  - [x] 最多 4 個頭像，超過顯示「+k」；人數為 0 時保留同樣高度的空位，攤位才會對齊
  - [x] 頭像 key = `${wave}-${index}`：新一波時用 `entering` 依序延遲進場（依序入列），人數減少時 `exiting` 淡出
  - [x] 頭像輕微上下晃動（`withRepeat`），`animate = false`（夜市街失焦）時停止並歸位
- [x] T3 `StallView` 在外觀與老闆卡之間放 `StallQueue`（AC2）
- [x] T4 元件測試：顯示人數與「+k」、冷卻中沒有頭像、只改棋盤時不重繪（AC2–AC5）
- [x] T5 驗證：lint、tsc、jest、iOS 打包
- [x] T6 **（使用者）** 實機：各攤前的排隊人數、出單後人數更新、完售後街上清空、新一波依序入列

## Dev Notes

- **分配（AC1）**：`open = 等級 ≥ 1 的攤位`，權重 = 等級。`quota = remaining × level / Σlevel`，先取 floor，剩下的人依小數部分由大到小補 1；小數相同時依 `CHAIN_IDS` 順序。冷卻中 `remaining = 0`，所以全部為 0。沒有攤位開著（存檔驗證已經擋掉）時全部為 0。
- **衍生值不存檔**：分配結果每次即時計算，不寫進 GameState。[Source: project-context.md]
- **訂閱**：`useGameStore((s) => s.state ? distributeQueue(s.state)[chain] : 0)` 回傳數字，Zustand 用 `Object.is` 比較，只有這一攤的人數變了才重繪。計算本身很便宜（5 攤），每次 store 更新都算一次可以接受。
- **頭像美術**：`CUSTOMERS[(wave × 5 + 攤位序號 × 3 + index) % 12]`，同一波內每攤的臉固定，各攤不會整排同一張臉。用 `contentFit="cover"`、`contentPosition="top"` 裁出臉部（和 S2.2 計量條、老闆頭像相同做法）。
- **版面**：`StallView` 是 `justifyContent: 'flex-end'` 的直排（霓虹 → 外觀 → 老闆卡），在外觀和老闆卡之間加一列固定高度的排隊列。人數為 0 也保留高度，5 個攤位的底部才會對齊。
- **動畫**：沿用 S1.3 原型的結論（純 RN + Reanimated，每攤 4 個頭像，頭像上下晃動）。晃動要依 index 錯開相位，不要整排同步。`animate` 是 `StreetScreen` 傳入的 `useIsFocused()`。
- **和其他 story 的界線**：完售演出（煙火、招牌一起閃）在 S2.4。

### Project Context Rules

- 規則層純 TS，不用 `Date.now()`、`Math.random()`。
- 元件只用 selector 訂閱切片；這個 story 不寫入 state。
- RNTL 14 的 `render`、`fireEvent`、`act` 都要 await；被 `accessibilityElementsHidden` 隱藏的元素要用 `includeHiddenElements`。
- Prettier：`--single-quote --print-width 100 --bracket-same-line --trailing-comma es5`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: 夜市街的排隊頭像]
- [Source: _bmad-output/game-architecture.md#NP-2 人龍波次（Queue Wave）]（`distributeQueue` 依各攤等級比例）
- [Source: _bmad-output/implementation-artifacts/1-3-spike-a-street-performance-gate.md]（每攤 4 個頭像）
- [Source: _bmad-output/implementation-artifacts/2-2-board-queue-meter.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5（claude-opus-5-5）

### Debug Log References

- `stall-view-test` 原本的「其他攤位升級時不重繪」不再成立：fried 升級後，tea 分到的人數由 6 變成 4，排隊列本來就應該重繪。拆成兩個測試：棋盤、金幣改變時不重繪；其他攤位升級時排隊人數正確更新。

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `distributeQueue`：最大餘數法，`Array.prototype.sort` 是穩定排序，小數相同時保留 `CHAIN_IDS` 順序。
- `StallQueue`：只訂閱這一攤分到的人數與 `queue.wave`（數字）。最多 4 個頭像加「+k」；頭像 key `${wave}-${index}`，新一波時 `FadeInRight` 每人延遲 140 ms 依序入列，人數減少時淡出。頭像上下晃動 3 pt，相位依位置錯開，`animate = false` 時停止歸位。人數為 0 時保留 42 pt 高度，攤位底部對齊。
- `StallView`：排隊列放在外觀與老闆卡之間。
- 驗證：lint 0、tsc 0、jest 295 通過（新增 queue-test 8 個、stall-queue-test 5 個、stall-view-test 1 個）、iOS 打包成功。
- T6：使用者實機確認通過（2026-11-10）。

### File List

- `src/game/queue.ts`（修改）
- `src/game/__tests__/queue-test.ts`（修改）
- `src/features/street/stall-queue.tsx`（新增）
- `src/features/street/__tests__/stall-queue-test.tsx`（新增）
- `src/features/street/stall-view.tsx`（修改）
- `src/features/street/__tests__/stall-view-test.tsx`（修改）

## Change Log

- 2026-11-10：夜市街的排隊頭像；狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 b16292b..7ae4012）

- [x] [Review][Patch] 「其他攤位改變時 StallView 不重繪」的隔離測試被拿掉，沒有替代的重繪次數測試；補一個人龍不受影響的情境（例如冷卻中升級其他攤） [src/features/street/__tests__/stall-view-test.tsx]
