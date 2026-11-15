# 合成夜市

以台灣夜市為題材的合成經營遊戲，使用 Expo（React Native）開發。設計與里程碑見 [docs/DESIGN.md](docs/DESIGN.md)。

## 開發

```bash
npm install
npx expo start      # 用 iPhone 的 Expo Go 掃 QR code 執行
```

## 檢查

```bash
npm test
npm run typecheck
npm run lint
```

## 數據埋點（PostHog）

App 用 PostHog 匿名收集遊戲事件（Story 7.3）。在 `.env.local` 設定 `POSTHOG_KEY`（只接受 `phc_` 開頭的 Project API Key），資料區域預設 US，可用 `POSTHOG_HOST` 改。沒設定 key 時不送任何資料。

- 每個事件都附 `env`（`development`／`preview`／`production`）和 `days_since_first_launch`。開發與測試的資料也會送進同一個專案，看指標時請在報表加篩選 `env = production`。
- 高頻的 `item_merged`（合成）不送。
- PostHog 專案設定要開啟「Discard client IP data」，不保留玩家 IP。

報表（需登入 PostHog 專案才能看）：

- [留存（D1／D7／D30，以 `app_open` 計算）](https://us.posthog.com/project/730825/insights/XPGLAEU0)
- [新手漏斗（`tutorial_step` → `stall_upgraded` → `dish_invented`，3 天內）](https://us.posthog.com/project/730825/insights/QeWMHu43)
