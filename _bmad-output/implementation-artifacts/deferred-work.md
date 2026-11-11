# Deferred Work

## Deferred from: code review of 5-3-card-shows-and-signature-stars (2026-11-11)

- 美術腳本 `art-source/scripts/process-e5-art.py` 先把卡面與卡框寫進 `assets/images/cards/`，之後才執行 `check_inset`；檢查失敗時，壞掉的素材已經蓋掉原檔。下次換卡框前，先在記憶體裡檢查，通過後再寫檔。
- 匯入存檔（`save-transfer.ts`，從除錯面板觸發）沒有呼叫 `useOverlayStore.reset()`，和 overlay-store 的註解不一致；這是 E5 之前就有的問題。
