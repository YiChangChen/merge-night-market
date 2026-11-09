---
title: Sprint Change Proposal：實作準備度問題修正
date: 2026-11-09
trigger: implementation-readiness-report-2026-11-09.md（NEEDS WORK）
mode: Batch
scope: Moderate
status: approved
approvedBy: Admin
approvedAt: 2026-11-09
---

# Sprint Change Proposal：實作準備度問題修正

## 1. 問題摘要

**觸發來源：**`implementation-readiness-report-2026-11-09.md` 的結論是 **NEEDS WORK**，共列出 0 Critical、4 Major、12 Minor／Warning。目前還沒有任何 story 開工（`implementation-artifacts/` 是空的，也還沒有 sprint-status），所以這次的修正只動文件，不需要回退任何程式。

**問題類型：**需求理解落差，再加上規劃漏洞。沒有技術限制，也沒有方向調整。

**要處理的問題：**

| # | 嚴重度 | 問題 | 證據 |
|---|---|---|---|
| M1 | Major | S3.4 寫「沿用品項的長按賣出」，但長按賣出並不存在 | `src/app/index.tsx:162`：賣出方式是點選品項後按 InfoBar 的賣出按鈕 |
| M2 | Major | 每秒 tick 的條件沒有涵蓋線索單倒數，也沒有隨開幕週的 `maxEnergy` 調整 | S2.1 寫「只在體力未滿或冷卻中運作」；S4.2、S6.1 都沒有擴充這個條件 |
| M3 | Major | 54 張美術和內容文案（G1、G2）沒有 story 負責 | 各畫面 story 都允許用占位圖加 `TODO(content)`，但沒有 story 負責替換；GDD 把美術列為時程的關鍵路徑 |
| M4 | Major | S1.2 太大，7 件不相關的工作綁在同一個 story | S1.2 的 AC |
| m1 | Minor | S1.4 的 spike 按鈕說「S1.6 完成後移進除錯面板」，但 S1.6 的 AC 沒有寫這件事 | S1.4、S1.6 |
| m2 | Minor | 設定畫面沒有路由，除錯入口要做兩次 | 架構〈Navigation〉；S1.6、S7.2 |
| m3 | Minor | S6.4 要用的平衡表排在 W10（S7.5）才做 | S6.4、S7.5 |
| m4 | Minor | S1.5 一次定義完整的 v2 state，沒有註記理由 | S1.5 |
| m6 | Minor | S7.5 的「沒有卡死局面」不夠具體 | S7.5 |
| m7 | Minor | S7.7 的完成定義取決於外部審核 | S7.7 |
| m8 | Minor | 架構 Decision Summary #13 的 `resolveDrop` 簽名和 NP-1 不一致 | 架構第 213 行與第 706 行 |
| m9 | Minor | FR 對照表的 FR15 只標 E1；GDD 開發順序還寫 `(E4 ∥ E5)` | `epics.md` FR Coverage Map；`gdd.md` 第 336 行 |
| m10 | Minor | 時程風險：E1 在 W1–W3 塞了 10 個 story 和 2 個 spike | 報告的 Minor 10 |
| W1 | Warning | 沒有棋盤畫面的版面規格，直式單手的垂直空間沒有驗證過 | 報告〈UX Alignment〉 |

報告的 Minor 5（計量條音效延到 E7）可以接受，不做修改。

**使用者決策（2026-11-09）：**
1. 賣出方式**保留點選 + 賣出按鈕**，修改 GDD 來符合現有程式。
2. 美術和內容用**一個內容定稿 story，加上分批整合**：每個 Epic 的完成定義加上「本 Epic 範圍內的 `TODO(content)` 清零」。
3. **在 E1 建立設定畫面**（`settings.tsx` modal），入口放在夜市街左上角，和收藏冊對稱。
4. 審核模式：Batch。

## 2. 影響分析

### Epic 影響

