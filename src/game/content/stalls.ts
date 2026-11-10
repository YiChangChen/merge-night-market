// 遊戲內容：攤位與老闆（FR16）。文字依 docs/content.md 第 1 節定稿（S1.0）。
import type { ChainId } from './chains';

export type OwnerDef = {
  name: string;
  /** 一句人設 */
  persona: string;
};

/** 攤位美術（art-manifest E1 批次，S1.10 定稿）。require 回傳的是素材 id。 */
export type StallArt = {
  /** 依等級的外觀：[鐵捲門, Lv1 小攤, Lv2 店面, Lv3 大店] */
  facade: readonly [number, number, number, number];
  /** 霓虹招牌三段圖層（同一張畫布）：Lv1 亮第 1 段、Lv2 亮 1–2 段、Lv3 全亮 */
  neon: readonly [number, number, number];
  /** 老闆頭像 */
  owner: number;
};

export type StallDef = {
  id: ChainId;
  name: string;
  owner: OwnerDef;
  /** 攤位主色（面板、頭像外框等點綴用） */
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
  art: StallArt;
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
    art: {
      facade: [
        require('../../../assets/images/stalls/tea/shutter.webp'),
        require('../../../assets/images/stalls/tea/lv1.webp'),
        require('../../../assets/images/stalls/tea/lv2.webp'),
        require('../../../assets/images/stalls/tea/lv3.webp'),
      ],
      neon: [
        require('../../../assets/images/stalls/tea/neon-1.webp'),
        require('../../../assets/images/stalls/tea/neon-2.webp'),
        require('../../../assets/images/stalls/tea/neon-3.webp'),
      ],
      owner: require('../../../assets/images/owners/tea.webp'),
    },
  },
  fried: {
    id: 'fried',
    name: '炸物鍋',
    owner: { name: '阿炮', persona: '油溫靠耳朵聽，講話跟油鍋一樣劈哩啪啦停不下來。' },
    color: '#7A2E1F',
    neon: '#FFBE0B',
    reopenCoins: null,
    upgradeCoins: { 2: 200, 3: 600 },
    art: {
      facade: [
        require('../../../assets/images/stalls/fried/shutter.webp'),
        require('../../../assets/images/stalls/fried/lv1.webp'),
        require('../../../assets/images/stalls/fried/lv2.webp'),
        require('../../../assets/images/stalls/fried/lv3.webp'),
      ],
      neon: [
        require('../../../assets/images/stalls/fried/neon-1.webp'),
        require('../../../assets/images/stalls/fried/neon-2.webp'),
        require('../../../assets/images/stalls/fried/neon-3.webp'),
      ],
      owner: require('../../../assets/images/owners/fried.webp'),
    },
  },
  noodle: {
    id: 'noodle',
    name: '麵線大鍋',
    owner: { name: '林嬸', persona: '攤子關了三年，每天清晨照樣熬湯，等有人幫她拉起鐵捲門。' },
    color: '#3D405B',
    neon: '#FF006E',
    reopenCoins: 300,
    upgradeCoins: { 2: 400, 3: 1000 },
    art: {
      facade: [
        require('../../../assets/images/stalls/noodle/shutter.webp'),
        require('../../../assets/images/stalls/noodle/lv1.webp'),
        require('../../../assets/images/stalls/noodle/lv2.webp'),
        require('../../../assets/images/stalls/noodle/lv3.webp'),
      ],
      neon: [
        require('../../../assets/images/stalls/noodle/neon-1.webp'),
        require('../../../assets/images/stalls/noodle/neon-2.webp'),
        require('../../../assets/images/stalls/noodle/neon-3.webp'),
      ],
      owner: require('../../../assets/images/owners/noodle.webp'),
    },
  },
  dumpling: {
    id: 'dumpling',
    name: '蒸籠台',
    owner: { name: '老王', persona: '退休的飯店點心師傅，小籠包一定要捏滿十八摺。' },
    color: '#2F4F4F',
    neon: '#8338EC',
    reopenCoins: 600,
    upgradeCoins: { 2: 600, 3: 1500 },
    art: {
      facade: [
        require('../../../assets/images/stalls/dumpling/shutter.webp'),
        require('../../../assets/images/stalls/dumpling/lv1.webp'),
        require('../../../assets/images/stalls/dumpling/lv2.webp'),
        require('../../../assets/images/stalls/dumpling/lv3.webp'),
      ],
      neon: [
        require('../../../assets/images/stalls/dumpling/neon-1.webp'),
        require('../../../assets/images/stalls/dumpling/neon-2.webp'),
        require('../../../assets/images/stalls/dumpling/neon-3.webp'),
      ],
      owner: require('../../../assets/images/owners/dumpling.webp'),
    },
  },
  sweet: {
    id: 'sweet',
    name: '甜品車',
    owner: { name: '小葵', persona: '剛畢業的甜點系女生，推著餐車，想讓夜市的最後一口是甜的。' },
    color: '#6D2E46',
    neon: '#FB5607',
    reopenCoins: 1000,
    upgradeCoins: { 2: 900, 3: 2000 },
    art: {
      facade: [
        require('../../../assets/images/stalls/sweet/shutter.webp'),
        require('../../../assets/images/stalls/sweet/lv1.webp'),
        require('../../../assets/images/stalls/sweet/lv2.webp'),
        require('../../../assets/images/stalls/sweet/lv3.webp'),
      ],
      neon: [
        require('../../../assets/images/stalls/sweet/neon-1.webp'),
        require('../../../assets/images/stalls/sweet/neon-2.webp'),
        require('../../../assets/images/stalls/sweet/neon-3.webp'),
      ],
      owner: require('../../../assets/images/owners/sweet.webp'),
    },
  },
} as const satisfies Record<ChainId, StallDef>;
