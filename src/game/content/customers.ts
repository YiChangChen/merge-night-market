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
