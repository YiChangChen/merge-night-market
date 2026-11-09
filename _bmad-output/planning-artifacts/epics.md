---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
inputDocuments:
  - '_bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/gdd.md'
  - '_bmad-output/planning-artifacts/gdds/gdd-merge-night-market-2026-11-08/epics.md'
  - '_bmad-output/game-architecture.md'
  - '_bmad-output/project-context.md'
excludedDocuments:
  - 'docs/DESIGN.md（早期文件，已被 GDD 取代）'
---

# merge-night-market - Epic Breakdown

## Overview

本文件把 GDD 的需求和架構決策拆解成可以直接實作的 Epic 與 Story。專案沒有 UX 設計文件，GDD 裡寫到的介面需求整理在 UX-DR 一節。

## Requirements Inventory

### Functional Requirements

**M1 棋盤合成**
- FR1：棋盤為 7×8 共 56 格。點擊產生器會消耗 1 體力，在最近的空格產出該鏈的 1 階品項；有 15% 機率直接產出 2 階。
- FR2：同鏈同階的 2 個品項合成為該鏈的下一階 1 個品項；已達該鏈最高階的品項不能再合成。
- FR3：品項拖到空格就移動過去；其他無法合成的拖放（不屬於 FR21、FR22 的情況）就互換位置。
- FR4：點選品項後，按資訊列的「賣出」按鈕即可賣出，得到 baseCost(n) = 2^(n−1) 金幣。產生器不能賣出。
- FR5：體力上限 100，每 2 分鐘回復 1 點；獎勵給的體力可以超過上限。玩家升級時體力 +20。
- FR6：玩家升到下一級需要 XP = 10 + 5 × (等級 − 1)。
- FR7：同時有 3 張訂單。訂單只從已重開攤位的鏈產生，品項最高階數 = min(2 + ⌊玩家等級/2⌋, 該鏈長度)。玩家 Lv3 起，有 40% 機率出現兩品項訂單。
- FR8：一般訂單金幣 = 5 × 材料 baseCost 總和 × (1 + 0.1 × (攤位等級 − 1))，在訂單建立當下就鎖定。完成訂單還會給 XP，並回補體力（材料 baseCost 總和的 30%）。

**M2 夜市街與攤位**
- FR9：5 個攤位各對應一條鏈。手搖飲（tea）和炸物（fried）開局即為 Lv1；麵線、蒸籠、甜品一開始是鐵捲門狀態。
- FR10：重開攤位需要同時達到玩家等級門檻與金幣條件：麵線 Lv3 + 300、蒸籠 Lv5 + 600、甜品 Lv7 + 1000。重開時播放鐵捲門拉起的動畫，並把該攤的產生器放上棋盤（棋盤滿時放進待放佇列）。
- FR11：產生器不再隨玩家等級自動出現，只在攤位重開時才放上棋盤。
- FR12：Lv2 升級只需要金幣（200 / 200 / 400 / 600 / 900）。Lv3 升級需要金幣（600 / 600 / 1000 / 1500 / 2000），再加上 1 份含該鏈的發明菜，由玩家在面板上選擇要用哪一份。
- FR13：Lv3 升級所消耗的發明菜會成為該攤的招牌菜，顯示在招牌下方並附星等徽章。招牌菜固定、不可更換，也不影響人潮。
- FR14：攤位外觀有 4 種狀態：鐵捲門、Lv1、Lv2、Lv3。霓虹招牌依等級點亮 1/3、2/3、全亮，每次升級都播放通電演出。
- FR15：攤位每升 1 級，人龍長度 +2；該攤品項的訂單金幣 +10%；貴客出現率 +2%。
- FR16：每個攤位有一位固定老闆，包含名字、一句人設和頭像。

**M3 排隊人龍**
- FR17：人龍長度 = min(8 + 2 × 已開攤位等級總和, 20) + 額外人潮。額外人潮是保留的接口，MVP 固定為 0。開局長度為 12。
- FR18：每完成 1 張訂單（包含貴客單），人龍 −1。線索單不扣人龍。波次進行中升級或重開攤位時，本波人龍立刻加長。
- FR19：人龍消化完即「完售」，獎勵為金幣 5 × 本波長度、體力 +10、XP + 本波長度，並播放煙火、全部招牌閃爍和收銀音效。
- FR20：完售後冷卻 3 分鐘才出現下一波，畫面上顯示倒數。冷卻期間完成的訂單照常給基本獎勵，但不計入人龍。

**M4 發明菜**
- FR21：把鏈 A 的品項 X 拖到鏈 B 的品項 Y 上，如果 (X, Y) 符合配方，且兩攤都已達 Lv2 以上，就合成 1 份發明菜。拖曳方向不影響結果。
- FR22：如果兩個品項都是某道「兩攤皆已達 Lv2」配方的材料，但湊不成同一道配方，則不消耗任何東西：品項彈回原位，並播放搖頭動畫。
- FR23：發明菜佔 1 格，同一道菜最多疊 3 份；超過 3 份時，多出來的留在原格。發明菜不能再合成。MVP 不做背包。
- FR24：發明菜一次賣出 1 份，價格 = 兩個材料 baseCost 總和 × 1.5。
- FR25：第一次做出某道發明菜時，播放全螢幕「老闆發明！」演出，該菜加入收藏冊，並發放 ★1 卡牌。
- FR26：MVP 共 10 道配方，5 條鏈兩兩配對各 1 道，材料與階數依 GDD M4 表。

**M5 貴客、線索、阿嬤**
- FR27：發現第 1 道發明菜之後，每張新訂單有 20% + 2% × (Σ攤位等級 − 2) 的機率變成貴客單（上限 40%）。同時最多 1 張貴客單。
- FR28：貴客單指定 1 道已發現的發明菜。金幣 = 5 × 材料 baseCost 總和 × 兩攤等級加成的平均 × 3 × (1 + 星等加成)；XP = 材料階數總和 × 2。交付時消耗 1 份發明菜。
- FR29：如果還有未發現、且兩攤都已達 Lv2 的配方，貴客單有 50% 機率改為線索單。線索單不能完成，只顯示一句線索台詞，10 分鐘後離開，算在貴客上限內。訂單卡上有「請客人先走」按鈕。
- FR30：每道配方有 1 句線索台詞，其中部分改寫成味道描述。
- FR31：阿嬤保底：每次發生 FR22 的情況，所有「包含其中至少 1 個材料、尚未發現、且兩攤都已達 Lv2」的配方，失敗次數各 +1。某道配方累積到 5 次時，阿嬤直接說出兩個材料名稱，每道配方只提示一次。
- FR32：手搖飲與炸物兩攤都升到 Lv2、發明功能解鎖時，阿嬤直接說出配方 #1。

**M6 卡牌**
- FR33：每道發明菜對應 1 張卡，共 10 張。卡上有卡面、菜名、2–3 句故事和星等。
- FR34：每做出一份同款發明菜，製作次數 +1。星等門檻為 1 / 3 / 6 / 10 / 15 份，對應的貴客單金幣加成為 +0 / 10 / 20 / 35 / 50%；★5 時卡框換成金框。
- FR35：收藏冊入口在夜市街右上角。未發現的卡顯示剪影；拿到線索後才顯示線索台詞。頁面顯示收集進度 x/10。

**M7 新手與激勵廣告**
- FR36：首次啟動後 72 小時內，體力上限為 200，開局體力也是 200。
- FR37：體力不足時顯示「看廣告 +20 體力」，每日上限 5 次。
- FR38：完售時可選「看廣告獎勵加倍」，每日上限 3 次，每一波最多一次。
- FR39：廣告載入失敗、沒有庫存或離線時，隱藏廣告按鈕。不放插頁廣告，也不放橫幅廣告。
- FR40：首次啟動時，用手指引導動畫依序教 3 件事：合成、出餐、去夜市街升級。

**導覽與其他**
- FR41：底部有「棋盤」和「夜市街」兩個分頁。夜市街可以左右滑動，點攤位會開啟確認面板。
- FR42：棋盤頂端顯示人龍計量條「今晚客流 x/y」，每出一單就有一個頭像離隊、數字跳動；剩最後 3 人時閃爍，音效節奏加快。
- FR43：客人頭像依各攤的人龍比例，分配到各攤位前排隊。
- FR44：音效與背景音樂：約 12 個音效（合成音的音高隨階數遞增）、背景音樂 1–2 首、2–3 句叫賣語音，並提供靜音設定。
- FR45：數據埋點事件：攤位重開與升級、完售、發明成功與失敗、提示觸發、卡牌升星、廣告觀看，以及計算留存所需的事件。
- FR46：存檔從 v1 升到 v2 時必須遷移：攤位狀態依舊等級推算，已解鎖的鏈視為已重開的 Lv1，原有進度不能遺失。

### NonFunctional Requirements

- NFR1：在中階 Android（Pixel 6a 等級）的 release build 上，拖曳合成與夜市街都要維持 60 FPS。
- NFR2：冷啟動到可操作 ≤ 3 秒。
- NFR3：夜市街與棋盤互相切換 ≤ 300 ms。
- NFR4：crash-free sessions ≥ 99.5%。
- NFR5：存檔遷移成功率 100%，以 v1 存檔的自動化測試驗證。
- NFR6：沒有網路時遊戲仍可完整遊玩，只有廣告按鈕會隱藏。
- NFR7：平台為 iOS 16.4+ 與 Android 8+，只支援直式單手操作。
- NFR8：所有可點擊目標至少 44 pt。
- NFR9：存檔只存在本機，不做雲端與帳號。
- NFR10：不逼課金：付費與廣告只能用來換時間，不能換內容；不做隨機付費抽卡。
- NFR11：以 EAS 建置並送審 iOS 與 Android，商店素材需要隱私權政策與 ATT。
- NFR12：遊戲沒有失敗狀態，無效的操作不懲罰玩家。

