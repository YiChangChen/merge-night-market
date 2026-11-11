// 遊戲內容：10 張發明菜卡牌（FR33）。故事依 docs/content.md 第 4 節定稿（S1.0）；
// 卡面與卡框是 art-manifest E5 批次（#43–#54，2026-11-11 定稿，process-e5-art.py 處理）。
import type { ChainId } from './chains';
import type { RecipeId } from './recipes';

export type CardDef = {
  /** 對應的配方；卡面檔名同配方 id */
  recipe: RecipeId;
  /** 卡面插圖（require 回傳的素材 id），3:4 */
  art: number;
  /** 2–3 句老闆的故事 */
  story: string;
  /** 卡上登場的老闆（同配方的負責老闆），收藏冊詳情顯示他的頭像與名字（S5.2） */
  owner: ChainId;
};

export const CARDS = [
  {
    recipe: 'tea-fried',
    art: require('../../../assets/images/cards/tea-fried.webp'),
    story:
      '阿珍收攤前總會跟隔壁的阿炮換宵夜：一杯紅茶換一包鹽酥雞。熟客看到了也想點，這套「下班套餐」就這樣上了菜單。',
    owner: 'tea',
  },
  {
    recipe: 'tea-noodle',
    art: require('../../../assets/images/cards/tea-noodle.webp'),
    story:
      '林嬸有天湯頭熬淡了，順手借了阿珍的鮮奶茶提香。沒想到客人喝完湯還跑來問：「這個茶味是怎麼來的？」',
    owner: 'noodle',
  },
  {
    recipe: 'fried-noodle',
    art: require('../../../assets/images/cards/fried-noodle.webp'),
    story: '阿炮嫌麵線太軟，直接把剛起鍋的雞排蓋上去。林嬸本來要罵他，吃了一口就沒再說話了。',
    owner: 'fried',
  },
  {
    recipe: 'tea-dumpling',
    art: require('../../../assets/images/cards/tea-dumpling.webp'),
    story: '老王堅持點心要配茶，但年輕人只喝奶茶。他嘆了口氣，從此煎餃旁邊多了一杯鮮奶茶。',
    owner: 'dumpling',
  },
  {
    recipe: 'fried-dumpling',
    art: require('../../../assets/images/cards/fried-dumpling.webp'),
    story: '阿炮和老王為了「炸的好吃還是煎的好吃」吵了一整晚。最後客人說：「那就一盤都給我啊！」',
    owner: 'fried',
  },
  {
    recipe: 'noodle-dumpling',
    art: require('../../../assets/images/cards/noodle-dumpling.webp'),
    story: '林嬸的大腸麵線，加上老王十八摺的小籠包。兩位老師傅聯手，熬出整條街最濃的一碗湯。',
    owner: 'noodle',
  },
  {
    recipe: 'tea-sweet',
    art: require('../../../assets/images/cards/tea-sweet.webp'),
    story:
      '阿珍看小葵的雞蛋糕排隊排到她攤前，乾脆把珍珠包進麵糊裡。小葵說這叫「搶生意」，阿珍說這叫「合作」。',
    owner: 'tea',
  },
  {
    recipe: 'fried-sweet',
    art: require('../../../assets/images/cards/fried-sweet.webp'),
    story:
      '小葵第一天出攤沒人買，阿炮塞了一包鹽酥雞給她當晚餐。她把地瓜球和鹽酥雞拌在一起，發明了甜鹹地瓜雞。',
    owner: 'sweet',
  },
  {
    recipe: 'noodle-sweet',
    art: require('../../../assets/images/cards/noodle-sweet.webp'),
    story: '林嬸說吃完鹹的要解膩，小葵就遞上一串糖葫蘆。一鹹一甜，從此成了收攤前的固定點心。',
    owner: 'sweet',
  },
  {
    recipe: 'dumpling-sweet',
    art: require('../../../assets/images/cards/dumpling-sweet.webp'),
    story:
      '老王一輩子只做熱的點心，直到小葵把芒果冰堆在蒸籠上。熱氣和冰霧一起冒出來的那一刻，老王第一次笑出聲。',
    owner: 'dumpling',
  },
] as const satisfies readonly CardDef[];

export type Card = (typeof CARDS)[number];

export const CARDS_BY_RECIPE = Object.fromEntries(
  CARDS.map((card) => [card.recipe, card])
) as Record<RecipeId, Card>;

/** 卡框（#53、#54）：★5 換成金框（FR34）。和卡面同尺寸，窗口透明，下方名牌由程式寫字。 */
export const CARD_FRAMES: { normal: number; gold: number } = {
  normal: require('../../../assets/images/cards/frame-normal.webp'),
  gold: require('../../../assets/images/cards/frame-gold.webp'),
};

/**
 * 卡面相對整張卡的內縮比例。卡框外形不是方的（燈籠、屋簷凸出），卡面依這個比例放在框後面，
 * 邊緣剛好藏在框條底下（兩種卡框都適用）。必須和 process-e5-art.py 的 FACE_INSET 一致，
 * 換新卡框時由腳本檢查。
 */
export const CARD_FACE_INSET = { left: 0.08, top: 0.06, right: 0.08, bottom: 0.1 } as const;
