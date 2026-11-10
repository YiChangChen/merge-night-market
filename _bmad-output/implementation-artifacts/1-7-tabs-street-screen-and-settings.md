---
baseline_commit: b040665
---

# Story 1.7: 底部分頁、夜市街與設定畫面

Status: done

## Story

As a 玩家,
I want 從底部分頁切到夜市街，左右滑動看 5 個攤位目前的樣子,
So that 我隨時看得到夜市被我點亮到什麼程度。

## Acceptance Criteria

1. 路由結構為 `(tabs)/_layout.tsx`（自訂 tab bar、`freezeOnBlur: true`），`(tabs)/index.tsx` 是棋盤，`(tabs)/street.tsx` 是夜市街（FR41）。
2. 切換時間 ≤ 300 ms（依量測方法），兩頁常駐；回到棋盤時，拖曳的狀態與手感不變。
3. 夜市街是橫向捲動的街道，5 個 `StallView` 依 S1.3 選定的渲染方案實作；每攤依等級顯示外觀（鐵捲門／Lv1／Lv2／Lv3）與對應段數的霓虹（FR14）。
4. 色調是深藍天空、暖黃燈泡串、高飽和霓虹（UX-DR10）；還沒有正式美術的地方用占位圖，並標註 `// TODO(content): art-manifest#<列>`。
5. 攤位顯示老闆頭像與名字，資料來自 `content/stalls.ts`，文字依 `docs/content.md` 的定稿（FR16）。
6. 夜市街左上角有設定入口（≥ 44 pt），和右上角的收藏冊入口對稱；點下去開啟 `src/app/settings.tsx`（presentation: modal），這個 story 只顯示版本號。
7. 夜市街失焦時，循環動畫暫停（`useIsFocused`）。
8. 每個 `StallView` 只用 selector 訂閱自己的攤位；拖曳棋子時夜市街不會重繪。
9. tab bar 與所有可點擊目標 ≥ 44 pt（UX-DR1、NFR8）。

## Tasks / Subtasks

- [x] T1 確認 SDK 58 的 Expo Router API（Tabs、tab bar props、`useIsFocused`、`useFocusEffect`）
- [x] T2 `content/stalls.ts`：5 攤的名稱、老闆、人設、占位色（AC5）
- [x] T3 `features/street/`：`StreetScreen`、`StallView`、`NeonSign`、`StringLights`（AC3、AC4、AC7、AC8）
- [x] T4 `features/tabs/`：自訂 `TabBar` 與分頁切換計時（AC1、AC2、AC9）
- [x] T5 路由：`(tabs)/_layout.tsx`、`(tabs)/street.tsx`，棋盤搬到 `(tabs)/index.tsx`；`settings.tsx` modal 與 `features/settings/`（AC1、AC6）
- [x] T6 移除 Spike A 原型、路由與棋盤上的入口（S1.3 AC6）
- [x] T7 測試：StallView（外觀、霓虹、老闆、重繪隔離）、分頁與設定的路由整合、攤位文字與定稿同步
- [x] T8 驗證：lint、tsc、jest、iOS／Android 打包
- [x] T9 **（使用者）** 實機檢查畫面（分頁切換的量化數字延後，見 Completion Notes）

## Dev Agent Record

### Implementation Plan

- **分頁**：
  - 用 `expo-router/js-tabs` 的 `Tabs`，因為 `expo-router` 匯出的 `Tabs` 已經棄用。
  - 設定 `lazy: false`（開機就掛載兩頁，第一次切換不用等夜市街渲染）和 `freezeOnBlur: true`（背景分頁凍結，不參與重繪）。
- **自訂 tab bar**：
  - Expo Router 58 內建的介面是 `state`、`emitter`、`navigateToTab(routeKey)`、`insets`，和原版 React Navigation 不同，沒有 `navigation` 物件。
  - 按下分頁時先 `emitter.emit('tabPress')`，再呼叫 `navigateToTab`。
- **夜市街**：
  - `StreetScreen` 不訂閱 store，只用 `useIsFocused` 控制動畫。
  - `StallView` 用 `memo` 包起來，只訂閱 `stalls[chain].level`。
  - 霓虹：每段用 Reanimated 做閃爍；亮的段數等於等級；失焦時停在全亮。
  - 燈泡串用一個共用的 phase shared value 帶動 16 顆燈泡。
