import { Image } from 'expo-image';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardStars, madeToNextStar } from '@/game/cards';
import { CARDS_BY_RECIPE, RECIPES_BY_ID, type RecipeId, STALLS } from '@/game/content';
import type { InventionState } from '@/game/types';

import { CardView } from './card-view';

type Props = {
  recipe: RecipeId;
  invention: InventionState;
  cardWidth: number;
  onClose: () => void;
};

/** 收藏冊的卡牌詳情（S5.2）：大卡、故事、老闆、製作次數、下一顆星還差幾份。 */
export function CardDetail({ recipe, invention, cardWidth, onClose }: Props) {
  // Android 返回鍵先關詳情，回到網格（不關掉整個收藏冊）
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const card = CARDS_BY_RECIPE[recipe];
  const owner = STALLS[card.owner];
  const stars = cardStars(invention.made);
  const remaining = madeToNextStar(invention.made);

  return (
    <View testID="card-detail" style={styles.backdrop} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.content}>
        <CardView recipe={recipe} invention={invention} width={cardWidth} />
        <View style={styles.owner}>
          <Image source={owner.art.owner} contentFit="contain" style={styles.avatar} />
          <View style={styles.ownerText}>
            <Text style={styles.name}>{RECIPES_BY_ID[recipe].name}</Text>
            <Text style={styles.ownerName}>
              {owner.owner.name}・{owner.name}
            </Text>
          </View>
        </View>
        <Text testID="card-story" style={styles.story}>
          {card.story}
        </Text>
        <Text testID="card-made" style={styles.made}>
          已製作 {invention.made} 份
        </Text>
        <Text testID="card-next-star" style={styles.next}>
          {remaining === null ? '已滿星！' : `再做 ${remaining} 份升到 ★${stars + 1}`}
        </Text>
        <Pressable
          testID="close-card-detail"
          accessibilityRole="button"
          accessibilityLabel="回到收藏冊"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <Text style={styles.closeText}>回到收藏冊</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(6, 12, 30, 0.96)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 14,
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D2B55',
  },
  ownerText: {
    flex: 1,
  },
  name: {
    color: '#FFD966',
    fontSize: 20,
    fontWeight: '800',
  },
  ownerName: {
    color: '#C9D3EE',
    fontSize: 14,
    marginTop: 2,
  },
  story: {
    alignSelf: 'stretch',
    color: '#F2F4FA',
    fontSize: 15,
    lineHeight: 23,
  },
  made: {
    color: '#C9D3EE',
    fontSize: 14,
  },
  next: {
    color: '#FFD23F',
    fontSize: 16,
    fontWeight: '700',
  },
  close: {
    minHeight: 44,
    minWidth: 160,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: '#FFD966',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  closeText: {
    color: '#3A2A1A',
    fontSize: 16,
    fontWeight: '800',
  },
});