### Additional Requirements

**基礎建設（Architecture：W1 Bootstrap Checklist，排進 Epic 1 的前幾個 story）**
- 本專案沒有 starter template，是在既有專案上擴充。Epic 1 Story 1 先處理基礎建設。
- 將 `app.json` 改寫為 `app.config.ts`，並設定 extra（ad unit ID、PostHog key、Sentry DSN、debugTools）與 `runtimeVersion: { policy: 'fingerprint' }`。
- 安裝 `expo-build-properties`，設定 `android.minSdkVersion: 26`。
- 執行 `eas build:configure`，建立 development、preview、production 三個 profile。
- 執行 `npx expo install --fix`，把 jest-expo 升到 ~58.0.14。
- 搬移檔案（只改路徑，行為不變）：`components/*` 搬到 `features/*`，`content.ts` 拆到 `game/content/*`，`random.ts` 從原檔拆出。原始稿搬到 `art-source/`。
- ESLint 加上三條規則：分層 `no-restricted-imports`；`src/game/**` 禁止 `Date.now` 與 `Math.random`；全專案 `no-console`。
- 安裝 Zustand 5.1，建立 `store.ts`（含 apply、syncAll、事件分派），並把 `useGame` 改寫成 store 的薄包裝。
- 原生套件前置關卡：New Architecture、相容 RN 0.88、通過 `expo-doctor`。

**技術驗證（Architecture：#4 決策閘門與廣告 spike）**
- Spike A：夜市街效能閘門。測試場景為 Pixel 6a 的 release build，5 攤加 20 個頭像，霓虹與鐵捲門同時播放；門檻為 60 FPS、切換 ≤ 300 ms、冷啟動 ≤ 3 秒。依序嘗試：純 RN → Skia → Lottie → 降級。結果回填到架構文件。
- Spike B：在兩個平台的開發版建置上播放 AdMob 測試激勵廣告，並走完 UMP 與 ATT 流程。

**資料與狀態**
- GameState v2 的形狀以架構文件為準（stalls、queue、inventions、meta、daily、lastSellout、events），衍生值一律不存檔。
- 存檔：單一 JSON 加遷移鏈。首次遷移前先備份 `save.v1.bak`；遷移失敗時不覆寫、也不開新局，改為顯示錯誤畫面。至少準備 4 份 v1 fixture。
- v1 玩家的開幕週視為已結束（`firstLaunchAt = now − 72h`）。
- 換日以 UTC+8 午夜為準；倒數計時一律存絕對時間戳；裝置時鐘倒退時不重置、不延長。

**模式（Architecture：NP 與 RC）**
- NP-1：拖放解析只在 `resolveDrop` 判定，依序為 move → merge → stack → invent → reject → swap，並以 `drop-test` 窮舉測試。
- NP-2：人龍波次狀態機與 `growActiveWave`。
- NP-3：阿嬤保底計數（`recordRejection`）。
- NP-4：廣告獎勵只能透過 `grantAdReward` 發放，且必須先收到 `EARNED_REWARD`。
- RC-1 至 RC-9：產生器由攤位控制、訂單只出自已開攤位、訂單金幣鎖定、`applyDrop` 取代 `movePiece`、既有函式補上事件、發明菜一次扣 1 份、招牌菜由玩家選擇、`dismissOrder`。

**橫切關注點與服務**
- GameEvent 事件匯流排。訂閱者為 FxController、AudioService、Telemetry。
- 服務介面包含 AdService、consent、audio、telemetry、crash、log、assets、settings、config，每個服務都提供 `.web.ts` 的 no-op 版本。
- 錯誤分層處理；根層加 ErrorBoundary。日誌一律透過 `log.ts`，正式版送到 Sentry breadcrumb。
- 導覽採 Expo Router Tabs（freezeOnBlur），收藏冊用 modal，根層放 Overlay Host。
- 素材分段預載，格式為 WebP，並設定尺寸上限。
- 除錯面板與存檔匯入匯出只在 dev 與 preview 版出現。
- 效能量測：每個 Epic 結束時，在 Pixel 6a 的 release build 上，用 Flashlight 和 `adb` 量測。

### UX Design Requirements

專案沒有正式的 UX 文件。以下是 GDD 中可以直接驗收的介面需求：

- UX-DR1：底部分頁導覽只有「棋盤」和「夜市街」兩個分頁，使用自訂 tab bar，可點擊目標至少 44 pt。
- UX-DR2：人龍計量條放在棋盤畫面頂端，格式為「今晚客流 x/y」。每出一單，就有一個客人頭像離隊的動畫，數字跟著跳動；剩下最後 3 人時，計量條閃爍，音效節奏加快。
- UX-DR3：攤位確認面板顯示重開或升級的條件（玩家等級、金幣、發明菜），條件不足時清楚標示缺少哪一項。Lv3 升級時列出棋盤上可用的發明菜供玩家選擇。
- UX-DR4：完售演出包含煙火、所有招牌閃爍和收銀機音效；同時提供「看廣告獎勵加倍」按鈕，只在可以觀看時出現。
- UX-DR5：「老闆發明！」全螢幕演出要包含發明菜、老闆頭像和卡牌 ★1。
- UX-DR6：無效的發明嘗試要有搖頭動畫，並讓品項彈回原位。
- UX-DR7：阿嬤提示用立繪加對話框，直接說出兩個材料的名稱。
- UX-DR8：收藏冊以網格呈現 10 張卡牌，分為剪影、線索、已發現三種狀態，並顯示星等；★5 的卡改用金框。入口放在夜市街右上角。
- UX-DR9：L4 以上的品項和發明菜要有冒熱氣的小動畫。
- UX-DR10：夜市街採夜晚色調：深藍天空、暖黃燈泡串、高飽和霓虹。
- UX-DR11：教學用手指引導動畫，依序帶玩家完成 3 個步驟。
- UX-DR12：只支援直式、單手操作；點選品項時，資訊列顯示品項名稱、下一階，以及「賣出」按鈕（≥ 44 pt）。

### FR Coverage Map

| FR | Epic | 說明 |
|---|---|---|
| FR1–FR6 | E1 | 既有的棋盤、體力、等級機制，搬檔後維持原行為 |
| FR7 | E1 | 訂單只從已開的攤位產生（RC-2） |
| FR8 | E1 | 訂單金幣含攤位加成，於建立時鎖定（RC-3） |
| FR9–FR11 | E1 | 攤位初始狀態、重開、產生器改由攤位控制（RC-1） |
| FR12 | E1（Lv2）／E3（Lv3） | 升級費用；Lv3 需要發明菜，由玩家選擇 |
| FR13 | E3 | 招牌菜 |
| FR14、FR16 | E1 | 外觀狀態、霓虹、老闆（老闆內容由 S1.0 定稿） |
| FR15 | E1／E2／E4 | 攤位等級效果：訂單金幣（S1.6、S1.10）、人龍長度（S2.1）、貴客率（S4.1） |
| FR17–FR20 | E2 | 人龍長度、扣減、完售、冷卻 |
| FR21–FR26 | E3 | 跨鏈發明、拒絕、疊加、賣出、首次發明、10 道配方 |
| FR27–FR32 | E4 | 貴客單、線索單、線索台詞、阿嬤保底、教學提示 |
| FR33–FR35 | E5 | 卡牌、升星、收藏冊 |
| FR36–FR40 | E6 | 開幕週、看廣告補體力、完售加倍、廣告降級、教學 |
| FR41 | E1 | 底部分頁、夜市街捲動、攤位面板 |
| FR42–FR43 | E2 | 人龍計量條、頭像分配到各攤 |
| FR44–FR45 | E7 | 音效與背景音樂、數據埋點 |
| FR46 | E1 | 存檔 v1→v2 遷移 |

內容與美術：FR16、FR30、FR33 的文字由 S1.0 定稿；GDD〈素材需求〉的 54 張美術依 `docs/art-manifest.md` 分批交付，在 E1、E3、E4、E5 的完成定義中驗收，E7 的 S7.7 做全域檢查。

NFR 對應：NFR1–NFR3 由 E1 的 Spike A 建立基準，之後每個 Epic 結束時重新量測，E7 做最終驗收；NFR5、NFR7–NFR9 → E1；NFR6、NFR10 → E6；NFR4、NFR11、NFR12 → E7。

## Epic List

依賴順序：E1 → E2 → E3 → E4 → E5 → E6 → E7。每個 Epic 只依賴前面的 Epic。

### Epic 1：夜市街開張
玩家可以切換到夜市街，看到 5 個攤位，用金幣重開麵線、蒸籠、甜品攤，把攤位升到 Lv2，招牌會依等級亮起，舊存檔的進度完整保留。這個 Epic 的前幾個 story 是基礎建設、Spike A（夜市街效能）和 Spike B（廣告）。
**FRs covered:** FR1–FR8、FR9–FR11、FR12（Lv2）、FR14–FR16、FR41、FR46
**NFRs:** NFR1–NFR3（建立基準）、NFR5、NFR7–NFR9

### Epic 2：排隊人龍與完售
玩家看著人龍一單一單消化，全部消化完就是完售，可以拿到大獎勵；冷卻結束後下一波人龍出現。攤位越強，人龍越長。
**FRs covered:** FR17–FR20、FR42、FR43

