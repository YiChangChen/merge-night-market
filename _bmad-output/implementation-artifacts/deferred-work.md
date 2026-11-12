# Deferred Work

## Deferred from: code review of 5-3-card-shows-and-signature-stars (2026-11-11)

- 美術腳本 `art-source/scripts/process-e5-art.py` 先把卡面與卡框寫進 `assets/images/cards/`，之後才執行 `check_inset`；檢查失敗時，壞掉的素材已經蓋掉原檔。下次換卡框前，先在記憶體裡檢查，通過後再寫檔。
- 匯入存檔（`save-transfer.ts`，從除錯面板觸發）沒有呼叫 `useOverlayStore.reset()`，和 overlay-store 的註解不一致；這是 E5 之前就有的問題。

## Deferred from: code review of Epic 6（6-1，2026-11-12）

- 時鐘曾調到未來時，`daily.dateKey` 會停在未來的日期，次數一直不歸零；反過來往前調一天又能重置次數。架構刻意規定「dateKey 變小視為未換日」，防作弊策略（例如伺服器時間）留到 E7 上架前評估。
- `meta.firstLaunchAt` 沒有上限：開局時裝置時間偏快或匯入未來的值時，開幕週會被延長。和上一項一起評估。