| Epic | 影響 | 說明 |
|---|---|---|
| E1 | **重排並擴充** | 新增 S1.0；S1.2 拆成 1.2a／1.2b／1.2c；舊的 S1.6（除錯面板）移到夜市街之後，S1.6～S1.8 重新編號；夜市街 story 加入設定畫面；S1.6 產出期望金幣模擬；完成定義加上 E1 素材清零 |
| E2 | AC 修改 | S2.1 改用 `needsTick` 判斷要不要 tick；S2.4 完成定義不變（E2 沒有新的美術） |
| E3 | AC 修改 | S3.4 的賣出改為點選 + 按鈕；S3.5 完成定義加上 10 張發明菜圖示清零 |
| E4 | AC 修改 | S4.2 讓 `needsTick` 涵蓋線索單；S4.4 完成定義加上阿嬤立繪 |
| E5 | AC 修改 | S5.3 完成定義加上卡面 10 張與卡框 2 種 |
| E6 | AC 修改 | S6.1 讓 `needsTick` 改用 `maxEnergy`；S6.4 改用 S1.6 的模擬函式驗證 |
| E7 | AC 修改 | S7.2 只補音訊開關；S7.5 列出具體的卡死情境；S7.7 加上全域 `TODO(content)` 檢查，並改寫完成定義 |

沒有 Epic 被刪除或作廢，也不需要新增 Epic。Epic 之間的順序維持 E1 → E2 → … → E7。

### 文件衝突

| 文件 | 需要修改的地方 |
|---|---|
| `epics.md` | FR4、UX-DR12、FR Coverage Map，以及上表列出的 story |
| `game-architecture.md` | Decision Summary #13；〈Navigation〉與目錄結構加上 `settings.tsx`；〈Time & Day Rollover〉加上 `needsTick`；〈Debug Tools〉寫明入口位置 |
| `gdd.md` | 〈操作與輸入〉的賣出；開發順序；假設 #2、#7 的負責 story 與期限；〈依賴〉指向美術清單 |
| `project-context.md` | 不需要修改 |
| UX | 沒有 UX 文件。棋盤畫面的線框列為交接事項（見第 5 節） |

### 技術影響

- 不改任何既有程式，也不必回退任何 commit。
- 新增兩份非程式產出：`docs/content.md`（內容定稿）和 `docs/art-manifest.md`（美術清單與進度）。

## 3. 建議做法

**採用：Option 1 Direct Adjustment（直接修改文件）。**

| 選項 | 可行性 | 工作量 | 風險 | 理由 |
|---|---|---|---|---|
| 1. 直接調整 story | ✅ 可行 | Low（約半天） | Low | 所有問題都是文件層級，報告也建議用這種方式處理 |
| 2. 回退 | N/A | — | — | 還沒有 story 實作，沒有東西可以回退 |
| 3. 縮減 MVP | 暫不需要 | — | — | 範圍本身沒有問題；時程風險改用 E1 retro 檢查點控管 |

**時程影響：**E1 的 story 數從 10 變成 13。不過 S1.2 只是拆分，工作量不變；S1.0 是內容工作，可以和 S1.1～S1.5 同時進行。實際增加的工作是設定畫面（小）和期望金幣模擬（小），兩者都是從 E7 提前到 E1，總工作量不變。E1 本來就是時程最緊的 Epic，所以加上一個 retro 檢查點（見 E1 完成定義）。

## 4. 詳細修改提案

### 4.1 `epics.md`：需求清單

**修改 A1：FR4**

OLD：
> - FR4：長按品項可賣出，得到 baseCost(n) = 2^(n−1) 金幣。產生器不能賣出。

NEW：
> - FR4：點選品項後，按資訊列的「賣出」按鈕即可賣出，得到 baseCost(n) = 2^(n−1) 金幣。產生器不能賣出。

理由：使用者決策 1。現有程式就是這個做法，不會碰到 e4be9f6 調整過的拖曳手勢。

**修改 A2：UX-DR12**

