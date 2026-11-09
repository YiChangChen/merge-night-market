import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CHAINS, type CustomerDef } from '@/game/content';
import type { Requirement } from '@/game/engine';

// 客人圖的原始尺寸；最寬的人物約 295 寬，兩側留白是透明的
const ART_WIDTH = 340;
const ART_HEIGHT = 258;
const WIDEST_CUSTOMER = 295;

// 讓最寬的人物剛好填滿一格，圖片的透明留白可以超出格子
export function customerArtSize(slotWidth: number) {
  const width = Math.floor((slotWidth * ART_WIDTH) / WIDEST_CUSTOMER);
  return { width, height: Math.floor((width * ART_HEIGHT) / ART_WIDTH) };
}

// 客人圖裡已經畫了托盤，且都對齊在圖片底部中央，食物只要疊在同一個位置
export function CustomerTray({
  customer,
  requirements,
  width,
  height,
}: {
  customer: CustomerDef;
  requirements: Requirement[];
  width: number;
  height: number;
}) {
  // 托盤不寬，兩樣食物要縮小才放得下
  const foodSize = Math.round(height * (requirements.length > 1 ? 0.3 : 0.4));
  const foodPosition = { bottom: Math.round(height * 0.02) };
  return (
    <View style={[styles.scene, { height }]}>
      <Image
        source={customer.art}
        contentFit="contain"
        draggable={false}
        style={{ width, height }}
      />
      <View style={[styles.food, foodPosition]}>
        {requirements.map((requirement, index) => (
          <Image
            key={index}
            source={CHAINS[requirement.chain].items[requirement.level - 1].art}
            contentFit="contain"
            draggable={false}
            style={{ width: foodSize, height: foodSize }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  food: {
    position: 'absolute',
    flexDirection: 'row',
  },
});