- **棋盤**：版面高度改扣掉 `useBottomTabBarHeight()`；`SafeAreaView` 的 `edges` 改成上、左、右，底部的安全區交給 tab bar 處理。
- **分頁切換計時**：
  - 按下時記錄時間，目標分頁在 `useFocusEffect` 之後的下一幀算出耗時。
  - 結果顯示在設定畫面，只有除錯工具開啟時才看得到。這是熱路徑，所以不寫 log。
- **Spike A**：依 S1.3 AC6 移除原型、`/spike-street` 路由，以及棋盤上的入口。Android 複驗改成直接量正式畫面。

### Debug Log

- 一開始照原版 React Navigation 的寫法，用 `navigation.navigate`，結果 tsc 報錯。改看 Expo Router 58 內建的 `BottomTabBar` 原始碼，改用 `emitter` 加上 `navigateToTab`。
- RN 0.88 已經沒有 `StyleSheet.absoluteFillObject`，改用 `absoluteFill`。
- **Reanimated 4.7 在 Jest 裡的設定問題**：
  1. Worklets 原生模組不存在，所以 mock 掉 `react-native-worklets`。
  2. jest-expo 以 iOS 平台解析，會載入 `initializers.native`，它呼叫的 `setCSSEventHandler` 在 JSReanimated 裡不存在。所以把 initializers 的 4 個路徑都換成空函式；`jest.mock` 的 factory 必須寫成行內函式。
  3. 原生版的 `makeMutable` 搭配 Worklets mock 沒有 `get`／`set`，所以改用 `react-native-reanimated/mock`。這個 mock 需要先完成第 2 步才載得起來。
- RNTL 14 的 `act` 是非同步的，要 `await` 才會把狀態更新刷到畫面上。
- 用腳本做多行替換時，有兩次因為 CRLF 換行沒有比對到，最後改用 Edit 工具完成。
- **反向驗證**：把 `StallView` 改成訂閱整個 state，重繪隔離的測試就失敗；還原後通過。

### Completion Notes

- AC1：`(tabs)/_layout.tsx` 使用自訂 `TabBar`、`freezeOnBlur: true`；棋盤用 `git mv` 搬到 `(tabs)/index.tsx`，夜市街在 `(tabs)/street.tsx`。
- AC2：兩頁常駐（`lazy: false` 加上 `freezeOnBlur`）。`board.tsx` 沒有修改，拖曳手感不受影響。**切換時間還沒有實測**：計時已經接好，開啟除錯工具後，設定畫面會顯示中位數，要在實機上量測（T9）。
- AC3、AC4：
  - 夜市街是橫向的 `ScrollView`，放 5 個 `StallView`，用純 RN 加 Reanimated。
  - 外觀依等級顯示：鐵捲門、Lv1 小攤、Lv2 店面、Lv3 大店。
  - 霓虹亮起的段數等於等級。
  - 色調：深藍夜空 `#0B1638`、暖黃燈泡串 `#FFD166`、各攤的高飽和霓虹色。
  - 用了占位的地方都標註了 `TODO(content): art-manifest#…`：攤位外觀是 #2-21、霓虹是 #22-26、老闆頭像是 #27-31。
- AC5：新增 `content/stalls.ts`，`content-stalls-test` 檢查每一攤的名稱、老闆名字和人設，都出現在 `docs/content.md` 定稿表格的同一列。頭像先用名字最後一個字的圓形徽章代替。
- AC6：夜市街左上角放 ⚙️ 按鈕（44×44），開啟 `settings.tsx`（modal），顯示「版本 1.0.0」。右上角留了同尺寸的空位給收藏冊（E5），標題才會置中。
- AC7：`StreetScreen` 用 `useIsFocused`，失焦時霓虹和燈泡串停止循環。
- AC8：`StallView` 用 memo 加上 selector。Profiler 測試驗證：棋盤、金幣、其他攤位改變時，它都沒有重繪；只有自己的攤位改變時才重繪一次。
- AC9：tab 按鈕最小高度 48，設定、關閉按鈕都是 44×44。
- **測試**：新增 `stall-view-test`（6 個）、`tabs-navigation-test`（3 個）、`content-stalls-test`（5 個）；刪掉 spike 的 8 個測試。共 161 個通過。
- **驗證**：lint、tsc 通過；iOS（1766 個模組）和 Android（1761 個模組）都打包成功。
- **實機檢查（2026-11-10，iPhone 16、Expo Go）**：要用 `npx expo start --go --tunnel --no-dev --minify` 才載得起來，因為開發模式的 bundle 經過 tunnel 會逾時。棋盤、底部分頁、夜市街的設定入口和設定畫面都正常；夜市街可以左右滑動，使用者表示「蠻順暢」。這個模式下除錯工具關閉，所以**分頁切換時間沒有量化數字**，留到取得 preview 建置或 Android 複驗時再量。另外，設定畫面右上角的關閉鈕被 Expo Go 的浮動按鈕蓋住，正式版沒有這顆按鈕；iOS 上也可以下滑關閉 modal。
- **還沒做到的**：分頁切換的量化數字（見上一點）。另外，夜市街目前還不能點攤位，攤位面板要到 S1.9。