OLD：
> - UX-DR12：只支援直式、單手操作；長按品項時出現「賣出」選項。

NEW：
> - UX-DR12：只支援直式、單手操作；點選品項時，資訊列顯示品項名稱、下一階，以及「賣出」按鈕（≥ 44 pt）。

**修改 A3：FR Coverage Map**

OLD：
> | FR14–FR16 | E1 | 外觀狀態、霓虹、攤位等級效果、老闆 |

NEW：
> | FR14、FR16 | E1 | 外觀狀態、霓虹、老闆（老闆內容由 S1.0 定稿） |
> | FR15 | E1／E2／E4 | 攤位等級效果：訂單金幣（S1.6、S1.10）、人龍長度（S2.1）、貴客率（S4.1） |

並在表格下方新增：
> 內容與美術：FR16、FR30、FR33 的文字由 S1.0 定稿；GDD〈素材需求〉的 54 張美術依 `docs/art-manifest.md` 分批交付，在 E1、E3、E4、E5 的完成定義中驗收，E7 的 S7.7 做全域檢查。

### 4.2 `epics.md`：Epic 1

**修改 B1：Epic 1 新的 story 順序**

| 新編號 | 原編號 | 標題 |
|---|---|---|
| 1.0 | 新增 | 內容定稿與美術清單 |
| 1.1 | 1.1 | 專案設定與規則護欄 |
| 1.2a | 1.2 拆分 | 分層搬檔（只改路徑） |
| 1.2b | 1.2 拆分 | Zustand store、apply 與 GameEvent |
| 1.2c | 1.2 拆分 | 日誌服務與 ErrorBoundary |
| 1.3 | 1.3 | Spike A：夜市街效能閘門 |
| 1.4 | 1.4 | Spike B：AdMob 測試激勵廣告 |
| 1.5 | 1.5 | 存檔 v2 與 v1 遷移 |
| 1.6 | 1.7 | 產生器與訂單改由攤位控制 |
| 1.7 | 1.8 | 底部分頁、夜市街與設定畫面 |
| 1.8 | 1.6 | 除錯面板與存檔匯入匯出 |
| 1.9 | 1.9 | 重開攤位 |
| 1.10 | 1.10 | 升級攤位到 Lv2 與招牌通電 |

理由：除錯面板的入口放在設定畫面，而設定畫面的入口在夜市街，所以除錯面板要排在夜市街之後。這樣入口只需要做一次（m2）。

**修改 B2：新增 Story 1.0**

NEW：
> ### Story 1.0: 內容定稿與美術清單
>
> As a 開發者（兼內容負責人）,
> I want 在夜市街畫面開工前，把老闆、配方、卡牌故事和線索台詞的文字定稿，並列出全部 54 張美術的清單,
> So that 美術製作有依據，每個 Epic 也都知道自己要交付哪些素材。
>
> **Acceptance Criteria:**
>
> **Given** GDD 假設 #2（配方名稱與組合）、#7（5 位老闆的名字與人設），以及 M4、M5、M6 的內容需求
> **When** 完成這個 story（不寫程式，可以和 S1.1～S1.5 同時進行；必須在 S1.7 開工前完成）
> **Then** `docs/content.md` 包含以下定稿內容：
> - 5 位老闆：名字、一句人設、頭像描述（FR16）
> - 10 道配方：名稱、材料與階數（沿用 GDD M4 表）、負責的老闆
> - 10 句線索台詞，其中至少 4 句是味道描述（FR30）
> - 10 段卡牌故事，每段 2–3 句（FR33）
> **And** `docs/art-manifest.md` 列出 GDD〈素材需求〉的全部 54 張美術，每一列包含：檔案路徑（依架構 Asset Management 的命名規則）、尺寸上限、交付批次、狀態（占位／草稿／定稿）。批次如下：
> - E1：夜市街背景 1、攤位外觀 20、霓虹招牌 5、老闆頭像 5
> - E3：發明菜圖示 10
> - E4：阿嬤立繪 1
> - E5：卡面 10、卡框 2
> **And** GDD 假設索引 #2、#7 改標為「已定稿（S1.0）」
> **And** 之後的 story 只要有 `TODO(content)`，就要對應到 `docs/content.md` 或 `docs/art-manifest.md` 的某一列