### Epic 3：老闆發明
玩家把兩個攤位的高階品項拖在一起，就能發明新菜；組錯不會受罰。第一次發明有全螢幕演出。發明菜可以用來把攤位升到 Lv3，成為該攤的招牌菜。
**FRs covered:** FR12（Lv3）、FR13、FR21–FR26

### Epic 4：貴客上門與阿嬤指點
貴客（富豪、藝人、YouTuber）會用高價點發明菜。線索客人會說出味道提示；同一道配方失敗 5 次後，阿嬤會直接說出答案。玩家不看攻略也能找到所有配方。
**FRs covered:** FR27–FR32

### Epic 5：發明菜收藏冊
玩家可以收集 10 張卡牌，讀到老闆的故事。同一道菜做得越多，星等越高，貴客單給的金幣也越多。★5 的卡牌是金框。
**FRs covered:** FR33–FR35

### Epic 6：開幕週與激勵廣告
新玩家前 3 天體力上限加倍，並有手指引導。體力不夠時可以看廣告補體力，完售時可以看廣告讓獎勵加倍。沒有網路時也能照常遊玩。
**FRs covered:** FR36–FR40
**NFRs:** NFR6、NFR10

### Epic 7：聲音、數據與上架
為夜市加上聲音，用數據校正平衡，通過效能驗收，然後在兩個平台上架。
**FRs covered:** FR44、FR45
**NFRs:** NFR1–NFR4（最終驗收）、NFR11、NFR12

## Epic 1: 夜市街開張

玩家可以切換到夜市街，看到 5 個攤位。用金幣重開麵線、蒸籠、甜品三個攤位，並把攤位升到 Lv2，招牌會依等級點亮。舊存檔的進度完整保留。

Story 順序：1.0 → 1.1 → 1.2a → 1.2b → 1.2c → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10。1.0 不寫程式，可以和 1.1～1.5 同時進行，但必須在 1.7 開工前完成。（2026-11-09 Sprint Change Proposal：新增 1.0、拆分 1.2、原 1.6 除錯面板移到夜市街之後並重新編號。）

### Story 1.0: 內容定稿與美術清單

As a 開發者（兼內容負責人）,
I want 在夜市街畫面開工前，把老闆、配方、卡牌故事和線索台詞的文字定稿，並列出全部 54 張美術的清單,
So that 美術製作有依據，每個 Epic 也都知道自己要交付哪些素材。

**Acceptance Criteria:**

**Given** GDD 假設 #2（配方名稱與組合）、#7（5 位老闆的名字與人設），以及 M4、M5、M6 的內容需求
**When** 完成這個 story（不寫程式，可以和 S1.1～S1.5 同時進行；必須在 S1.7 開工前完成）
**Then** `docs/content.md` 包含以下定稿內容：
- 5 位老闆：名字、一句人設、頭像描述（FR16）
- 10 道配方：名稱、材料與階數（沿用 GDD M4 表）、負責的老闆
- 10 句線索台詞，其中至少 4 句是味道描述（FR30）
- 10 段卡牌故事，每段 2–3 句（FR33）
**And** `docs/art-manifest.md` 列出 GDD〈素材需求〉的全部 54 張美術，每一列包含：檔案路徑（依架構 Asset Management 的命名規則）、尺寸上限、交付批次、狀態（占位／草稿／定稿）。批次如下：
- E1：夜市街背景 1、攤位外觀 20、霓虹招牌 5、老闆頭像 5
- E3：發明菜圖示 10
- E4：阿嬤立繪 1
- E5：卡面 10、卡框 2
**And** GDD 假設索引 #2、#7 改標為「已定稿（S1.0）」
**And** 之後的 story 只要有 `TODO(content)`，就要對應到 `docs/content.md` 或 `docs/art-manifest.md` 的某一列

### Story 1.1: 專案設定與規則護欄

As a 開發者,
I want 專案具備建置 profile、平台設定和 lint 分層護欄,
So that 之後每個 story 都在同一套規則下開發，AI agent 違反分層時 lint 會直接報錯。

**Acceptance Criteria:**

**Given** 目前的專案使用 `app.json`，沒有 `eas.json`
**When** 完成這個 story
**Then** `app.config.ts` 取代 `app.json`，並包含以下設定：`extra`（`adUnitIds`、`posthogKey`、`sentryDsn`、`debugTools`，依 `EAS_BUILD_PROFILE` 注入）、`runtimeVersion: { policy: 'fingerprint' }`，以及 `expo-build-properties` 的 `android.minSdkVersion: 26`；直式鎖定維持不變（NFR7）
**And** `eas.json` 有 development（developmentClient: true）、preview、production 三個 profile
**And** 執行 `npx expo install --fix` 後，`npx expo install --check` 沒有警告（jest-expo 升到 ~58.0.14）
**And** ESLint 新增三條規則：`src/game/**` 禁止 import react、react-native、expo-\*、@/services、@/features、@/ui（`store.ts` 例外，可以 import zustand）；`src/game/**` 禁止使用 `Date.now` 與 `Math.random`（`no-restricted-syntax`）；全專案 `no-console`（`src/services/log.ts` 例外）
**And** 刻意加入一行違規程式碼時 lint 會失敗，移除後通過
**And** `npx expo lint`、`npx tsc --noEmit`、`npx jest` 全部通過

### Story 1.2a: 分層搬檔（只改路徑）

As a 開發者,
I want 既有程式碼搬到分層目錄,
So that 新功能有固定的落點，而且這一步只改路徑，容易 review。

**Acceptance Criteria:**

**Given** 既有的 `src/components/`、`src/game/content.ts`
**When** 完成搬遷
**Then** `board.tsx` 搬到 `src/features/board/`；`customer-tray.tsx` 搬到 `src/features/orders/`；`content.ts` 拆成 `src/game/content/{chains,customers,balance,index}.ts`；mulberry32 拆到 `src/game/random.ts`
**And** `assets/images/` 根層的原始稿與草稿搬到 `art-source/`，App 照常啟動，素材正常顯示
**And** 遊戲行為完全不變，既有的 `engine-test.ts` 全部通過，只改 import 路徑
**And** 這個 story 的 diff 只包含檔案搬移與 import 路徑的修改

### Story 1.2b: Zustand store、apply 與 GameEvent

As a 開發者,
I want 由 Zustand store 持有遊戲狀態，並有一條事件匯流排,
So that 兩個分頁都能用 selector 訂閱 state，演出、音效和埋點也有同一個事件來源。

**Acceptance Criteria:**

**Given** Story 1.2a 完成後的目錄結構
**When** 加入 store
**Then** `src/game/store.ts` 提供 `useGameStore` 與 `apply(action)`；`apply` 依序執行：`syncAll(state, now)` → action → 分派 `state.events` → 清空 events
**And** `src/game/events.ts` 定義 `GameEvent` union，`gameEvents.subscribe` 可以訂閱
**And** `use-game.ts` 改成 store 的薄包裝，`index.tsx` 改用 selector 訂閱，畫面行為不變
**And** 拖曳的手感保持不變（不重構 e4be9f6 的拖曳實作）

### Story 1.2c: 日誌服務與 ErrorBoundary

As a 開發者,
I want 統一的 log 介面，以及根層的錯誤防護,
So that 之後接 Sentry 時只要改一個地方，render 錯誤也不會讓 App 白屏。

**Acceptance Criteria:**

**Given** Story 1.2b 完成
**When** 加入日誌與錯誤防護
**Then** `src/services/log.ts` 提供 `log.debug/info/warn/error(scope, msg, data?)`，開發版輸出到 console；`use-game.ts` 裡原本的 `console.warn` 全部改用 `log`
**And** 根層 `_layout.tsx` 包上 ErrorBoundary：render 錯誤時顯示「重新載入」按鈕，不讓 App 白屏
**And** `npx expo lint`（含 `no-console` 規則）、`npx tsc --noEmit`、`npx jest` 全部通過

### Story 1.3: Spike A：夜市街效能閘門

As a 開發者,
I want 在 Pixel 6a 的 release build 上，用占位素材量出夜市街最重場景的效能,
So that 用數據決定夜市街的渲染方案（架構 #4），之後的畫面 story 不會蓋在錯誤的地基上。

**Acceptance Criteria:**

**Given** 一個只在 preview profile 可進入的原型畫面：橫向捲動的夜市街，5 個攤位，每攤分 4 層（外觀、霓虹 3 段、鐵捲門、頭像），共 20 個頭像，霓虹閃爍與鐵捲門動畫同時播放，外加一次煙火
**When** 依架構文件「Performance Measurement Method」量測，每項取中位數
**Then** 記錄四個數字：FPS（Flashlight，捲動 30 秒）、冷啟動（`adb am start -W`）、分頁切換時間、記憶體（`dumpsys meminfo`），同時量棋盤拖曳的 FPS 作為基準
**And** 依序評估：純 RN → RN + Skia 特效層 → RN + Lottie/Rive → 降級（頭像上限 10、霓虹改靜態）。採用第一個同時通過「60 FPS、切換 ≤ 300 ms、冷啟動 ≤ 3 s」的方案
**And** 結果回填到 `game-architecture.md`：Remaining Decisions #4、Decision Summary #4，以及 Asset Management 的預算數字；`project-context.md` 的 Performance Rules 同步更新
**And** 原型程式碼放在 `src/features/street/__spike__/`，結論出來後刪除，或改寫成 Story 1.7 的起點
**And** 如果採用的方案需要新的原生套件，該套件要先通過原生套件前置關卡

### Story 1.4: Spike B：AdMob 測試激勵廣告

As a 開發者,
I want 在兩個平台的開發版上播放 AdMob 測試激勵廣告，並跑完同意流程,
So that 風險最高的原生依賴在 W1–2 就驗證過，不會拖到 E6 才發現不相容。

