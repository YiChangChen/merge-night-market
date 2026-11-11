// 遊戲內容：客人。

export type CustomerDef = { name: string; art: number };

export const CUSTOMERS: CustomerDef[] = [
  { name: '學生', art: require('../../../assets/images/customers/student.png') },
  { name: '上班族', art: require('../../../assets/images/customers/office-worker.png') },
  { name: '阿嬤', art: require('../../../assets/images/customers/grandma.png') },
  { name: '觀光客', art: require('../../../assets/images/customers/tourist.png') },
  { name: '阿伯', art: require('../../../assets/images/customers/uncle.png') },
  { name: '小姐', art: require('../../../assets/images/customers/young-woman.png') },
  { name: '8+9', art: require('../../../assets/images/customers/street-punk.png') },
  { name: '收保護費的', art: require('../../../assets/images/customers/collector.png') },
  { name: '富豪', art: require('../../../assets/images/customers/tycoon.png') },
  { name: 'YouTuber', art: require('../../../assets/images/customers/streamer.png') },
  { name: '藝人', art: require('../../../assets/images/customers/pop-star.png') },
  { name: '外送員', art: require('../../../assets/images/customers/rider.png') },
];

/**
 * 貴客（S4.3、FR27）：貴客單只從這 3 位挑。沿用一般客人池裡同一張美術；
 * 一般客人池不變，既有存檔的一般單才不會換人。
 */
export const VIP_CUSTOMERS: CustomerDef[] = [
  { name: '富豪', art: require('../../../assets/images/customers/tycoon.png') },
  { name: '藝人', art: require('../../../assets/images/customers/pop-star.png') },
  { name: 'YouTuber', art: require('../../../assets/images/customers/streamer.png') },
];