**修改 B3：拆分 Story 1.2**

OLD：Story 1.2「分層搬遷、store 薄殼與日誌」（一個 story，8 條 AC）。

NEW：

> ### Story 1.2a: 分層搬檔（只改路徑）
>
> As a 開發者,
> I want 既有程式碼搬到分層目錄,
> So that 新功能有固定的落點，而且這一步只改路徑，容易 review。
>
> **Acceptance Criteria:**
>
> **Given** 既有的 `src/components/`、`src/game/content.ts`
> **When** 完成搬遷
> **Then** `board.tsx` 搬到 `src/features/board/`；`customer-tray.tsx` 搬到 `src/features/orders/`；`content.ts` 拆成 `src/game/content/{chains,customers,balance,index}.ts`；mulberry32 拆到 `src/game/random.ts`
> **And** `assets/images/` 根層的原始稿與草稿搬到 `art-source/`，App 照常啟動，素材正常顯示
> **And** 遊戲行為完全不變，既有的 `engine-test.ts` 全部通過，只改 import 路徑
> **And** 這個 story 的 diff 只包含檔案搬移與 import 路徑的修改
>
> ### Story 1.2b: Zustand store、apply 與 GameEvent
>
> As a 開發者,
> I want 由 Zustand store 持有遊戲狀態，並有一條事件匯流排,
> So that 兩個分頁都能用 selector 訂閱 state，演出、音效和埋點也有同一個事件來源。
>
> **Acceptance Criteria:**
>
> **Given** Story 1.2a 完成後的目錄結構
> **When** 加入 store
> **Then** `src/game/store.ts` 提供 `useGameStore` 與 `apply(action)`；`apply` 依序執行：`syncAll(state, now)` → action → 分派 `state.events` → 清空 events
> **And** `src/game/events.ts` 定義 `GameEvent` union，`gameEvents.subscribe` 可以訂閱
> **And** `use-game.ts` 改成 store 的薄包裝，`index.tsx` 改用 selector 訂閱，畫面行為不變
> **And** 拖曳的手感保持不變（不重構 e4be9f6 的拖曳實作）
>
> ### Story 1.2c: 日誌服務與 ErrorBoundary
>
> As a 開發者,
> I want 統一的 log 介面，以及根層的錯誤防護,
> So that 之後接 Sentry 時只要改一個地方，render 錯誤也不會讓 App 白屏。
>
> **Acceptance Criteria:**
>
> **Given** Story 1.2b 完成
> **When** 加入日誌與錯誤防護
> **Then** `src/services/log.ts` 提供 `log.debug/info/warn/error(scope, msg, data?)`，開發版輸出到 console；`use-game.ts` 裡原本的 `console.warn` 全部改用 `log`
> **And** 根層 `_layout.tsx` 包上 ErrorBoundary：render 錯誤時顯示「重新載入」按鈕，不讓 App 白屏
> **And** `npx expo lint`（含 `no-console` 規則）、`npx tsc --noEmit`、`npx jest` 全部通過

理由：M4。三個 story 分別是純搬檔、狀態管理、橫切服務，可以各自 review，其中一個卡住也不會擋到另外兩個。

**修改 B4：Story 1.3（只改引用的編號）**

OLD：
> **And** 原型程式碼放在 `src/features/street/__spike__/`，結論出來後刪除，或改寫成 Story 1.8 的起點

NEW：
> **And** 原型程式碼放在 `src/features/street/__spike__/`，結論出來後刪除，或改寫成 Story 1.7 的起點

**修改 B5：Story 1.4（只改引用的編號）**