## File List

- src/app/(tabs)/_layout.tsx（新增）
- src/app/(tabs)/index.tsx（由 src/app/index.tsx 搬移並修改：tab bar 高度、移除 Spike A 入口、切換計時）
- src/app/(tabs)/street.tsx（新增）
- src/app/settings.tsx（新增）
- src/app/_layout.tsx（修改：Stack 加上 (tabs) 與 settings modal）
- src/app/spike-street.tsx（刪除）
- src/features/street/（重寫：stall-view.tsx、street-screen.tsx、neon-sign.tsx、string-lights.tsx、index.ts；刪除 __spike__/）
- src/features/street/__tests__/stall-view-test.tsx（新增）
- src/features/tabs/（新增：tab-bar.tsx、tab-timing.ts、index.ts、__tests__/tabs-navigation-test.tsx）
- src/features/settings/（新增：settings-screen.tsx、index.ts）
- src/game/content/stalls.ts（新增）、index.ts（修改）
- src/game/__tests__/content-stalls-test.ts（新增）
- src/services/config.ts（修改：appVersion）
- jest.setup.js（修改：Reanimated／Worklets 的 Jest 設定）
- _bmad-output/game-architecture.md（修改：Tabs 實作說明、Spike A 原型移除）
- _bmad-output/project-context.md（修改：Reanimated 測試設定、absoluteFill）
- _bmad-output/deferred-work.md（修改：Android 複驗改量正式畫面）
- _bmad-output/implementation-artifacts/1-7-tabs-street-screen-and-settings.md（新增）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改）

## Change Log

- 2026-11-10（S1.10 實機檢查時發現）：棋盤畫面的訂單列高度塌成 0，客人圖被資訊列蓋住（S1.7 的實機截圖其實已經出現這個問題，但當時沒有注意到）。原因推測是訂單卡 `order` 設了 `flex: 1`，而外層格子沒有固定高度，在版面引擎裡會被算成 0。修正：移除這個 `flex: 1`，並把訂單列的高度明確設為「客人圖 + 標籤」，和計算棋盤大小時預留的空間一致。

- 2026-11-09：完成 Story 1.7：底部分頁、夜市街、設定畫面，移除 Spike A 原型。等待實機檢查與分頁切換實測（T9），狀態改為 review。

### Review Findings（code review 2026-11-10，範圍 194119f..main）

- [x] [Review][Patch] 自訂 `TabBar` 沒有透過 `BottomTabBarHeightCallbackContext` 回報實際高度，`useBottomTabBarHeight()` 拿到的是估計值（49 + 安全區），棋盤最下面一列會被 tab bar 蓋住 6–14 px [src/features/tabs/tab-bar.tsx]
- [x] [Review][Patch] 棋盤背景 `night-market-background-direct.jpg` 在路由檔裡 require，違反「素材只能在 content/*.ts 裡 require」（這是既有寫法，S1.7 搬檔時沿用下來）[src/app/(tabs)/index.tsx]
- [x] [Review][Defer] `freezeOnBlur` 讓失焦的夜市街凍結之後，`useIsFocused` 觸發的重繪可能不會被提交，霓虹的 `withRepeat` 迴圈也許還在 UI 執行緒上跑 [src/features/street/street-screen.tsx] — deferred, 只是理論上可能，沒辦法在測試裡驗證；S1.3 量測時這些動畫全部在畫面上，也維持 60 FPS。Android 複驗時要一起量測「夜市街在背景時，棋盤拖曳的 FPS」
