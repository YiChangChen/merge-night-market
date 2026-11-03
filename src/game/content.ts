// 遊戲內容與數值。emoji 是正式美術完成前的佔位圖。

export type ChainId = 'tea' | 'fried' | 'noodle' | 'dumpling' | 'sweet';

export type ItemDef = { name: string; emoji: string };

export type ChainDef = {
  id: ChainId;
  generatorName: string;
  generatorEmoji: string | number;
  unlockLevel: number;
  items: ItemDef[];
};

export const CHAINS: Record<ChainId, ChainDef> = {
  tea: {
    id: 'tea',
    generatorName: '手搖飲吧台',
    generatorEmoji: require('../../assets/images/test.png'),
    unlockLevel: 1,
    items: [
      { name: '茶葉', emoji: '🍃' },
      { name: '熱茶', emoji: '🍵' },
      { name: '紅茶', emoji: '🫖' },
      { name: '鮮奶茶', emoji: '🥛' },
      { name: '珍珠奶茶', emoji: '🧋' },
      { name: '水果茶', emoji: '🍹' },
      { name: '招牌特調', emoji: '🥤' },
    ],
  },
  fried: {
    id: 'fried',
    generatorName: '炸物鍋',
    generatorEmoji: require('../../assets/images/fried.png'),
    unlockLevel: 1,
    items: [
      { name: '地瓜粉', emoji: '🌾' },
      { name: '生雞肉', emoji: '🐔' },
      { name: '鹽酥雞', emoji: '🍗' },
      { name: '大雞排', emoji: '🍖' },
      { name: '炸物拼盤', emoji: '🍟' },
      { name: '雞排便當', emoji: '🍱' },
    ],
  },
  noodle: {
    id: 'noodle',
    generatorName: '麵線大鍋',
    generatorEmoji: require('../../assets/images/noodle.png'),
    unlockLevel: 3,
    items: [
      { name: '蔥花', emoji: '🌱' },
      { name: '蚵仔', emoji: '🦪' },
      { name: '麵線', emoji: '🍝' },
      { name: '蚵仔麵線', emoji: '🍜' },
      { name: '大腸麵線', emoji: '🥘' },
      { name: '總匯麵線', emoji: '🏮' },
    ],
  },
  dumpling: {
    id: 'dumpling',
    generatorName: '蒸籠台',
    generatorEmoji: require('../../assets/images/dumpling.png'),
    unlockLevel: 5,
    items: [
      { name: '麵糰', emoji: '🫓' },
      { name: '肉餡', emoji: '🥩' },
      { name: '水餃', emoji: '🥟' },
      { name: '煎餃', emoji: '🍘' },
      { name: '小籠包', emoji: '🧆' },
      { name: '蒸籠拼盤', emoji: '🎍' },
    ],
  },
  sweet: {
    id: 'sweet',
    generatorName: '甜品車',
    generatorEmoji: require('../../assets/images/sweet.png'),
    unlockLevel: 7,
    items: [
      { name: '地瓜', emoji: '🍠' },
      { name: '地瓜球', emoji: '🟠' },
      { name: '雞蛋糕', emoji: '🧁' },
      { name: '糖葫蘆', emoji: '🍡' },
      { name: '芒果冰', emoji: '🍧' },
      { name: '綜合冰', emoji: '🍨' },
      { name: '夜市甜點塔', emoji: '🎂' },
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