OLD：
> **And** 一個只在 preview/development 出現的暫時 spike 按鈕（放在棋盤畫面，Story 1.6 完成後移進除錯面板）……

NEW：
> **And** 一個只在 preview/development 出現的暫時 spike 按鈕（放在棋盤畫面，Story 1.8 完成後移進除錯面板）……

**修改 B6：Story 1.5，新增一條 AC（m4）**

NEW（附加在最後）：
> **And** 在 `types.ts` 加上註解，說明這個取捨：v2 一次定義 E2～E6 才會用到的欄位，換來整個 MVP 只需要一次 v1→v2 遷移；新增的欄位在 MVP 期間只用空值或初始值

**修改 B7：Story 1.6（原 1.7）產生器與訂單，新增一條 AC（m3）**

NEW（附加在最後）：
> **And** 規則層提供純函式 `expectedOrderCoins(playerLevel, stalls)`，依 FR7、FR8 的公式算出每張訂單的期望金幣；`docs/balance.md` 列出 Lv1～Lv10、開局攤位狀態下的「各玩家等級每單期望金幣」表（由測試或腳本產生）。S6.4 用這張表驗證教學，S7.5 只做實測校正

**修改 B8：Story 1.7（原 1.8）改名為「底部分頁、夜市街與設定畫面」**

OLD 標題：
> ### Story 1.8: 底部分頁與夜市街畫面

NEW 標題：
> ### Story 1.7: 底部分頁、夜市街與設定畫面

OLD AC：
> **And** 色調是深藍天空、暖黃燈泡串、高飽和霓虹（UX-DR10）；缺正式美術的地方用占位圖，並標註 `// TODO(content)`
> **And** 攤位顯示老闆頭像與名字，資料來自 `content/stalls.ts`（FR16）

NEW AC：
> **And** 色調是深藍天空、暖黃燈泡串、高飽和霓虹（UX-DR10）；還沒有正式美術的地方用占位圖，並標註 `// TODO(content): art-manifest#<列>`
> **And** 攤位顯示老闆頭像與名字，資料來自 `content/stalls.ts`，文字依 `docs/content.md` 的定稿（FR16）

新增 AC：
> **And** 夜市街左上角有設定入口（≥ 44 pt），和右上角的收藏冊入口對稱；點下去開啟 `src/app/settings.tsx`（presentation: modal）。這個 story 的設定畫面只顯示版本號，音訊開關在 S7.2 加上

**修改 B9：Story 1.8（原 1.6）除錯面板**

OLD：
> **When** 長按棋盤畫面角落的版本號 2 秒（設定畫面在 Story 7.2 才會出現，到時候再把入口移過去）

NEW：
> **When** 在設定畫面（Story 1.7）長按版本號 2 秒

新增 AC（m1）：
> **And** Story 1.4 放在棋盤畫面上的 Spike B 暫時按鈕移進除錯面板，棋盤畫面上不再有任何 spike 按鈕

**修改 B10：Story 1.10，Epic 1 完成定義（M3、m10）**

OLD：
> **And** Epic 1 結束時，在 Pixel 6a release build 上量一次 NFR1–3，結果記入 retro

NEW：
> **And** Epic 1 結束時，在 Pixel 6a release build 上量一次 NFR1–3，結果記入 retro
> **And** `docs/art-manifest.md` 的 E1 批次（夜市街背景、攤位外觀 20、霓虹 5、老闆頭像 5）全部是「定稿」，而且程式碼中屬於 E1 範圍的 `TODO(content)` 清零
> **And** 時程檢查點：E1 retro 時如果已經超過 W3，啟動範圍調整評估（例如簡化 E5 的升星演出），由使用者決定

### 4.3 `epics.md`：Epic 2～7

**修改 C1：Story 2.1，tick 條件（M2）**

OLD：
> **And** store 的 1 秒 tick 只在「體力未滿」或「冷卻中」時運作；回到前景時立刻 `syncAll`