**Acceptance Criteria:**

**Given** `react-native-google-mobile-ads` 17.4 與 `expo-tracking-transparency` 58 已用 `npx expo install` 安裝，並通過原生套件前置關卡
**When** 建置 development profile（iOS 與 Android）並啟動
**Then** 首幀之後在背景依序執行：UMP `gatherConsent` → iOS ATT 請求 → `mobileAds().initialize()`，整個流程不阻塞啟動
**And** 一個只在 preview/development 出現的暫時 spike 按鈕（放在棋盤畫面，Story 1.8 完成後移進除錯面板）能播放 `TestIds.REWARDED`，並收到 `EARNED_REWARD`，log 有記錄
**And** 飛航模式下載入失敗時只會 `log.warn`，App 不崩潰
**And** `src/services/ads.ts` 與 `ads.web.ts`（no-op）實作 `AdService` 介面：`init`、`isReady(placement)`、`show(placement) → 'earned' | 'dismissed' | 'unavailable'`；`npx expo start --web` 仍可正常啟動
**And** 如果任一平台失敗，在架構文件記錄原因並啟動備案評估（例如換 SDK 版本、AppLovin MAX 或延後廣告），由使用者決定

### Story 1.5: 存檔 v2 與 v1 遷移

As a 已在玩 v1 的玩家,
I want 更新版本後，我的金幣、等級、棋盤都還在，已解鎖的攤位也都是開著的,
So that 新版本不會讓我失去任何進度。

**Acceptance Criteria:**

**Given** `src/game/types.ts` 定義完整的 GameState v2（形狀依架構文件，包含 stalls、queue、inventions、meta、daily、lastSellout、events）；新局時各欄位都是合法的初始值
**When** 讀到一份 v1 存檔
**Then** 依序執行 `migrations[1]`：
- 每條鏈依 `CHAINS[c].unlockLevel ≤ level` 判斷，符合的攤位設為 Lv1，其他設為 0
- 棋盤上的產生器原樣保留
- 所有訂單補上 `kind: 'normal'`
- 以遷移後的攤位等級開一波人龍
- 其他欄位設為空值
- `firstLaunchAt = now − 72h`（FR46）
- `meta.tutorialStep` 設為已完成（v1 玩家不重跑教學）
**And** 遷移後通過 `isValidSaveV2`；金幣、XP、等級、棋盤與遷移前完全相同
**And** 第一次寫入 v2 之前，原始的 v1 字串備份到 `merge-night-market/save.v1.bak`
**And** 遷移或驗證失敗時，**不覆寫存檔、不開新局**，改為顯示「存檔讀取失敗」畫面，並 `log.error`；只有完全沒有存檔時才開新局
**And** `__tests__/fixtures/` 至少包含 4 份 v1 存檔：新局、Lv3、Lv7 全鏈、棋盤滿且有待放產生器；`migration-test.ts` 全部通過，對應 NFR5
**And** 寫入存檔前會先移除 `events`；存檔只存在本機 AsyncStorage，不做雲端或帳號（NFR9）
**And** 在 `types.ts` 加上註解，說明這個取捨：v2 一次定義 E2～E6 才會用到的欄位，換來整個 MVP 只需要一次 v1→v2 遷移；新增的欄位在 MVP 期間只用空值或初始值

### Story 1.6: 產生器與訂單改由攤位控制

As a 玩家,
I want 棋盤上的產生器和訂單只來自已經開張的攤位，而且攤位越高級，訂單給的錢越多,
So that 攤位的狀態和棋盤上的玩法是連動的。

**Acceptance Criteria:**

**Given** 玩家升級
**When** 執行 `applyLevelUps`
**Then** 不會再自動放上新的產生器（RC-1、FR11）；體力 +20 仍照常發放
**And** `createOrder` 只從 `stalls[c].level ≥ 1` 的鏈抽選（RC-2、FR7）
**And** 一般訂單的金幣 = 5 × 材料 baseCost 總和 × (1 + 0.1 × (攤位等級 − 1))，在建立時鎖定，之後升級攤位不會回溯（RC-3）；兩品項訂單分別以各自攤位的等級計算
**And** `completeOrder` 的簽名改成 `(state, orderId, now)`，並 push `order_completed` 事件
**And** `engine-test.ts` 更新：升級不會放產生器；鐵捲門攤位的鏈不會出現在訂單裡；加成數值正確
**And** 新局時只有 tea、fried 兩個產生器，訂單也只會出現這兩條鏈
**And** 規則層提供純函式 `expectedOrderCoins(playerLevel, stalls)`，依 FR7、FR8 的公式算出每張訂單的期望金幣；`docs/balance.md` 列出 Lv1～Lv10、開局攤位狀態下的「各玩家等級每單期望金幣」表（由測試或腳本產生）。S6.4 用這張表驗證教學，S7.5 只做實測校正

### Story 1.7: 底部分頁、夜市街與設定畫面

As a 玩家,
I want 從底部分頁切到夜市街，左右滑動看 5 個攤位目前的樣子,
So that 我隨時看得到夜市被我點亮到什麼程度。

**Acceptance Criteria:**

**Given** 路由結構為 `(tabs)/_layout.tsx`（自訂 tab bar、`freezeOnBlur: true`），`(tabs)/index.tsx` 是棋盤，`(tabs)/street.tsx` 是夜市街（FR41）
**When** 玩家點底部的「夜市街」
**Then** 切換時間 ≤ 300 ms（依量測方法），兩頁常駐；回到棋盤時，拖曳的狀態與手感不變
**And** 夜市街是橫向捲動的街道，5 個 `StallView` 依 Story 1.3 選定的渲染方案實作；每攤依等級顯示外觀（鐵捲門／Lv1／Lv2／Lv3）與對應段數的霓虹（FR14）
**And** 色調是深藍天空、暖黃燈泡串、高飽和霓虹（UX-DR10）；還沒有正式美術的地方用占位圖，並標註 `// TODO(content): art-manifest#<列>`
**And** 攤位顯示老闆頭像與名字，資料來自 `content/stalls.ts`，文字依 `docs/content.md` 的定稿（FR16）
**And** 夜市街左上角有設定入口（≥ 44 pt），和右上角的收藏冊入口對稱；點下去開啟 `src/app/settings.tsx`（presentation: modal）。這個 story 的設定畫面只顯示版本號，音訊開關在 S7.2 加上
**And** 夜市街失焦時，循環動畫暫停（`useIsFocused`）
**And** 每個 `StallView` 只用 selector 訂閱自己的攤位；拖曳棋子時夜市街不會重繪（用 React DevTools Profiler 驗證）
**And** tab bar 與所有可點擊目標 ≥ 44 pt（UX-DR1、NFR8）

### Story 1.8: 除錯面板與存檔匯入匯出

As a 開發者與測試者,
I want 用除錯面板調整金幣、等級、攤位，並匯入匯出存檔,
So that 不必真的玩上好幾個小時，就能重現 bug、測試後期內容，或製作 fixture。

**Acceptance Criteria:**

**Given** development 或 preview 建置
**When** 在設定畫面（Story 1.7）長按版本號 2 秒
**Then** 開啟除錯面板，提供：加金幣、加體力、設定玩家等級、設定各攤位等級、時間快轉（把偏移量注入 `syncAll` 的 `now`）
**And** 「匯出存檔」把目前的存檔 JSON 複製到剪貼簿；「匯入存檔」從剪貼簿讀取，先執行遷移與驗證，失敗時拒絕匯入並顯示原因
**And** 所有除錯操作都透過 `apply` 呼叫規則層的函式，不直接修改 state
**And** production 建置看不到這個入口，`extra.debugTools = false` 時不會掛載相關程式碼
**And** Story 1.4 放在棋盤畫面上的 Spike B 暫時按鈕移進除錯面板，棋盤畫面上不再有任何 spike 按鈕

### Story 1.9: 重開攤位

As a 玩家,
I want 達到等級門檻並存夠金幣後，拉起麵線、蒸籠、甜品攤的鐵捲門,
So that 我可以解鎖新的產品線和新的訂單。

**Acceptance Criteria:**

**Given** 玩家在夜市街點一個鐵捲門攤位
**When** 攤位面板打開
**Then** 面板顯示重開條件（麵線 Lv3 + 300、蒸籠 Lv5 + 600、甜品 Lv7 + 1000；開局只有 tea、fried 開著，FR9、FR10），未達成的條件會標示出來（UX-DR3）
**And** 條件都滿足時按下「重開」，執行 `reopenStall(state, stall, now)`：扣金幣、攤位設為 Lv1、把該鏈的產生器放上棋盤（棋盤滿時放進 `pendingGenerators`），並 push `stall_reopened`
**And** FxController 收到事件後播放鐵捲門拉起的動畫
**And** 條件不足時，`reopenStall` 回傳原本的 state，按鈕維持停用
**And** 重開之後，新的訂單就可能出現這條鏈
**And** `stalls-test.ts` 涵蓋：條件不足、金幣剛好夠、棋盤已滿、重複重開

### Story 1.10: 升級攤位到 Lv2 與招牌通電

As a 玩家,
I want 花金幣把攤位升到 Lv2，看霓虹招牌多亮一段,
So that 我每次回來都能讓夜市更熱鬧一點。

**Acceptance Criteria:**

