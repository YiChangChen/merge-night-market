## Architecture Validation

### Validation Summary

| 檢查 | 結果 | 說明 |
|---|---|---|
| 決策相容性 | PASS | 引擎、狀態、存檔、導覽、服務之間沒有衝突。AdMob 17 要求 RN ≥ 0.86 且使用 New Architecture，本專案符合；iOS 16.4 下限已同步回 GDD |
| GDD 涵蓋度 | PASS | M1–M7 和技術規格都有對應的架構支援。驗證時發現 9 處規則有歧義，已補成 RC-1 到 RC-9 |
| 模式完整度 | PASS | 6 類標準模式加上 4 個新模式（NP-1 到 NP-4），每一個都附範例 |
| Epic 對應 | PASS | E1 到 E7 都有對應的程式位置與模式 |
| 文件完整度 | PASS | 沒有遺留占位符。唯一刻意延後的是 #4 夜市街渲染，已附決策閘門與理由 |

### Coverage Report

**系統涵蓋：** 14/14（Project Context 的核心系統表）
**模式：** 標準 6 類、新模式 4 個、一致性規則 12 條
**決策：** 14 項決策、5 條 ADR、9 條規則澄清，另有 1 項刻意延後（#4，由閘門決定）

**GDD 對應**

| GDD | 架構支援 |
|---|---|
| M1 棋盤合成 | `engine.ts`（既有）、NP-1、RC-1、RC-4 |
| M2 夜市街與攤位 | `stalls.ts`、`features/street/`、RC-1、RC-2、RC-3、RC-7 |
| M3 排隊人龍 | `queue.ts`、NP-2、`features/queue-meter/` |
| M4 發明菜 | `invention.ts`、`drop.ts`、NP-1、RC-6、RC-8 |
| M5 貴客、線索、阿嬤 | `vip.ts`、NP-3、RC-9 |
| M6 卡牌 | `cards.ts`、`features/collection/`、ADR-05 |
| M7 開幕週、激勵廣告 | `daily.ts`、NP-4、`services/ads.ts`、`services/consent.ts` |
| 60 FPS、冷啟動 ≤ 3 秒、切換 ≤ 300 ms | #4 決策閘門、分段預載、freezeOnBlur、量測方法（見下方） |
| 存檔 v2 遷移成功率 100% | Data Persistence、`migration-test.ts` 搭配 4 份以上 fixture |
| crash-free ≥ 99.5% | Sentry release health |
| 離線可玩 | 啟動不等網路、服務降級、OTA 不阻塞 |
| 埋點事件 | GameEvent 直接轉送 PostHog（事件名稱一致） |

**Epic 對應**

| Epic | 主要位置 | 模式與決策 |
|---|---|---|
| E1 夜市街與攤位 | `game/stalls.ts`、`game/save/`、`features/street/`、`(tabs)/` | #4 閘門、Navigation、Data Persistence、RC-1 到 RC-3 |
| E2 排隊人龍 | `game/queue.ts`、`features/queue-meter/`、`features/overlays/` | NP-2、GameEvent |
| E3 跨鏈發明 | `game/drop.ts`、`game/invention.ts` | NP-1、RC-4、RC-6、RC-7、RC-8 |
| E4 貴客與線索 | `game/vip.ts`、`features/orders/` | NP-3、RC-9 |
| E5 卡牌 | `game/cards.ts`、`features/collection/`、`collection.tsx` | ADR-05 |
| E6 新手與廣告 | `game/daily.ts`、`services/ads.ts`、`services/consent.ts`、`features/tutorial/` | NP-4、Rewarded Ads |
| E7 上架準備 | `services/telemetry.ts`、`services/audio.ts`、`services/crash.ts`、`eas.json` | Analytics、Audio、量測方法 |

### Performance Measurement Method

（承接 Cross-cutting 的交接事項）

| 指標 | 工具 | 條件 | 門檻 |
|---|---|---|---|
| FPS（拖曳、夜市街捲動與演出） | Flashlight（Android），量測 UI 與 JS thread 的 FPS | Pixel 6a、**release build**、腳本化操作 30 秒、量 3 次取中位數 | 平均 ≥ 58 FPS，掉幀的幀數 ≤ 5% |
| 冷啟動 | `adb shell am start -W`，取 TotalTime | 殺掉程序後啟動，量 5 次取中位數 | ≤ 3,000 ms |
| 分頁切換 | 開發版的效能標記（點擊到首幀 `onLayout`），只在 preview profile 輸出 | 來回切換 10 次取中位數 | ≤ 300 ms |
| 記憶體 | `adb shell dumpsys meminfo` | 夜市街全開之後 | 在 spike 中建立基準，之後不超過基準 +20% |

- 時間點：W1–2 的 spike 建立基準；**每個 Epic 結束時**重量一次，結果寫在該 Epic 的 retro。
- iOS 只在送審前，用 Xcode Instruments（Time Profiler、Core Animation FPS）抽查一次。

### W1 Bootstrap Checklist

這份清單彙整各節散落的待辦，W1 的第一個 story 就照這份清單執行：

- [ ] `app.json` 改寫為 `app.config.ts`；設定 `extra`（ad unit ID、PostHog key、Sentry DSN、`debugTools`）與 `runtimeVersion: { policy: "fingerprint" }`
- [ ] `npx expo install expo-build-properties`，設定 `android.minSdkVersion: 26`
- [ ] `npx eas-cli@latest build:configure`，建立 development / preview / production 三個 profile
- [ ] `npx expo install --fix`（`jest-expo` 升到 ~58.0.14）
- [ ] 搬檔：`components/*` 搬到 `features/*`；`content.ts` 拆成 `game/content/*`；`random.ts` 從 `engine.ts` 拆出。只改路徑，跑過既有測試
- [ ] 把 `assets/images/` 根層的原始稿搬到 `art-source/`
- [ ] ESLint 加上分層規則：`no-restricted-imports`、`no-restricted-syntax`（`src/game/**` 禁用 `Date.now` 與 `Math.random`）、`no-console`
- [ ] 安裝 `zustand` 5.1，建立 `store.ts`，`useGame` 改成包在 store 外面的薄層
- [ ] 原生套件前置關卡：`react-native-google-mobile-ads`、`@sentry/react-native`、`expo-audio`、候選特效套件，逐一確認 New Architecture 支援與 `expo-doctor` 通過
- [ ] **Spike A**：夜市街效能閘門（#4）
- [ ] **Spike B**：AdMob 激勵廣告，在雙平台以開發版建置播放測試廣告，並走完 UMP 與 ATT 流程

### Issues Resolved

1. 「引擎與框架」一節的待決事項 1–10 改成狀態表，只有 #4 刻意延後，並附上決策閘門。
2. 補上 Executive Summary。
3. 補上 RC-1、RC-2：產生器改由攤位控制，訂單只從已重開的攤位產生（GDD E1-2）。
4. 補上 RC-4、RC-5：`movePiece` 與 `applyDrop` 的關係，以及既有函式要補發的事件。
5. 刪除沒有出處的 `HapticsService` 訂閱者。
6. 依使用者決定補上 RC-3（訂單金幣在建立時鎖定）、RC-6（發明菜一次賣 1 份）、RC-7（玩家自選招牌菜）。
7. 補上 RC-8、RC-9：發明菜的消耗規則，以及「請客人先走」。
8. 定下效能量測方法（承接 Cross-cutting），並彙整出 W1 Bootstrap Checklist。

### Validation Date

2026-11-08