NEW：
> **And** 規則層提供純函式 `needsTick(state, now)`，store 的 1 秒 tick 只在它回傳 true 時運作。本 story 的條件是「體力 < 100」或「冷卻中」；之後的 story 會擴充條件（S4.2 線索單、S6.1 開幕週體力上限）。回到前景時立刻 `syncAll`
> **And** `queue-test.ts` 補上 `needsTick` 的測試：體力滿且人龍進行中時回傳 false

**修改 C2：Story 3.4，賣出發明菜（M1）**

OLD：
> **And** 長按發明菜選「賣出」（沿用品項的長按賣出，UX-DR12），每次只賣 1 份，得到 `dishSellPrice` 金幣；`count` 歸 0 時清空格子（FR24、RC-6）

NEW：
> **And** 點選發明菜後，資訊列顯示菜名、份數，以及「賣出 🪙{dishSellPrice}」按鈕（沿用品項的點選 + 賣出按鈕，`src/features/board/` 的 InfoBar，UX-DR12）；每按一次只賣 1 份；`count` 歸 0 時清空格子，並取消選取（FR24、RC-6）

**修改 C3：Story 3.5，Epic 3 完成定義（M3）**

OLD：
> **And** Epic 3 完成定義：10 道配方都能觸發；無效組合不會扣資源；可以完成一次 Lv3 升級。Epic 結束時量測 NFR1–3，結果記入 retro

NEW：
> **And** Epic 3 完成定義：10 道配方都能觸發；無效組合不會扣資源；可以完成一次 Lv3 升級；`art-manifest` 的 E3 批次（發明菜圖示 10 張）全部定稿，配方名稱改用 `docs/content.md` 的定稿，E3 範圍內的 `TODO(content)` 清零。Epic 結束時量測 NFR1–3，結果記入 retro

**修改 C4：Story 4.2，tick 擴充（M2）**

NEW（附加在 `syncOrders` 那一條 AC 後面）：
> **And** `needsTick` 擴充：存在 `kind: 'clue'` 的訂單時也回傳 true，讓線索單的倒數和到期移除在體力已滿時照常運作；`vip-test.ts` 補上「體力已滿、有線索單時 `needsTick` 為 true」

**修改 C5：Story 4.4，Epic 4 完成定義（M3）**

OLD：
> **And** Epic 4 完成定義：在只靠線索和提示、不看外部資料的情況下，可以發現所有已開放的配方

NEW：
> **And** Epic 4 完成定義：在只靠線索和提示、不看外部資料的情況下，可以發現所有已開放的配方；阿嬤立繪定稿；線索台詞改用 `docs/content.md` 的定稿，E4 範圍內的 `TODO(content)` 清零

**修改 C6：Story 5.3，Epic 5 完成定義（M3）**

OLD：
> **And** Epic 5 完成定義：10 張卡都能收集並升到 ★5，貴客單報酬正確反映加成。Epic 結束時量測 NFR1–3，結果記入 retro

NEW：
> **And** Epic 5 完成定義：10 張卡都能收集並升到 ★5，貴客單報酬正確反映加成；卡面 10 張與卡框 2 種定稿，卡牌故事改用 `docs/content.md` 的定稿，E5 範圍內的 `TODO(content)` 清零。Epic 結束時量測 NFR1–3，結果記入 retro

**修改 C7：Story 6.1，tick 條件（M2）**

NEW（附加在 `syncEnergy` 那一條 AC 後面）：
> **And** `needsTick` 的體力條件改成「體力 < `maxEnergy(state, now)`」；`daily-test.ts` 補上「開幕週內體力 150 時 `needsTick` 為 true」

**修改 C8：Story 6.4，教學的金幣驗證（m3）**

OLD：
> **And** 為了讓第 3 步一定能完成，在教學完成前，tea 或 fried 第一次升 Lv2 所需的金幣，必須能在前幾張訂單內存到（依 BALANCE 驗證；不夠的話調整新手訂單，並記錄下來）