**Given** 玩家在夜市街點一個 Lv1 的攤位
**When** 金幣足夠（tea 200、fried 200、noodle 400、dumpling 600、sweet 900），按下「升級」
**Then** `upgradeStall(state, stall, now)` 扣金幣、攤位升到 Lv2，並 push `stall_upgraded`；FxController 播放招牌通電演出，霓虹點亮到第 2 段（FR14）
**And** 該攤的新訂單金幣加成 +10%（FR15，由 Story 1.6 的公式自動計算）
**And** Lv2 攤位的面板會顯示 Lv3 的條件，但按鈕是鎖住的，並提示「需要發明菜（即將開放）」
**And** 從新局開始可以把 tea、fried 升到 Lv2；玩家升到 Lv3 後也能重開麵線攤（Epic 1 完成定義）
**And** Epic 1 結束時，在 Pixel 6a release build 上量一次 NFR1–3，結果記入 retro
**And** `docs/art-manifest.md` 的 E1 批次（夜市街背景、攤位外觀 20、霓虹 5、老闆頭像 5）全部是「定稿」，而且程式碼中屬於 E1 範圍的 `TODO(content)` 清零
**And** 時程檢查點：E1 retro 時如果已經超過 W3，啟動範圍調整評估（例如簡化 E5 的升星演出），由使用者決定

## Epic 2: 排隊人龍與完售

玩家看著人龍一單一單消化，清空時「完售！」拿大獎勵，冷卻結束後下一波人潮再來。攤位越強，人龍越長。

### Story 2.1: 人龍波次規則

As a 玩家,
I want 每出一張訂單，今晚的客流就少一人，清空時拿到完售獎勵，過幾分鐘下一波再來,
So that 我在棋盤上的每個動作都有一個看得見的十分鐘級目標。

**Acceptance Criteria:**

**Given** `src/game/queue.ts`，實作架構文件 NP-2 的狀態機
**When** 處於 ACTIVE（`cooldownEndsAt = null`）時完成一張訂單
**Then** `queue.remaining − 1`
**And** `queueCapacity(state) = min(8 + 2 × Σ已開攤位等級, 20) + queue.bonus`；新局為 12，`bonus` 恆為 0（FR17）
**And** `remaining` 歸 0 時：
- 發放完售獎勵：金幣 5 × length、體力 +10、XP + length
- 寫入 `lastSellout { wave, coins, energy, xp, doubled: false }`
- `cooldownEndsAt = now + 3 分鐘`
- push `queue_sold_out`（FR19）
**And** COOLDOWN 期間完成訂單，只給訂單本身的基本獎勵，不動人龍（FR20）
**And** `syncQueue`：`now ≥ cooldownEndsAt` 時開新一波，`wave + 1`，`length = remaining = queueCapacity`，清除 `lastSellout`
**And** ACTIVE 期間重開或升級攤位，`growActiveWave` 讓 length 與 remaining 同時 + Δ（上限 20）；COOLDOWN 期間不變（FR18）
**And** 時鐘倒退時，`cooldownEndsAt − now` 會被截到 3 分鐘以內，冷卻不會被拉長
**And** 規則層提供純函式 `needsTick(state, now)`，store 的 1 秒 tick 只在它回傳 true 時運作。本 story 的條件是「體力 < 100」或「冷卻中」；之後的 story 會擴充條件（S4.2 線索單、S6.1 開幕週體力上限）。回到前景時立刻 `syncAll`
**And** `queue-test.ts` 補上 `needsTick` 的測試：體力滿且人龍進行中時回傳 false
**And** `queue-test.ts` 涵蓋以下情境：一般消化、剛好完售、冷卻中出單、冷卻結束、波中升級、冷卻中升級、上限 20、時鐘倒退

### Story 2.2: 棋盤頂端的客流計量條

As a 玩家,
I want 在棋盤畫面頂端看到「今晚客流 7/12」，每出一單就有一位客人離隊,
So that 消化人龍的爽感發生在我最常看的畫面上。

**Acceptance Criteria:**

**Given** `src/features/queue-meter/`，放在棋盤畫面頂端
**When** ACTIVE 狀態下完成一張訂單
**Then** 計量條顯示「今晚客流 已出單/length」，例如出到第 7 單時顯示「今晚客流 7/12」
**And** 每出一單：一個客人頭像做離隊動畫，數字跳動（UX-DR2、FR42）
**And** 剩最後 3 人時，計量條閃爍並加快脈動節奏（音效節奏加快的部分在 E7 接上）
**And** COOLDOWN 期間，計量條改為顯示「下一波 2:31」倒數（FR20）
**And** 波中升級讓 length 增加時，數字直接更新為新的分母，不會跳回 0
**And** 動畫只在 UI thread 執行，只訂閱 `queue` 切片；拖曳棋子時計量條不會重繪

### Story 2.3: 夜市街的排隊頭像

As a 玩家,
I want 在夜市街看到客人在各攤前排隊，攤位越強、隊伍越長,
So that 攤位實力直接變成眼前的人潮。

**Acceptance Criteria:**

**Given** 規則層的純函式 `distributeQueue(state)`，依各攤等級比例把 `remaining` 人分配到已開的攤位，總和恆等於 `remaining`
**When** 玩家切到夜市街
**Then** 每攤前方顯示分配到的客人頭像（沿用 12 種客人美術）
**And** 每攤最多畫 N 個頭像，N 依 Story 1.3 的結論；超過的部分顯示「+k」（FR43）
**And** 出單後回到夜市街，看到的人數已經更新
**And** COOLDOWN 期間街上沒有排隊；新一波開始時，客人依序入列
**And** 夜市街失焦時，排隊的循環動畫暫停
**And** `queue-test.ts` 補上 `distributeQueue` 的測試：總和守恆、鐵捲門攤位分到 0、各攤等級相同時平均分配

### Story 2.4: 完售演出

As a 玩家,
I want 人龍清空的瞬間看到煙火和全街招牌一起閃爍，並清楚看到拿了多少獎勵,
So that 每一波完售都是一個值得停下來慶祝的小高潮。

**Acceptance Criteria:**

**Given** FxController 訂閱 `queue_sold_out`
**When** 完售發生，不論玩家當時在棋盤還是夜市街
**Then** Overlay Host 播放「完售！」演出：煙火、所有已開攤位的招牌一起閃爍，並顯示本波獎勵（金幣、體力、XP）（FR19、UX-DR4）
**And** 演出可以點一下跳過，結束後回到原本的畫面，棋盤狀態保持不變
**And** 演出面板預留「看廣告獎勵加倍」按鈕的位置，在 E6 之前一律隱藏
**And** 演出期間，每秒 tick 照常運作，不會卡住
**And** 演出依 Story 1.3 的渲染方案實作，在 Pixel 6a 上播放時不掉幀
**And** Epic 2 完成定義：新局可以完整消化一波 12 人，冷卻後出現下一波；升級攤位後，下一波的長度確實增加。Epic 2 結束時量一次 NFR1–3，結果記入 retro

## Epic 3: 老闆發明

玩家把兩個攤位的高階品項拖在一起，就能發明新菜。組錯了不會被懲罰。第一次發明有全螢幕演出，發明菜可以用來把攤位升到 Lv3，成為那一攤的招牌菜。

### Story 3.1: 配方與發明菜資料

As a 開發者,
I want 把 10 道配方和發明菜整理成有型別、測試會自動檢查的內容資料,
So that 判定規則、演出和之後的卡牌都從同一份資料取值，不會各寫各的。

**Acceptance Criteria:**

**Given** `src/game/content/recipes.ts`
**When** 定義 10 道配方
**Then** 每道配方有 `id`（kebab-case，例如 `'tea-fried'`）、`a`／`b`（鏈與階數）、`name`、`clue`、`owner`（StallId）、`art`。材料與階數依 GDD M4 表，型別寫法為 `as const satisfies readonly RecipeDef[]`，並匯出 `RecipeId`（FR26）
**And** 名稱和台詞還沒定稿的配方先用 GDD 的暫定值，加上 `// TODO(content)` 註記
**And** 發明菜圖示放在 `assets/images/dishes/<recipe-id>.webp`，正式美術還沒好之前用占位圖
**And** `content-test.ts` 檢查以下幾點：
- 每道配方的鏈和階數都存在
- 每條鏈恰好出現在 4 道配方
- 沒有同鏈配方
- 10 個 id 不重複
- 每個 id 都有對應的圖片
**And** 衍生函式 `dishSellPrice(recipe) = (baseCost(a) + baseCost(b)) × 1.5` 有測試

### Story 3.2: 拖放解析規則（resolveDrop / applyDrop）

As a 玩家,
I want 把兩條鏈的正確材料拖在一起就能發明，組錯就彈回去、什麼都不會損失，其他情況照舊交換位置,
So that 我可以放心亂試，不怕浪費高階品項。

**Acceptance Criteria:**

**Given** 新檔案 `src/game/drop.ts`，實作 NP-1
**When** 呼叫 `resolveDrop(state, from, to)`
**Then** 依序判定，先命中的優先：
1. move
2. merge
3. stack
4. invent（`(A, B)` 不分順序符合某道配方，且兩攤都 ≥ Lv2）
5. reject（兩個品項都是「兩攤皆 ≥ Lv2」的配方材料，但湊不成同一道）
6. swap

產生器一律走 swap（FR3、FR21、FR22）
**And** `applyDrop(state, from, to, now)` 依判定結果套用：
- invent：消耗兩個材料，在目標格產生 `DishPiece`（count 1）；`inventions[r].made + 1`；第一次做出來時 `discovered = true`；push `dish_invented { recipe, first }`
- reject：state 完全不變，只 push `invent_rejected { recipes: affected }`
- stack：目標格最多疊到 3，多出來的留在原格，保留目標格原本的 id（FR23）
- merge：push `item_merged`
**And** `movePiece` 改為內部函式，UI 不再直接呼叫它（RC-4）；既有的 merge、swap 測試繼續有效
**And** 兩攤有一攤還沒到 Lv2 時，就算材料正確也走 swap
**And** `drop-test.ts` 窮舉 6 種判定，以及這些邊界：反方向拖曳、已發現的配方再做一次、產生器、兩格都是同一道發明菜（count 2 + 2）、不同發明菜互拖、一攤 Lv1 一攤 Lv2

