## Implementation Patterns

以下模式用來確保所有 AI agent 寫出的程式碼彼此一致、可以互相銜接。

### Novel Patterns

#### NP-1 拖放解析（Drop Resolution）

**目的：** 一次拖放只會產生 5 種結果之一，而且判定只在一個地方做。這樣 UI 動畫、阿嬤保底和埋點看到的結果才會一致。

**元件：**
- `resolveDrop(state, from, to)`：純函式，只判定結果，不改 state。
- `applyDrop(state, from, to, now)`：依照判定結果套用變更，並 push 對應的事件。
- `board.tsx`：落子時呼叫 `apply(s => applyDrop(s, from, to, Date.now()))`，再依事件播放動畫。

**判定順序（由上往下，先命中的優先）：**

| # | 條件 | 結果 | 事件 |
|---|---|---|---|
| 1 | 目標是空格 | `move` | — |
| 2 | 同一條鏈、同一階、未達最高階 | `merge` | `item_merged` |
| 3 | 兩邊都是同一道發明菜，且目標格未滿 3 份 | `stack`：目標格最多到 3 份，多出的留在來源格 | — |
| 4 | 兩邊是不同鏈的品項，`(A,B)` 剛好是某道配方，而且該配方的兩個攤位都已達 Lv2 | `invent` | `dish_invented`（帶 `first` 旗標） |
| 5 | 兩邊都是品項，各自都是某道「兩攤皆達 Lv2」的配方材料，但兩者湊不成同一道配方 | `reject`：不消耗任何東西，播放彈回動畫 | `invent_rejected`（帶受影響的配方） |
| 6 | 其他情況 | `swap` | — |

```ts
export type DropResult =
  | { kind: 'move' } | { kind: 'swap' }
  | { kind: 'merge'; chain: ChainId; level: number }
  | { kind: 'stack'; moved: number }
  | { kind: 'invent'; recipe: RecipeId }
  | { kind: 'reject'; affected: RecipeId[] };

// 材料比對不分拖曳方向
function findRecipe(a: ItemPiece, b: ItemPiece): RecipeDef | undefined {
  return RECIPES.find((r) =>
    (matches(r.a, a) && matches(r.b, b)) || (matches(r.a, b) && matches(r.b, a)));
}
```

**邊界情況：**
- 產生器不參與合成或發明，碰到時一律走 `swap`。
- 已經發現過的配方仍然可以 `invent`，用來製作更多份並累計星等，事件的 `first` 為 false。
- 第 5 項的 `affected`：所有尚未發現、兩攤都已達 Lv2、且材料包含兩個品項其中至少一個的配方。這份清單交給 NP-3 使用。

#### NP-2 人龍波次（Queue Wave）

**目的：** 把「攤位實力」轉換成看得見的波次。完售、冷卻、波中升級和時鐘倒退都要有明確的規則。

**狀態機：**

```
        開新波（length = capacity(state)）
  ┌─────────────────────────────────────┐
  ▼                                     │
ACTIVE（remaining > 0, cooldownEndsAt = null）
  │  completeOrder → remaining − 1
  │  reopen/upgrade 攤位 → length、remaining 同時 + Δ（上限 20）
  ▼ remaining == 0
SOLD_OUT → 發放完售獎勵，寫入 lastSellout，cooldownEndsAt = now + 3 分鐘，事件 queue_sold_out
  ▼
COOLDOWN（cooldownEndsAt ≠ null）
  │  訂單照常可以完成，只給基本獎勵，不計入人龍
  │  升級攤位不影響目前狀態（下一波開始時重算 length）
  ▼ syncQueue：now ≥ cooldownEndsAt
開新波：wave + 1，清除 lastSellout
```

```ts
export function queueCapacity(state: GameState): number {
  const levels = sumOpenStallLevels(state);
  return Math.min(BALANCE.queueBase + BALANCE.queuePerLevel * levels, BALANCE.queueMax)
    + state.queue.bonus;
}

// 在 reopenStall / upgradeStall 的最後呼叫：波中立刻加長
export function growActiveWave(state: GameState): GameState {
  const q = state.queue;
  if (q.cooldownEndsAt !== null) return state;
  const delta = Math.max(0, queueCapacity(state) - q.length);
  return delta === 0 ? state
    : { ...state, queue: { ...q, length: q.length + delta, remaining: q.remaining + delta } };
}
```