NEW：
> **And** 為了讓第 3 步一定能完成，用 S1.6 的 `expectedOrderCoins` 驗證：新局在 8 張訂單以內就能存到 200 金幣。不夠的話調整新手訂單，並記錄在 `docs/balance.md`

**修改 C9：Story 7.2，設定畫面（m2）**

OLD：
> **And** 設定畫面可以分別開關「音樂」和「音效」……
> **And** 版本號和除錯面板入口從棋盤畫面角落移到設定畫面（長按版本號），並同步更新架構文件的 Debug Tools

NEW：
> **And** 在 Story 1.7 的設定畫面加上「音樂」和「音效」兩個開關，設定存在 `merge-night-market/settings`，不寫進遊戲存檔；重新啟動後設定不變

（刪除「版本號和除錯面板入口移到設定畫面」這一條，因為 S1.7、S1.8 已經完成。）

**修改 C10：Story 7.5，平衡與卡死情境（m3、m6）**

OLD：
> **Then** 先補上 GDD 設計師註記要求的「各玩家等級每單期望金幣」表，以規則層函式模擬產出，放進 `docs/balance.md`

NEW：
> **Then** 用封測數據校正 S1.6 產出的「各玩家等級每單期望金幣」表（`docs/balance.md`），記錄實測值與模擬值的差距

OLD：
> **And** 確認遊戲沒有失敗狀態，也沒有會卡死的局面，例如棋盤滿、沒體力、沒金幣同時發生時，仍然有出路（NFR12）

NEW：
> **And** 確認遊戲沒有失敗狀態（NFR12）。`deadlock-test.ts` 以規則層函式驗證下列情境都還有出路：
> - 棋盤 56 格全滿（含 5 個產生器）、體力 0、金幣 0：至少有一個品項可以賣出，或至少一張訂單可以出單
> - 棋盤全滿，而且沒有任何品項符合訂單：可以賣出品項來空出格子
> - 棋盤全滿，還有待放的產生器：賣出一格後產生器會被放上棋盤
> - 唯一的貴客單指定的發明菜不在棋盤上：其他兩張訂單照常可做，人龍仍然可以消化
> - 線索單占用貴客上限：可以用「請客人先走」移除

**修改 C11：Story 7.7，全域檢查與完成定義（M3、m7）**

新增 AC（放在 build 那一條之前）：
> **And** 送審前執行全域檢查：`src/` 內 `TODO(content)` 的數量為 0，`docs/art-manifest.md` 的 54 列全部是「定稿」

OLD：
> **And** Epic 7 完成定義：兩個平台都通過審核並上架

NEW：
> **And** Epic 7 完成定義：兩個平台都已送審。被退件時另開 story 處理，上架結果記入 retro

### 4.4 `game-architecture.md`

**修改 D1：Decision Summary #13（m8）**

OLD：
> | 13 ⚠️ | 拖放判定 | 純函式 `resolveDrop(source, target, state)` 回傳 `merge` / `invent` / `stack` / `reject` / `swap` 其中之一 | …

NEW：
> | 13 ⚠️ | 拖放判定 | 純函式 `resolveDrop(state, from, to)` 依序判定 `move` / `merge` / `stack` / `invent` / `reject` / `swap`，回傳第一個命中的結果（見 NP-1） | …

目錄結構的註解同步修改：
> `drop.ts  # resolveDrop：move/merge/stack/invent/reject/swap`

**修改 D2：〈Navigation & Screen Structure〉加上設定畫面（m2）**

OLD：
> ```
>   collection.tsx        收藏冊（presentation: 'modal'）
> ```

NEW：
> ```
>   collection.tsx        收藏冊（presentation: 'modal'），入口在夜市街右上角
>   settings.tsx          設定（presentation: 'modal'），入口在夜市街左上角；顯示版本號、音訊開關，長按版本號開啟除錯面板
> ```

