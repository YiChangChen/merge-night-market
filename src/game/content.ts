// 遊戲內容與數值。

export type ChainId = 'tea' | 'fried' | 'noodle' | 'dumpling' | 'sweet';

export type ItemDef = { name: string; art: number };

export type ChainDef = {
  id: ChainId;
  generatorName: string;
  generatorArt: number;
  unlockLevel: number;
  items: ItemDef[];
};

export type CustomerDef = { name: string; art: number };

export const CUSTOMERS: CustomerDef[] = [
  { name: '學生', art: require('../../assets/images/customers/student.png') },
  { name: '上班族', art: require('../../assets/images/customers/office-worker.png') },
  { name: '阿嬤', art: require('../../assets/images/customers/grandma.png') },
  { name: '觀光客', art: require('../../assets/images/customers/tourist.png') },
  { name: '阿伯', art: require('../../assets/images/customers/uncle.png') },
  { name: '小姐', art: require('../../assets/images/customers/young-woman.png') },
  { name: '8+9', art: require('../../assets/images/customers/street-punk.png') },
  { name: '收保護費的', art: require('../../assets/images/customers/collector.png') },
  { name: '富豪', art: require('../../assets/images/customers/tycoon.png') },
  { name: 'YouTuber', art: require('../../assets/images/customers/streamer.png') },
  { name: '藝人', art: require('../../assets/images/customers/pop-star.png') },
  { name: '外送員', art: require('../../assets/images/customers/rider.png') },
];

export const CHAINS: Record<ChainId, ChainDef> = {
  tea: {
    id: 'tea',
    generatorName: '手搖飲吧台',
    generatorArt: require('../../assets/images/generators/tea.png'),
    unlockLevel: 1,
    items: [
      { name: '茶葉', art: require('../../assets/images/items/tea/leaf.png') },
      { name: '熱茶', art: require('../../assets/images/items/tea/hot-tea.png') },
      { name: '紅茶', art: require('../../assets/images/items/tea/black-tea.png') },
      { name: '鮮奶茶', art: require('../../assets/images/items/tea/milk-tea.png') },
      { name: '珍珠奶茶', art: require('../../assets/images/items/tea/bubble-tea.png') },
      { name: '水果茶', art: require('../../assets/images/items/tea/fruit-tea.png') },
      { name: '招牌特調', art: require('../../assets/images/items/tea/special.png') },
    ],
  },
  fried: {
    id: 'fried',
    generatorName: '炸物鍋',
    generatorArt: require('../../assets/images/generators/fried.png'),
    unlockLevel: 1,
    items: [
      { name: '地瓜粉', art: require('../../assets/images/items/fried/starch.png') },
      { name: '生雞肉', art: require('../../assets/images/items/fried/raw-chicken.png') },
      { name: '鹽酥雞', art: require('../../assets/images/items/fried/popcorn-chicken.png') },
      { name: '大雞排', art: require('../../assets/images/items/fried/cutlet.png') },
      { name: '炸物拼盤', art: require('../../assets/images/items/fried/platter.png') },
      { name: '雞排便當', art: require('../../assets/images/items/fried/bento.png') },
    ],
  },
  noodle: {
    id: 'noodle',
    generatorName: '麵線大鍋',
    generatorArt: require('../../assets/images/generators/noodle.png'),
    unlockLevel: 3,
    items: [
      { name: '蔥花', art: require('../../assets/images/items/noodle/scallion.png') },
      { name: '蚵仔', art: require('../../assets/images/items/noodle/oyster.png') },
      { name: '麵線', art: require('../../assets/images/items/noodle/vermicelli.png') },
      { name: '蚵仔麵線', art: require('../../assets/images/items/noodle/oyster-noodle.png') },
      { name: '大腸麵線', art: require('../../assets/images/items/noodle/intestine-noodle.png') },
      { name: '總匯麵線', art: require('../../assets/images/items/noodle/deluxe-noodle.png') },
    ],
  },
  dumpling: {
    id: 'dumpling',
    generatorName: '蒸籠台',
    generatorArt: require('../../assets/images/generators/dumpling.png'),
    unlockLevel: 5,
    items: [
      { name: '麵糰', art: require('../../assets/images/items/dumpling/dough.png') },
      { name: '肉餡', art: require('../../assets/images/items/dumpling/filling.png') },
      { name: '水餃', art: require('../../assets/images/items/dumpling/boiled.png') },
      { name: '煎餃', art: require('../../assets/images/items/dumpling/potsticker.png') },
      { name: '小籠包', art: require('../../assets/images/items/dumpling/xiaolongbao.png') },
      { name: '蒸籠拼盤', art: require('../../assets/images/items/dumpling/steamer-stack.png') },
    ],
  },
  sweet: {
    id: 'sweet',
    generatorName: '甜品車',
    generatorArt: require('../../assets/images/generators/sweet.png'),
    unlockLevel: 7,
    items: [
      { name: '地瓜', art: require('../../assets/images/items/sweet/sweet-potato.png') },
      { name: '地瓜球', art: require('../../assets/images/items/sweet/sweet-potato-balls.png') },
      { name: '雞蛋糕', art: require('../../assets/images/items/sweet/egg-cake.png') },
      { name: '糖葫蘆', art: require('../../assets/images/items/sweet/tanghulu.png') },
      { name: '芒果冰', art: require('../../assets/images/items/sweet/mango-ice.png') },
      { name: '綜合冰', art: require('../../assets/images/items/sweet/mixed-ice.png') },
      { name: '夜市甜點塔', art: require('../../assets/images/items/sweet/dessert-tower.png') },
    ],
  },
};

export const CHAIN_IDS = Object.keys(CHAINS) as ChainId[];

export const BALANCE = {
  boardColumns: 7,
  boardRows: 8,
  orderSlots: 3,
  maxEnergy: 100,
  energyRegenMs: 2 * 60 * 1000,
  spawnEnergyCost: 1,
  // 產生器有這個機率直接產出 2 階品項
  spawnLevel2Chance: 0.15,
  orderCoinsPerBase: 5,
  // 訂單回補的體力，相對於製作該品項所需基礎品項數的比例
  orderEnergyRefund: 0.3,
  levelUpEnergy: 20,
  twoItemOrderMinLevel: 3,
  twoItemOrderChance: 0.4,
} as const;

export const BOARD_SIZE = BALANCE.boardColumns * BALANCE.boardRows;