**規則：**
- 完售獎勵以本波的**最終** `length` 計算（金幣 5 × length、體力 +10、XP + length）。
- 時鐘倒退時，`cooldownEndsAt − now` 不得超過 3 分鐘；超過就截成 `now + 3 分鐘`，冷卻不會被拉長。
- 人龍頭像分配到各攤的方式，由 `distributeQueue(state)` 依各攤等級比例決定。這是純函式，畫面只負責畫出來。

#### NP-3 阿嬤保底計數（Pity Counter）

**目的：** 讓玩家「亂合也不會卡關」。每次被拒絕的發明嘗試，會同時替多道配方累計失敗次數，第 5 次時給出直白提示。

**資料流：** `applyDrop` 判定為 `reject` → 對 `affected` 裡的每道配方執行 `inventions[r].failures += 1` → 如果某道配方的 `failures ≥ 5` 且不在 `meta.hintedRecipes` 裡 → 把它加入 `hintedRecipes`，並 push `hint_shown` → `FxController` 顯示阿嬤，說出兩個材料名稱。

```ts
function recordRejection(state: GameState, affected: RecipeId[]): GameState {
  let next = state;
  for (const id of affected) {
    const rec = next.inventions[id] ?? EMPTY_INVENTION;
    next = setInvention(next, id, { ...rec, failures: rec.failures + 1 });
    if (rec.failures + 1 >= BALANCE.hintAfterFailures && !next.meta.hintedRecipes.includes(id)) {
      next = withEvent(addHinted(next, id), { type: 'hint_shown', recipe: id });
    }
  }
  return next;
}
```

**規則：**
- 每道配方的提示只出現一次。
- 教學提示（手搖飲與炸物兩攤都升到 Lv2 時，阿嬤說出配方 #1）走同一條路徑：直接把 `'tea-fried'` 加入 `hintedRecipes`，並 push 同一個事件。
- 配方被發現之後，不再累計失敗次數。

#### NP-4 激勵廣告交易（Ad Reward Transaction）

**目的：** 只有真正看完廣告才發獎勵，而且不能重複領取。每日上限一律由規則引擎判斷，UI 不自行判斷。

**流程：**

```
UI 按鈕可見條件 = canWatchAd(state, placement)   // 規則層：每日上限、體力不足、lastSellout 未加倍
               && ads.isReady(placement)         // 服務層：已載入、有網路
點擊 → await ads.show(placement)
  'earned'      → apply(s => grantAdReward(s, placement, Date.now()))
  'dismissed'   → 不做任何事
  'unavailable' → 不做任何事（按鈕會因為 isReady 變成 false 而自動隱藏）
```

```ts
export function grantAdReward(state: GameState, placement: Placement, now: number): GameState {
  const s = syncDaily(state, now);
  if (!canWatchAd(s, placement)) return s;            // 重複呼叫是安全的
  if (placement === 'energy') {
    return withEvent(
      { ...s, energy: s.energy + BALANCE.adEnergy, daily: { ...s.daily, adEnergyUsed: s.daily.adEnergyUsed + 1 } },
      { type: 'ad_rewarded', placement });
  }
  const sellout = s.lastSellout!;                     // canWatchAd 已確認存在且尚未加倍
  return withEvent(
    { ...s, coins: s.coins + sellout.coins, energy: s.energy + sellout.energy, xp: s.xp + sellout.xp,
      lastSellout: { ...sellout, doubled: true },
      daily: { ...s.daily, adDoubleUsed: s.daily.adDoubleUsed + 1 } },
    { type: 'ad_rewarded', placement });
}
```

- 完售加倍會把整份完售獎勵（金幣、體力、XP）再發一次。只能在下一波開始之前領取，每一波最多一次。
- 因此 GameState v2 要新增欄位：`lastSellout: { wave: number; coins: number; energy: number; xp: number; doubled: boolean } | null`。
- 獎勵發放的唯一入口是 `grantAdReward`。UI 不得自行加金幣或體力。

### Communication Patterns

**模式：** 狀態往下流（selector 訂閱），意圖往上走（`apply(action)`），副作用往外送（GameEvent）。元件之間不互相 import，也不互相呼叫。

```ts
// 讀
const level = useGameStore((s) => s.state?.stalls[stall].level ?? 0);
// 寫
const apply = useGameStore((s) => s.apply);
onPress={() => apply((s) => upgradeStall(s, stall, Date.now()))}
// 副作用（只在服務或 FxController 裡）
gameEvents.subscribe((e) => e.type === 'stall_upgraded' && audio.play('neon-hum'));
```