### Story 3.3: 棋盤上的發明菜與搖頭彈回

As a 玩家,
I want 在棋盤上看到發明菜和它疊了幾份，組錯時品項搖頭彈回原位，高階品項還會冒熱氣,
So that 我一眼看得懂剛剛那一拖發生了什麼事。

**Acceptance Criteria:**

**Given** `board.tsx` 落子時改呼叫 `apply(s => applyDrop(s, from, to, Date.now()))`
**When** 判定結果是 reject
**Then** 被拖的品項播放搖頭動畫後彈回原格（UX-DR6），不消耗任何東西
**And** 發明菜在格子裡顯示圖示，右下角標示份數（×2、×3）；發明菜不能和品項合成
**And** L4 以上的品項和發明菜有冒熱氣的小動畫，畫面失焦時暫停（UX-DR9）
**And** 拖曳的手勢與手感保持不變（不重構 e4be9f6 的拖曳實作），落子的判定一律交給規則層
**And** 在 Pixel 6a 上棋盤擺滿 L4+ 品項時，拖曳仍維持 60 FPS（NFR1）

### Story 3.4: 首次發明演出與賣出發明菜

As a 玩家,
I want 第一次發明某道菜時看到「老闆發明！」的全螢幕慶祝，多做出來的發明菜也能賣錢,
So that 發現新菜是一件大事，棋盤滿了也有辦法清出空間。

**Acceptance Criteria:**

**Given** FxController 訂閱 `dish_invented`
**When** `first` 為 true
**Then** Overlay Host 播放「老闆發明！」全螢幕演出，畫面包含發明菜、菜名、發明這道菜的老闆頭像與名字（FR25、UX-DR5；★1 卡牌的部分在 E5 接上）
**And** `first` 為 false 時，只在棋盤上做一個小的成功提示，不播放全螢幕演出
**And** 點選發明菜後，資訊列顯示菜名、份數，以及「賣出 🪙{dishSellPrice}」按鈕（沿用品項的點選 + 賣出按鈕，`src/features/board/` 的 InfoBar，UX-DR12）；每按一次只賣 1 份；`count` 歸 0 時清空格子，並取消選取（FR24、RC-6）
**And** `engine-test.ts` 補上測試：賣出發明菜時 count 3 → 2 → 1 → 清空，金幣累計正確

### Story 3.5: Lv3 升級與招牌菜

As a 玩家,
I want 選一道含這攤食材的發明菜上架，把攤位升到 Lv3 大店，招牌全亮,
So that 我做出來的發明菜可以變成夜市街上看得見的成就。

**Acceptance Criteria:**

**Given** 一個 Lv2 攤位的面板
**When** 金幣足夠（600／600／1000／1500／2000），而且棋盤上至少有 1 份含該鏈的發明菜
**Then** 面板列出棋盤上所有符合條件的發明菜，讓玩家選一道（FR12、RC-7、UX-DR3）
**And** 確認之後執行 `upgradeStall(state, stall, now, recipe)`：扣金幣、從任一格扣 1 份該發明菜（RC-8）、攤位升到 Lv3、`signatureDish = recipe`，並 push `stall_upgraded`
**And** 夜市街上這一攤換成大店外觀，霓虹全亮，招牌下方顯示招牌菜（FR13、FR14；星等徽章在 E5 接上）
**And** 招牌菜確定後不能更換。沒有符合條件的發明菜時，按鈕停用，並提示需要哪一條鏈的發明菜
**And** 升級後如果人龍在 ACTIVE 狀態，會依 NP-2 立刻加長
**And** `stalls-test.ts` 補上測試：缺少發明菜、指定的發明菜不含該鏈、從 3 份中扣掉 1 份、扣到 0 份時清空格子
**And** Epic 3 完成定義：10 道配方都能觸發；無效組合不會扣資源；可以完成一次 Lv3 升級；`art-manifest` 的 E3 批次（發明菜圖示 10 張）全部定稿，配方名稱改用 `docs/content.md` 的定稿，E3 範圍內的 `TODO(content)` 清零。Epic 結束時量測 NFR1–3，結果記入 retro

## Epic 4: 貴客上門與阿嬤指點

富豪、藝人、YouTuber 會出高價點發明菜。線索客人會說出味道提示；玩家亂試 5 次之後，阿嬤會直接說出答案。不必查攻略，也能把所有配方找出來。

### Story 4.1: 貴客單規則

As a 玩家,
I want 發現第一道發明菜之後，偶爾有貴客上門指定要發明菜，給我三倍的錢,
So that 做出來的發明菜有一個高價的去處。

**Acceptance Criteria:**

**Given** `src/game/vip.ts`，`createOrder` 在建立新訂單時呼叫 `rollVip(state)`
**When** 已發現的發明菜至少 1 道，而且目前沒有貴客單或線索單
**Then** 以 `min(20% + 2% × (Σ攤位等級 − 2), 40%)` 的機率改為貴客單（`kind: 'vip'`、`recipe`）。這個機率使用 seeded RNG（FR27）
**And** 貴客單隨機指定 1 道已發現的發明菜
- 金幣 = 5 × 材料 baseCost 總和 × 兩攤等級加成的平均 × 3 × (1 + `cardBonus(state, recipe)`)
- XP = 材料階數總和 × 2
- `cardBonus` 在本 Epic 一律回傳 0，E5 再接上（FR28）
**And** 交付貴客單時，從棋盤任一格扣 1 份該發明菜（RC-8），人龍 −1，並 push `order_completed { kind: 'vip' }`
**And** 同一時間最多只有 1 張貴客或線索單
**And** `vip-test.ts` 涵蓋：尚未發現任何發明菜時不會出現貴客單、機率上限 40%、同時最多 1 張、金幣公式、交付時扣 1 份、固定 seed 下結果可重現

### Story 4.2: 線索單與「請客人先走」

As a 玩家,
I want 有時候上門的客人只說一句「好想來杯紅茶配鹹酥的……」，10 分鐘後就離開,
So that 我能從客人的話裡猜出還沒發現的配方。

**Acceptance Criteria:**

**Given** 還有「尚未發現、兩攤都已達 Lv2」的配方
**When** `rollVip` 判定為貴客單
**Then** 有 50% 機率改為線索單（`kind: 'clue'`、`recipe`、`expiresAt = now + 10 分鐘`），並設 `inventions[recipe].clueSeen = true`（FR29）
**And** 線索單顯示該配方的 `clue` 台詞，部分台詞是味道描述（內容在 `recipes.ts`，FR30）
**And** 線索單無法完成，不扣人龍，計入「同時最多 1 張」的上限
**And** `syncOrders`：`now ≥ expiresAt` 時移除線索單並補上一張新訂單；時鐘倒退時，剩餘時間截到最多 10 分鐘
**And** `needsTick` 擴充：存在 `kind: 'clue'` 的訂單時也回傳 true，讓線索單的倒數和到期移除在體力已滿時照常運作；`vip-test.ts` 補上「體力已滿、有線索單時 `needsTick` 為 true」
**And** `dismissOrder(state, orderId)` 只能用在 `kind: 'clue'`，移除後補上新訂單，不扣人龍（RC-9）
**And** `vip-test.ts` 補上：沒有可用配方時不會產生線索單、到期移除、提前請走、對非線索單呼叫 dismiss 時回傳原 state

### Story 4.3: 貴客與線索的訂單卡

As a 玩家,
I want 貴客單和線索單在訂單列上一眼就跟一般單分得出來,
So that 我知道哪張值得留發明菜，哪張只是在給提示。

**Acceptance Criteria:**

**Given** `src/features/orders/` 的訂單列
**When** 出現貴客單
**Then** 卡片用貴客客人（富豪、藝人、YouTuber 其中一位），有醒目的外框，顯示指定的發明菜和高價金幣；棋盤上有這道菜時，「出餐」按鈕可以按
**And** 線索單用對話框顯示線索台詞，附上剩餘時間倒數和「請客人先走」按鈕（≥ 44 pt）
**And** 一般單的外觀和行為保持不變
**And** 客人由訂單 id 決定，讀檔後不會換人（沿用 `customerForOrder` 的做法，貴客改從 3 位貴客中挑選）

### Story 4.4: 阿嬤保底提示

As a 玩家,
I want 同一道配方試錯 5 次之後，阿嬤跳出來直接告訴我兩個材料，而且一開放發明，她就先教我第一道,
So that 不管多不會猜，我都不會卡關。

**Acceptance Criteria:**

**Given** `src/game/invention.ts` 的 `recordRejection`（NP-3），由 `applyDrop` 在 reject 時呼叫
**When** 發生一次無效的發明嘗試
**Then** `affected` 中每一道配方的 `failures` 都 +1，已發現的配方不計入（FR31）
**And** 某道配方的 `failures` 達到 5，而且不在 `meta.hintedRecipes` 裡時，把它加入 `hintedRecipes`，並 push `hint_shown { recipe }`
**And** 每道配方只會提示一次
**And** `upgradeStall` 讓 tea 和 fried 兩攤第一次同時達到 Lv2 時，對 `'tea-fried'` 走同一條路徑發出提示（FR32）
**And** FxController 收到 `hint_shown` 後，在 Overlay Host 顯示阿嬤立繪和對話框，直接說出兩個材料的名稱（UX-DR7）；點一下關閉
**And** `invention-test.ts` 涵蓋：一次失敗同時讓多道配方 +1、第 5 次觸發提示、不會重複提示、已發現的配方不計數、教學提示觸發
**And** Epic 4 完成定義：在只靠線索和提示、不看外部資料的情況下，可以發現所有已開放的配方；阿嬤立繪定稿；線索台詞改用 `docs/content.md` 的定稿，E4 範圍內的 `TODO(content)` 清零

