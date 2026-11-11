import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CHAINS, RECIPES_BY_ID } from '@/game/content';
import { dishSellPrice, sellPrice } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { PieceIcon } from './board';

type InfoBarProps = {
  selected: number | null;
  onSell: (cell: number) => void;
};

/**
 * 棋盤下方的資訊列（UX-DR12）：點選棋子後顯示名稱與賣出按鈕。
 * 只訂閱被選取的那一格，拖曳其他棋子不會重繪。發明菜一次賣 1 份（FR24、RC-6）。
 */
export function InfoBar({ selected, onSell }: InfoBarProps) {
  const piece = useGameStore((store) =>
    selected !== null ? (store.state?.board[selected] ?? null) : null
  );
  if (!piece || selected === null) {
    return (
      <View style={styles.info}>
        <Text style={styles.infoText}>點產生器出食材，拖曳相同品項合成</Text>
      </View>
    );
  }
  if (piece.kind === 'generator') {
    return (
      <View style={styles.info}>
        <View style={styles.infoLabel}>
          <PieceIcon piece={piece} size={24} />
          <Text style={styles.infoText}>{CHAINS[piece.chain].generatorName}：再點一次出食材</Text>
        </View>
      </View>
    );
  }
  if (piece.kind === 'dish') {
    return (
      <View style={styles.info}>
        <View style={styles.infoLabel}>
          <PieceIcon piece={piece} size={28} />
          <Text style={styles.infoText} numberOfLines={1}>
            {RECIPES_BY_ID[piece.recipe].name} ×{piece.count}
          </Text>
        </View>
        <Pressable testID="sell" style={styles.sell} onPress={() => onSell(selected)}>
          <Text style={styles.sellText}>賣出 🪙{dishSellPrice(piece.recipe)}</Text>
        </Pressable>
      </View>
    );
  }
  const items = CHAINS[piece.chain].items;
  const nextItem = items[piece.level];
  return (
    <View style={styles.info}>
      <View style={styles.infoLabel}>
        <PieceIcon piece={piece} size={28} />
        <Text style={styles.infoText} numberOfLines={1}>
          {items[piece.level - 1].name} Lv.{piece.level}
          {nextItem ? ` → ${nextItem.name}` : '（最高階）'}
        </Text>
      </View>
      <Pressable testID="sell" style={styles.sell} onPress={() => onSell(selected)}>
        <Text style={styles.sellText}>賣出 🪙{sellPrice(piece)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  info: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F5ECD8',
  },
  infoLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    flexShrink: 1,
    color: '#4A3420',
    fontSize: 13,
  },
  sell: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#B8741A',
  },
  sellText: {
    color: '#FFF3D6',
    fontSize: 13,
    fontWeight: '600',
  },
});