目錄結構在 `src/app/` 加上 `settings.tsx  # 設定（modal）`，在 `src/features/` 加上 `settings/  # 設定畫面、音訊開關`。

**修改 D3：〈Debug Tools〉的啟用方式**

OLD：
> **啟用方式：** 長按設定畫面的版本號 2 秒。

NEW：
> **啟用方式：** 在設定畫面（`settings.tsx`，入口在夜市街左上角，E1 S1.7 建立）長按版本號 2 秒。

**修改 D4：〈Time & Day Rollover〉加上 tick 條件（M2）**

NEW（附加在 `syncAll` 那一條後面）：
> - `needsTick(state, now)`：store 的 1 秒 tick 只在它回傳 true 時運作。條件是：體力 < `maxEnergy(state, now)`、人龍冷卻中，或存在線索單。新增任何倒數計時，都必須同步擴充這個函式。

### 4.5 `gdd.md`

**修改 E1：〈操作與輸入〉**

OLD：
> | 賣出 | 長按品項 → 賣出 |

NEW：
> | 賣出 | 點選品項 → 資訊列的「賣出」按鈕 |

**修改 E2：〈開發 Epics〉的開發順序（m9）**

OLD：
> 開發順序依依賴關係排列：E1 → E2 → E3 → (E4 ∥ E5) → E6 → E7。

NEW：
> 開發順序依依賴關係排列：E1 → E2 → E3 → E4 → E5 → E6 → E7（一人開發，依序進行，見決策紀錄）。

**修改 E3：〈假設索引〉#2、#7**

OLD：
> 2. 10 道配方的名稱與組合是教練提案（M4）。
> 7. 5 位攤位老闆的名字與人設在美術製作前定稿（M2）。

NEW：
> 2. 10 道配方的名稱與組合是教練提案（M4）。由 E1 S1.0 定稿，寫在 `docs/content.md`，期限為 S1.7 開工前。
> 7. 5 位攤位老闆的名字與人設在美術製作前定稿（M2）。由 E1 S1.0 定稿，期限同上。

**修改 E4：〈依賴〉**

OLD：
> - 需要 AI 或外包產出 54 張新美術素材（含 5 張老闆頭像），是時程的關鍵路徑。

NEW：
> - 需要 AI 或外包產出 54 張新美術素材（含 5 張老闆頭像），是時程的關鍵路徑。清單、批次與進度記錄在 `docs/art-manifest.md`（S1.0 建立），在 E1／E3／E4／E5 的完成定義中驗收。

## 5. 實作交接

**變更範圍：Moderate。**不需要重新規劃，但 backlog 要重排（E1 新增、拆分、重新編號 story），而且三份規劃文件都要同步修改。

| 角色 | 負責事項 |
|---|---|
| Developer agent（或 PO） | 依第 4 節修改 `epics.md`、`game-architecture.md`、`gdd.md`。只改文件，不動程式 |
| Admin（內容負責人） | 執行 S1.0：定稿 `docs/content.md`，建立 `docs/art-manifest.md`，並開始產出 E1 批次的美術 |
| UX（`gds-ux` 精簡版） | 在 S2.2 開工前，畫出棋盤畫面與夜市街畫面的線框，確認 HUD、計量條、訂單列、資訊列和 56 格棋盤在直式單手下放得下（W1） |
| 下一步 | 文件修改完成後，執行 `gds-sprint-planning` 產生 sprint-status。S1.0、S1.1、S1.3、S1.4 可以先開工 |

**成功標準：**
1. `epics.md` 不再出現「長按」和舊編號的錯誤引用（S1.3→1.7、S1.4→1.8）。
2. `needsTick` 出現在 S2.1、S4.2、S6.1 和架構〈Time & Day Rollover〉，條件互相一致。
3. 每一張美術都對應到一個 Epic 的完成定義，E7 有全域檢查。
4. 架構文件中 `resolveDrop` 的簽名只有一種寫法。
5. 重跑 `gds-check-implementation-readiness` 時，沒有 Major 問題。
