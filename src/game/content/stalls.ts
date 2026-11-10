// 遊戲內容：攤位與老闆（FR16）。文字依 docs/content.md 第 1 節定稿（S1.0）。
import type { ChainId } from './chains';

export type OwnerDef = {
  name: string;
  /** 一句人設 */
  persona: string;
};

export type StallDef = {
  id: ChainId;
  name: string;
  owner: OwnerDef;
  /** 占位外觀用的主色；正式美術到位後改用圖片（art-manifest#2–21） */
  color: string;
  /** 霓虹招牌的顏色 */
  neon: string;
  /**
   * 重開需要的金幣（FR10）；null 代表開局就開著（手搖飲、炸物）。
   * 玩家等級門檻沿用 CHAINS[c].unlockLevel（RC-1）。
   */
  reopenCoins: number | null;
  /** 升級需要的金幣（FR12）。Lv3 另外需要 1 份含該鏈的發明菜（S3.5）。 */
  upgradeCoins: { 2: number; 3: number };
};

export const STALLS = {
  tea: {
    id: 'tea',
    name: '手搖飲吧台',
    owner: { name: '阿珍', persona: '搖了二十年飲料，熟客的冰塊甜度不用開口，她都記得。' },
    color: '#5B3A29',
    neon: '#00F5D4',
    reopenCoins: null,
    upgradeCoins: { 2: 200, 3: 600 },
  },
  fried: {
    id: 'fried',
    name: '炸物鍋',
    owner: { name: '阿炮', persona: '油溫靠耳朵聽，講話跟油鍋一樣劈哩啪啦停不下來。' },
    color: '#7A2E1F',
    neon: '#FFBE0B',
    reopenCoins: null,
    upgradeCoins: { 2: 200, 3: 600 },
  },
  noodle: {
    id: 'noodle',
    name: '麵線大鍋',
    owner: { name: '林嬸', persona: '攤子關了三年，每天清晨照樣熬湯，等有人幫她拉起鐵捲門。' },
    color: '#3D405B',
    neon: '#FF006E',
    reopenCoins: 300,
    upgradeCoins: { 2: 400, 3: 1000 },
  },
  dumpling: {
    id: 'dumpling',
    name: '蒸籠台',
    owner: { name: '老王', persona: '退休的飯店點心師傅，小籠包一定要捏滿十八摺。' },
    color: '#2F4F4F',
    neon: '#8338EC',
    reopenCoins: 600,
    upgradeCoins: { 2: 600, 3: 1500 },
  },
  sweet: {
    id: 'sweet',
    name: '甜品車',
    owner: { name: '小葵', persona: '剛畢業的甜點系女生，推著餐車，想讓夜市的最後一口是甜的。' },
    color: '#6D2E46',
    neon: '#FB5607',
    reopenCoins: 1000,
    upgradeCoins: { 2: 900, 3: 2000 },
  },
} as const satisfies Record<ChainId, StallDef>;
