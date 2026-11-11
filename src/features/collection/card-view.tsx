import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { cardStars } from '@/game/cards';
import {
  CARD_FACE_INSET,
  CARD_FRAMES,
  CARDS_BY_RECIPE,
  RECIPES_BY_ID,
  type RecipeId,
} from '@/game/content';
import type { InventionState } from '@/game/types';

/** 卡牌的寬高比（卡面與卡框都是 3:4） */
export const CARD_ASPECT = 4 / 3;

export type CardStatus = 'silhouette' | 'clue' | 'discovered';

/** 收藏冊的三種狀態（UX-DR8）：已發現 → 卡面；看過線索 → 剪影＋線索；其他 → 剪影 */
export function cardStatus(invention: InventionState | undefined): CardStatus {
  if (invention?.discovered) return 'discovered';
  return invention?.clueSeen ? 'clue' : 'silhouette';
}

/** 星等限制在 0–5 的整數（E5 code review：範圍外的值不能讓畫面崩潰） */
const clampStars = (stars: number) => Math.max(0, Math.min(5, Math.trunc(stars) || 0));

/** 「★★★☆☆」 */
export function starText(stars: number): string {
  const shown = clampStars(stars);
  return '★'.repeat(shown) + '☆'.repeat(5 - shown);
}

/** 卡牌的無障礙標籤；收藏冊網格的按鈕也用同一段文字 */
export function cardLabel(recipe: RecipeId, invention: InventionState | undefined): string {
  const status = cardStatus(invention);
  const dish = RECIPES_BY_ID[recipe];
  if (status === 'discovered') return `${dish.name}，${cardStars(invention?.made ?? 0)} 星`;
  return status === 'clue' ? `還沒發現的發明菜。線索：${dish.clue}` : '還沒發現的發明菜';
}

/** 卡框名牌（不透明部分）的上下緣，佔卡高的比例；量自 frame-*.webp 的中央欄 */
const NAMEPLATE = {
  normal: { top: 0.83, bottom: 0.97 },
  gold: { top: 0.817, bottom: 0.96 },
} as const;

/** 星等的位置：卡面底部，名牌正上方 */
const STARS_BAND = { top: 0.75, bottom: 0.815 } as const;

type Props = {
  recipe: RecipeId;
  invention: InventionState | undefined;
  width: number;
  /** 演出用：指定要顯示的星等（例如升星演出先顯示升星前的星等）；不給就依製作次數計算 */
  stars?: number;
};

/**
 * 一張發明菜卡牌（FR33、UX-DR8）：卡面依 CARD_FACE_INSET 放在卡框後面，名牌寫菜名與星等；★5 換金框（FR34）。
 * 收藏冊網格、詳情與 S5.3 的演出共用。
 */
export function CardView({ recipe, invention, width, stars: starsOverride }: Props) {
  const height = width * CARD_ASPECT;
  const status = cardStatus(invention);
  const stars =
    status === 'discovered' ? clampStars(starsOverride ?? cardStars(invention?.made ?? 0)) : 0;
  const gold = stars === 5;
  const name = RECIPES_BY_ID[recipe].name;
  const scale = width / 160;
  const plate = gold ? NAMEPLATE.gold : NAMEPLATE.normal;

  const label = status === 'discovered' ? `${name}，${stars} 星` : cardLabel(recipe, invention);

  return (
    <View testID={`card-${recipe}`} accessible accessibilityLabel={label} style={{ width, height }}>
      <View
        style={[
          styles.face,
          {
            left: width * CARD_FACE_INSET.left,
            right: width * CARD_FACE_INSET.right,
            top: height * CARD_FACE_INSET.top,
            bottom: height * CARD_FACE_INSET.bottom,
          },
        ]}>
        {status === 'discovered' ? (
          <Image
            source={CARDS_BY_RECIPE[recipe].art}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          // 剪影：發明菜圖示塗成深色，看得出形狀、看不出是什麼
          <Image
            testID={`card-silhouette-${recipe}`}
            source={RECIPES_BY_ID[recipe].art}
            contentFit="contain"
            tintColor="#2A2350"
            style={styles.silhouette}
          />
        )}
      </View>
      {status === 'clue' ? (
        <View
          testID={`card-clue-${recipe}`}
          style={[
            styles.clue,
            {
              left: width * 0.11,
              right: width * 0.11,
              bottom: height * 0.2,
              padding: 6 * scale,
              borderRadius: 8 * scale,
            },
          ]}>
          <Text numberOfLines={3} style={[styles.clueText, { fontSize: 10 * scale }]}>
            {RECIPES_BY_ID[recipe].clue}
          </Text>
        </View>
      ) : null}
      <Image
        testID={gold ? `card-frame-gold-${recipe}` : `card-frame-normal-${recipe}`}
        source={gold ? CARD_FRAMES.gold : CARD_FRAMES.normal}
        contentFit="fill"
        style={StyleSheet.absoluteFill}
      />
      {/* 星等：放在卡面底部、名牌正上方（名牌只容得下一行字） */}
      {status === 'discovered' ? (
        <View
          style={[
            styles.band,
            { top: height * STARS_BAND.top, bottom: height * (1 - STARS_BAND.bottom) },
          ]}>
          <Text style={[styles.stars, { fontSize: 12 * scale }]}>{starText(stars)}</Text>
        </View>
      ) : null}
      {/* 名牌：依卡框實際的木牌／金牌位置垂直置中 */}
      <View
        style={[
          styles.band,
          {
            left: width * 0.14,
            right: width * 0.14,
            top: height * plate.top,
            bottom: height * (1 - plate.bottom),
          },
        ]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.name, gold && styles.nameGold, { fontSize: 13 * scale }]}>
          {status === 'discovered' ? name : '？？？'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    overflow: 'hidden',
    // 剪影的底色：深藍夜色
    backgroundColor: '#14102E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    width: '70%',
    height: '70%',
    marginBottom: '15%',
  },
  clue: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 248, 230, 0.92)',
  },
  clueText: {
    color: '#3A2A1A',
    fontWeight: '600',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: '#FFF4DA',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  nameGold: {
    color: '#5A3200',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
  },
  stars: {
    color: '#FFD23F',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
