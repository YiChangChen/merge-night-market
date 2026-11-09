---
baseline_commit: e4be9f69dc90cda4a2eaf16a1cb3acfb69586a99
---

# Story 1.2a: 分層搬檔（只改路徑）

Status: done

## Story

As a 開發者,
I want 既有程式碼搬到分層目錄,
So that 新功能有固定的落點，而且這一步只改路徑，容易 review。

## Acceptance Criteria

1. `board.tsx` 搬到 `src/features/board/`；`customer-tray.tsx` 搬到 `src/features/orders/`；`content.ts` 拆成 `src/game/content/{chains,customers,balance,index}.ts`；mulberry32 拆到 `src/game/random.ts`。
2. `assets/images/` 根層的原始稿與草稿搬到 `art-source/`，App 照常啟動，素材正常顯示。
3. 遊戲行為完全不變，既有的 `engine-test.ts` 全部通過，只改 import 路徑。
4. 這個 story 的 diff 只包含檔案搬移與 import 路徑的修改。

## Tasks / Subtasks

- [x] T1 畫面元件搬到 features（AC1）
  - [x] `git mv src/components/board.tsx src/features/board/board.tsx`
  - [x] `git mv src/components/customer-tray.tsx src/features/orders/customer-tray.tsx`
  - [x] 新增 `src/features/board/index.ts`、`src/features/orders/index.ts`，只做 re-export（跨 feature 只能經由 index.ts）
  - [x] `src/app/index.tsx` 的 import 改成 `@/features/board`、`@/features/orders`
- [x] T2 拆分 content（AC1）
  - [x] `chains.ts`：ChainId、ItemDef、ChainDef、CHAINS、CHAIN_IDS
  - [x] `customers.ts`：CustomerDef、CUSTOMERS
  - [x] `balance.ts`：BALANCE、BOARD_SIZE
  - [x] `index.ts`：re-export 全部；既有的 `@/game/content`、`./content`、`../content` import 不必修改
  - [x] 素材 `require` 路徑多一層 `../`
- [x] T3 mulberry32 拆到 `random.ts`（AC1）
  - [x] `nextRandom`、`randomInt` 搬過去，型別改成泛型 `S extends { rngSeed: number }`，演算法逐字不變
- [x] T4 原始稿搬到 `art-source/`（AC2）：23 個沒被引用的根層圖片；app 圖示、splash、`night-market-background-direct.jpg` 留在原處
- [x] T5 驗證（AC3、AC4）：lint、tsc、jest；`expo export` 能打包；diff 檢查只有搬移與路徑

## Dev Notes

- 這是純搬移的 story。不得順便改寫邏輯、命名或格式；`git mv` 保留歷史。
- 不得重構 board.tsx 的拖曳手勢（e4be9f6）。
- 架構依據：`game-architecture.md`〈Directory Structure〉、〈Content Data〉；`project-context.md` 的 Code Organization Rules。
- `use-game.ts` 留在 `src/game/`，由 S1.2b 處理。

## Dev Agent Record

### Implementation Plan

- 元件和原始稿用 `git mv` 搬移，保留歷史。
- `content.ts` 先用 `git mv` 改名成 `content/chains.ts`，再用腳本逐行切出 customers、balance，文字原封不動，只把素材的 `require` 多加一層 `../`。
- `content/index.ts` 用 `export *` 重新匯出，所以 `@/game/content`、`./content`、`../content` 這些既有 import 都不必修改。
- `random.ts` 的兩個函式逐字搬過去，只把參數型別從 `GameState` 改成泛型 `S extends { rngSeed: number }`，回傳型別仍然是呼叫端的 state 型別，演算法完全沒變。

### Debug Log

- 原始稿實際是 24 個檔案；Task T4 寫的 23 是計數錯誤。根層的 `dumpling.png`、`fried.png`、`noodle.png`、`sweet.png` 原本看起來有被引用，實際命中的是 `generators/` 底下的同名檔案。用 `images/<名稱>.png` 精確搜尋，確認沒有任何引用。
- 為了檢查 rename 偵測，執行了 `git add -A src art-source assets`，所以這次的變更都已經 staged，但沒有 commit。
- `diff` 顯示 board.tsx 和 customer-tray.tsx 與 HEAD 不同，但 git 判定為 R100，差異只在工作目錄的 CRLF 換行。

### Completion Notes

- AC1：
  - `src/features/board/board.tsx` 和 `src/features/orders/customer-tray.tsx` 都是 R100，內容沒有任何修改。
  - 兩個 feature 各有 `index.ts` 做重新匯出；`src/app/index.tsx` 只改了兩行 import。
  - `content.ts` 拆成 `content/{chains,customers,balance,index}.ts`。
  - mulberry32 搬到 `src/game/random.ts`。
- AC2：24 個沒有被引用的原始稿和草稿搬到 `art-source/`。app 圖示、splash、favicon 和正在使用的 `night-market-background-direct.jpg` 留在原處。
- AC3：`engine-test.ts` 的 43 個測試全部通過，測試檔沒有修改。用 `npx expo export --platform android` 實際打包成功（1726 個模組、76 個素材），所有素材的 `require` 都能解析，背景圖也有打包進去。
- AC4：src 的 diff 只有搬移、拆檔、import 路徑和 `random.ts` 的抽出。engine.ts 刪掉 17 行，加了 1 行 import。
- `npx expo lint`、`npx tsc --noEmit`、`npx jest` 全部通過。
- 沒有新增測試：這是純搬移的 story，行為由既有的 43 個測試保護，包括 RNG 的可重現性。

## File List

- src/app/index.tsx（修改：import 路徑）
- src/components/board.tsx → src/features/board/board.tsx（搬移）
- src/components/customer-tray.tsx → src/features/orders/customer-tray.tsx（搬移）
- src/features/board/index.ts（新增）
- src/features/orders/index.ts（新增）
- src/game/content.ts（刪除，拆成下列檔案）
- src/game/content/chains.ts（新增）
- src/game/content/customers.ts（新增）
- src/game/content/balance.ts（新增）
- src/game/content/index.ts（新增）
- src/game/random.ts（新增）
- src/game/engine.ts（修改：改從 random.ts import）
- assets/images/ 根層 24 個原始稿 → art-source/（搬移）
- _bmad-output/implementation-artifacts/1-2a-layered-file-relocation.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-09：完成 Story 1.2a：分層搬檔、content 拆分、random.ts 抽出、原始稿搬到 art-source。狀態改為 review。