### Entity Patterns

**建立方式：** 只能透過規則層的工廠函式建立。工廠函式回傳 `[piece, nextState]`，並由它遞增 `nextId`。元件和服務一律不得自己組 Piece 物件。

```ts
export function createDish(state: GameState, recipe: RecipeId): [DishPiece, GameState] {
  return [{ id: state.nextId, kind: 'dish', recipe, count: 1 }, { ...state, nextId: state.nextId + 1 }];
}
```

- 棋盤格子一律用 `index = row * 7 + col` 表示，沿用 `BALANCE.boardColumns`。
- 合成會產生新的 id，舊的 id 就消失，`findMerges` 和動畫都依賴這個行為。疊加（stack）則保留目標格原本的 id。

### State Patterns

**模式：** 用明確的欄位表示狀態，不用布林旗標組合。生命週期寫成狀態機（例如 NP-2），以純函式推進。

- 攤位用 `level: 0 | 1 | 2 | 3` 表示，0 代表鐵捲門。不另設 `open` 布林值。
- 訂單用 `kind: 'normal' | 'vip' | 'clue'` 表示；線索單另有 `expiresAt`。
- 會受時間影響的規則函式，`now` 一律放在**最後一個參數**。函式內不得呼叫 `Date.now()` 或 `Math.random()`；隨機數一律走 `random.ts` 的 seeded RNG。
- 不得把衍生值寫進 state（見 ADR-05）。

```ts
// ✅ 正確
export function reopenStall(state: GameState, stall: StallId, now: number): GameState
// ❌ 錯誤：內部取時間、用布林旗標
export function reopenStall(state: GameState, stall: StallId) { const now = Date.now(); state.stalls[stall].open = true; }
```

### Data Patterns

**存取方式：** 內容與數值一律從 `@/game/content` 的常數表讀取，並透過查詢函式取得，不得在元件或服務裡寫死數字。

```ts
import { STALLS, RECIPES, BALANCE } from '@/game/content';
export const upgradeCost = (state: GameState, stall: StallId) => STALLS[stall].levels[state.stalls[stall].level + 1];
```

- 素材只能透過內容表裡的 `art` 欄位取得，元件不得自行 `require` 圖片。
- 在規則層中，state 一律以 immutable spread 更新，不得直接改寫原物件。

### React / Reanimated Patterns（承接 Engine & Framework 的交接事項）

- render 階段不讀 shared value。新程式碼使用 `.get()` / `.set()`；既有 worklet 裡的 `.value` 不需要改寫。
- 從 worklet 回到 JS 一律使用 `scheduleOnRN`（`react-native-worklets`），沿用 `board.tsx` 的寫法。
- React Compiler 造成問題的元件，在檔案頂部加上 `'use no memo'`，並註明原因。
- 畫面元件中的循環動畫（霓虹、熱氣、人龍），在所在分頁失焦時要暫停（用 `useIsFocused`）。
- 修改手勢或動畫之後，必須在實機上重新測試拖曳 FPS。

### Consistency Rules

| 模式 | 慣例 | 強制方式 |
|---|---|---|
| 分層 import | 依照 Architectural Boundaries 表 | ESLint `no-restricted-imports` |
| 時間與隨機 | 規則層不得出現 `Date.now()` 或 `Math.random()` | ESLint `no-restricted-syntax`（只套用在 `src/game/**`） |
| 規則函式簽名 | `(state, ...args, now?) => state`，遇到不合法操作時回傳原本的 state | Code review 與單元測試 |
| 日誌 | 只用 `log.*`，熱路徑不寫 log | ESLint `no-console` |
| 事件命名 | snake_case 過去式，型別定義在 `events.ts` | TypeScript union |
| 拖放判定 | 只在 `resolveDrop` 判定 | Code review；`drop-test.ts` 窮舉測試 |
| 獎勵發放 | 金幣、體力、XP 只能在規則層增加 | Code review |
| 廣告獎勵 | 只在 `grantAdReward` 發放 | Code review |
| 存檔變更 | GameState 形狀改變時，必須同時遞增 version、新增 migration、新增 fixture | `migration-test.ts` |
| 內容完整性 | 配方、卡牌、素材一一對應 | `content-test.ts` |
| 套件安裝 | 一律使用 `npx expo install`；原生依賴改變時必須重建開發版 | AGENTS.md |
| 完成定義 | `npx expo lint`、`npx tsc --noEmit`、`npx jest` 全部通過 | AGENTS.md |