## Epic 5: 發明菜收藏冊

玩家收集 10 張卡牌，讀老闆的故事。同一道菜做得越多，星等越高，貴客單給的錢也越多。★5 的卡牌換成金框。

### Story 5.1: 卡牌資料與星等加成

As a 玩家,
I want 每道發明菜做得越多，它的卡牌星等就越高，貴客單的加成也跟著提高,
So that 重複製作拿手菜也是一種成長。

**Acceptance Criteria:**

**Given** `src/game/content/cards.ts`：每道配方對應一張卡（FR33），內容包含卡面 `art`、`story`（2–3 句，未定稿的文字標 `// TODO(content)`）、`owner`
**When** 呼叫 `cardStars(made)`
**Then** 門檻依序為 1／3／6／10／15 份，對應 ★1 到 ★5；`made = 0` 時回傳 0，代表未取得（FR34）
**And** `cardBonus(state, recipe)` 依星等回傳 0／0.10／0.20／0.35／0.50，並取代 E4 留下的 0 回傳值；貴客單金幣改用這個加成計算
**And** 星等是由 `made` 推算出來的衍生值，不寫入存檔（ADR-05）
**And** `applyDrop` 在 invent 時，如果 `made` 剛好跨過門檻，就 push `card_starred { recipe, stars }`（第一次做出來不算升星）
**And** 卡面素材放在 `assets/images/cards/<recipe-id>.webp`，卡框有 `frame-normal` 和 `frame-gold` 兩種；`content-test` 檢查卡牌和配方一一對應
**And** `cards-test.ts` 涵蓋：門檻邊界值（2→★1、3→★2、14→★4、15→★5）、加成數值、升星事件只在跨門檻時觸發、貴客單金幣有套用加成

### Story 5.2: 收藏冊畫面

As a 玩家,
I want 從夜市街右上角打開收藏冊，看自己集了幾張卡、每張卡幾顆星，以及老闆說的故事,
So that 我有一個每週都想把它集滿的目標。

**Acceptance Criteria:**

**Given** `src/app/collection.tsx`（presentation: modal）與 `src/features/collection/`
**When** 玩家點夜市街右上角的收藏冊入口
**Then** 以網格顯示 10 張卡牌，最上方顯示收集進度「x/10」（FR35、UX-DR8）
**And** 每張卡依狀態顯示：
- 未發現且沒看過線索：剪影
- 未發現但 `clueSeen`：剪影加上線索台詞
- 已發現：卡面、菜名、星等
**And** ★5 的卡顯示金框（FR34）
**And** 點已發現的卡會打開詳情，顯示卡面、故事、老闆頭像與名字、目前製作次數，以及下一顆星還差幾份
**And** 關閉收藏冊後回到夜市街，原本的捲動位置不變
**And** 收藏冊只用 selector 訂閱 `inventions` 切片

### Story 5.3: 卡牌演出與招牌菜星等

As a 玩家,
I want 第一次發明時拿到 ★1 卡，升星時看到演出，夜市街的招牌菜也掛著星等徽章,
So that 收藏進度在遊戲裡處處看得見。

**Acceptance Criteria:**

**Given** E3 已經有「老闆發明！」演出
**When** `dish_invented { first: true }`
**Then** 演出畫面加入 ★1 卡牌的展示，完成 UX-DR5
**And** 收到 `card_starred` 時，Overlay Host 播放升星演出，內容是卡牌加上新的星等；升到 ★5 時另外播放換金框的效果
**And** 夜市街上的招牌菜顯示該菜目前的星等徽章（FR13）
**And** 升星演出可以點一下跳過，不會擋住連續操作
**And** Epic 5 完成定義：10 張卡都能收集並升到 ★5，貴客單報酬正確反映加成；卡面 10 張與卡框 2 種定稿，卡牌故事改用 `docs/content.md` 的定稿，E5 範圍內的 `TODO(content)` 清零。Epic 結束時量測 NFR1–3，結果記入 retro

## Epic 6: 開幕週與激勵廣告

新玩家前 3 天體力上限加倍，並有手指引導帶著玩。體力不夠時可以看廣告補體力；完售時可以看廣告讓獎勵加倍。沒有網路也照樣能玩。

### Story 6.1: 開幕週體力與每日廣告計數

As a 新玩家,
I want 前 3 天體力上限是 200，看廣告的次數每天台北時間午夜歸零,
So that 我在最容易流失的前幾天玩得夠盡興，規則也清楚好懂。

**Acceptance Criteria:**

**Given** `src/game/daily.ts` 與 `src/game/time.ts`
**When** 呼叫 `maxEnergy(state, now)`
**Then** 如果 `now < meta.firstLaunchAt + 72h`，回傳 200，否則回傳 100（FR36）。這是衍生值，不存檔
**And** 新局的初始體力是 200。`syncEnergy` 改用 `maxEnergy(state, now)` 判斷是否已滿；開幕週結束時，超過 100 的體力保留，但在降回 100 以下之前不會自然回復
**And** `needsTick` 的體力條件改成「體力 < `maxEnergy(state, now)`」；`daily-test.ts` 補上「開幕週內體力 150 時 `needsTick` 為 true」
**And** v1 遷移的玩家，因為 `firstLaunchAt = now − 72h`，不享有開幕週
**And** `dateKeyUTC8(now)` 以 UTC+8 計算日期；`syncDaily` 在 dateKey 變大時，把 `adEnergyUsed` 和 `adDoubleUsed` 歸零。dateKey 變小（時鐘倒退）時視為還沒換日，不歸零
**And** 實作 NP-4 的 `canWatchAd(state, placement)` 與 `grantAdReward(state, placement, now)`：
- `energy`：每日上限 5 次，每次 +20
- `sellout-double`：每日上限 3 次，而且 `lastSellout` 必須存在、`doubled` 為 false。獎勵是把整份完售獎勵再發一次
- 超過上限或條件不符時，回傳原本的 state
**And** `daily-test.ts` 與 `time-test.ts` 涵蓋以下情境：開幕週的邊界（71:59 / 72:00）、超過上限的體力、跨日歸零、裝置時區改變不影響結果、時鐘倒退、每日上限、同一波重複加倍、`grantAdReward` 連續呼叫兩次

### Story 6.2: 體力不足時看廣告補體力

As a 體力用完的玩家,
I want 點一下看完廣告就能 +20 體力，不用乾等,
So that 我可以把這一局玩完，而且是不是要看廣告由我決定。

**Acceptance Criteria:**

**Given** 點產生器時體力不足（`getSpawnBlocker = 'no-energy'`）
**When** 顯示體力不足的提示
**Then** 只有在 `canWatchAd(state, 'energy') && ads.isReady('energy')` 都成立時，才顯示「看廣告 +20 體力」按鈕，並標示今天還剩幾次（FR37）
**And** 按下按鈕後 `await ads.show('energy')`。只有回傳 `'earned'` 時才執行 `apply(s => grantAdReward(s, 'energy', Date.now()))`；`'dismissed'` 或 `'unavailable'` 時不給任何東西（NP-4）
**And** 離線、廣告沒有庫存或載入失敗時，按鈕會被隱藏，提示改成只顯示下一點體力的回復倒數（FR39）
**And** 不加入任何插頁或橫幅廣告；廣告只換時間（體力），不換內容（NFR10）
**And** production profile 透過 `extra` 注入正式的 ad unit ID；development 和 preview 一律使用 `TestIds`；`app.config.ts` 內含 iOS ATT 的 `NSUserTrackingUsageDescription` 文案
**And** 廣告播放結束後回到遊戲，棋盤和拖曳都可以正常操作

### Story 6.3: 完售時看廣告加倍

As a 剛完售的玩家,
I want 在完售畫面選擇看一支廣告，讓這一波的獎勵翻倍,
So that 完售的那一刻有更大的回報。

**Acceptance Criteria:**

**Given** Story 2.4 的完售演出面板上預留了按鈕位置
**When** `canWatchAd(state, 'sellout-double') && ads.isReady('sellout-double')`
**Then** 顯示「看廣告獎勵加倍」按鈕，並標示今天還剩幾次（FR38、UX-DR4）
**And** 回傳 `'earned'` 之後，再發一次本波的金幣、體力、XP，並把 `lastSellout.doubled` 設為 true，每一波只能加倍一次
**And** 如果下一波已經開始（`lastSellout` 已清除），按鈕不顯示
**And** 廣告無法播放時隱藏按鈕，完售演出照常結束

### Story 6.4: 新手手指引導

As a 第一次打開遊戲的玩家,
I want 有一隻手指帶我依序完成合成、出餐、去夜市街升級,
So that 我在一分鐘內就懂這款遊戲要怎麼玩。

**Acceptance Criteria:**

**Given** `src/features/tutorial/`，進度記錄在 `meta.tutorialStep`
**When** 新局第一次啟動
**Then** 依序引導 3 個步驟，每一步都由實際的 GameEvent 推進，而不是固定時間（FR40、UX-DR11）：
1. 點產生器並合成一次（收到 `item_merged`）
2. 完成一張訂單（收到 `order_completed`）
3. 切到夜市街，升級一個攤位（收到 `stall_upgraded`）
**And** 引導期間只顯示手指動畫和一句說明，不遮擋操作；玩家自行完成步驟也一樣算數
**And** 3 步完成後 `tutorialStep` 標記為完成，之後不再出現；中途關閉 App，重開後會從同一步繼續
**And** 為了讓第 3 步一定能完成，在教學完成前，tea 或 fried 第一次升 Lv2 所需的金幣，必須能存到：用 S1.6 的 `expectedOrderCoins` 驗證，新局在 8 張訂單以內就能存到 200 金幣。不夠的話調整新手訂單，並記錄在 `docs/balance.md`
**And** v1 遷移的玩家，`tutorialStep` 在遷移時已設為完成（Story 1.5），所以不會出現教學
**And** Epic 6 完成定義：新玩家第一天就能完成第一次攤位升級；開飛航模式從冷啟動開始可以完整遊玩，只有廣告按鈕被隱藏（NFR6）

## Epic 7: 聲音、數據與上架

夜市要有聲音：油鍋聲、收銀機、叫賣。再用數據校正平衡、通過效能驗收，最後在兩個平台上架。

### Story 7.1: 音效服務與事件音效

As a 玩家,
I want 合成時聽到「滋～」的油鍋聲越炸越響，出餐有收銀機聲，拉鐵捲門、招牌通電、完售煙火也都有聲音,
So that 每一個動作都有夜市的手感。

**Acceptance Criteria:**

**Given** `src/services/audio.ts` 與 `audio.web.ts`（no-op），使用 expo-audio 58
**When** App 啟動
**Then** 用 `createAudioPlayer` 預載約 12 個音效，並排入分段預載的第一段
**And** `setAudioModeAsync`：iOS 靜音開關打開時不發聲，並和其他 App 的音訊混音
**And** AudioService 訂閱 GameEvent，對應關係如下：
- `item_merged`：合成音效，炸物鏈用油鍋聲，`playbackRate` 隨階數遞增
- `order_completed`：收銀機
- `stall_reopened`：鐵捲門
- `stall_upgraded`：招牌通電「嗡」
- `queue_sold_out`：煙火
- `dish_invented`：鑼聲
- `invent_rejected`：輕的否定音
**And** 人龍剩最後 3 人時，計量條的節奏音效加快（補完 Story 2.2）
**And** 音效載入或播放失敗時只記 `log.warn`，靜默跳過，不影響遊戲
**And** 在 Pixel 6a 上連續快速合成時，拖曳仍維持 60 FPS

### Story 7.2: 背景音樂、叫賣語音與靜音設定

As a 玩家,
I want 有循環播放的夜市環境音樂，新一波客人來和完售時聽到叫賣，也可以把聲音關掉,
So that 我在通勤時也能安靜地玩。

**Acceptance Criteria:**

**Given** 已有 Story 7.1 的 AudioService
**When** 遊戲在前景
**Then** 背景音樂 `bgm-night-market` 循環播放；App 進入背景時暫停，回到前景時繼續
**And** 新一波人龍開始、完售時，隨機播放 2–3 句叫賣語音的其中一句（FR44）
**And** 在 Story 1.7 的設定畫面加上「音樂」和「音效」兩個開關，設定存在 `merge-night-market/settings`，不寫進遊戲存檔；重新啟動後設定不變
**And** 所有音訊素材都確認是可商用的授權，授權來源記錄在 `art-source/LICENSES.md`

### Story 7.3: 數據埋點（PostHog）

As a 開發者,
I want 匿名收集攤位、完售、發明、提示、升星、廣告等事件，並計算留存,
So that 封閉測試和上架後，我知道玩家在哪裡卡住、為什麼沒有回來。

**Acceptance Criteria:**

**Given** `src/services/telemetry.ts` 與 `telemetry.web.ts`（no-op），使用 posthog-react-native 4.85
**When** App 首幀之後完成初始化
**Then** Telemetry 訂閱 GameEvent，用同樣的 `type` 名稱送到 PostHog，屬性維持扁平結構（FR45）
**And** 另外補送 `app_open`（附上距離首次啟動的天數）、`tutorial_step`、`ad_shown`、`ad_rewarded`，用來支援 D1/D7/D30 留存，以及「第 1 天第一次升級率」「第 3 天首次發明率」「每位 DAU 每日看廣告數」這些 GDD 指標
**And** 關閉自動擷取（screen、觸控）；只使用匿名 ID，不收集任何個資
**And** 離線時由 SDK 暫存，連上網路後批次送出；初始化失敗時靜默降級
**And** API key 從 `extra.posthogKey` 讀取；development profile 預設不送出，或送到獨立的測試專案
**And** 在 PostHog 建好留存與漏斗報表，報表連結記錄在 README

### Story 7.4: 崩潰回報（Sentry）

As a 開發者,
I want 正式版的崩潰和錯誤都會回報到 Sentry，附上可讀的堆疊和崩潰前的操作軌跡,
So that 我能量測 crash-free sessions 是否 ≥ 99.5%，並修掉真正的問題。

**Acceptance Criteria:**

**Given** `src/services/crash.ts` 與 `crash.web.ts`，使用 @sentry/react-native 8.34 的 config plugin
**When** 首幀之後完成初始化
**Then** 全域例外、未處理的 Promise rejection、ErrorBoundary 攔下的錯誤都會回報；`log.warn` 以上的訊息會記成 breadcrumb，`log.error` 會送出 event
**And** EAS build 與 update 會上傳 source map，release 名稱對應 build 與 update，Sentry 上的堆疊可以讀
**And** 已開啟 release health，能看到 crash-free sessions（NFR4）
**And** DSN 從 `extra.sentryDsn` 讀取；development profile 不送出
**And** 在 preview build 用除錯面板故意觸發一次崩潰，Sentry 上能看到可讀的堆疊

### Story 7.5: 封閉測試與平衡調整

As a 開發者,
I want 在 W10 讓測試者玩 preview build，用數據校正金幣、體力和訂單的平衡,
So that 2 週左右走完 MVP 內容的節奏，是被實際驗證過的。

**Acceptance Criteria:**

**Given** 一個發給測試者的 preview build（iOS TestFlight、Android 內部測試軌）
**When** 封閉測試開始
**Then** 用封測數據校正 S1.6 產出的「各玩家等級每單期望金幣」表（`docs/balance.md`），記錄實測值與模擬值的差距
**And** 依 PostHog 指標評估以下項目：第 1 天第一次升級率（目標 ≥ 80%）、第 3 天首次發明率（≥ 50%）、前 3 天是否卡在體力、單次遊玩 3–6 分鐘
**And** 只修改 `src/game/content/balance.ts` 等內容常數，每次調整都記錄原因；修改後以 OTA（preview channel）推送
**And** 金幣總消耗約 9,900、約 2 週走完的假設，要被確認或修正，結果回寫到 GDD 的假設索引
**And** 確認遊戲沒有失敗狀態（NFR12）。`deadlock-test.ts` 以規則層函式驗證下列情境都還有出路：
- 棋盤 56 格全滿（含 5 個產生器）、體力 0、金幣 0：至少有一個品項可以賣出，或至少一張訂單可以出單
- 棋盤全滿，而且沒有任何品項符合訂單：可以賣出品項來空出格子
- 棋盤全滿，還有待放的產生器：賣出一格後產生器會被放上棋盤
- 唯一的貴客單指定的發明菜不在棋盤上：其他兩張訂單照常可做，人龍仍然可以消化
- 線索單占用貴客上限：可以用「請客人先走」移除

### Story 7.6: 效能最終驗收

As a 玩家,
I want 在中階手機上拖曳流暢、開啟夠快、切換畫面不卡,
So that 這款遊戲在我的手機上玩起來很舒服。

**Acceptance Criteria:**

**Given** 功能已凍結的 release build
**When** 依架構文件的 Performance Measurement Method，在 Pixel 6a 上量測
**Then** 拖曳與夜市街平均 ≥ 58 FPS，掉幀 ≤ 5%（NFR1）；冷啟動 ≤ 3,000 ms（NFR2）；切換 ≤ 300 ms（NFR3）；記憶體 ≤ Spike A 基準的 +20%
**And** 用 Xcode Instruments 在 iOS 上抽查一次 Time Profiler 與 Core Animation FPS
**And** 未達標的項目要修正後重新量測，結果記錄在驗收報告中

### Story 7.7: 商店素材與正式送審

As a 開發者,
I want 準備好商店素材與隱私揭露，用 EAS 建置並送審兩個平台,
So that 玩家可以在 App Store 和 Google Play 下載夜市合成。

**Acceptance Criteria:**

**Given** 已通過 Story 7.6 的 release build
**When** 準備上架
**Then** 備齊截圖（各平台要求的尺寸）、短影片、繁體中文描述，以及託管在公開網址的隱私權政策
**And** 依實際使用的 AdMob、PostHog、Sentry，填寫 App Store 隱私營養標籤與 Google Play Data safety；ATT 文案與實際行為一致
**And** 送審前執行全域檢查：`src/` 內 `TODO(content)` 的數量為 0，`docs/art-manifest.md` 的 54 列全部是「定稿」
**And** 用 `npx eas-cli@latest build --profile production` 建置兩個平台，再用 `eas submit` 送審（NFR11）；production 使用正式的 ad unit ID，沒有除錯入口
**And** 送審前確認 App 名稱沒有商標衝突（DESIGN.md 中待確認的事項）
**And** Epic 7 完成定義：兩個平台都已送審。被退件時另開 story 處理，上架結果記入 retro
