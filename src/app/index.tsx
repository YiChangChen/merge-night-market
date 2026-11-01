import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Board, pieceEmoji } from '@/components/board';
import { BALANCE, CHAINS } from '@/game/content';
import {
  completeOrder,
  findOrderCells,
  type GameState,
  getSpawnBlocker,
  movePiece,
  msUntilNextEnergy,
  sellPiece,
  sellPrice,
  tapGenerator,
  xpToNextLevel,
} from '@/game/engine';
import { useGame } from '@/game/use-game';

const MAX_BOARD_WIDTH = 480;
const SCREEN_PADDING = 12;
const TOAST_MS = 1800;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Hud({ state, now }: { state: GameState; now: number }) {
  const untilNext = msUntilNextEnergy(state, now);
  return (
    <View style={styles.hud}>
      <Text style={styles.hudText}>
        ⭐ Lv.{state.level}（{state.xp}/{xpToNextLevel(state.level)}）
      </Text>
      <Text style={styles.hudText}>🪙 {state.coins}</Text>
      <Text style={styles.hudText} testID="energy">
        ⚡ {state.energy}/{BALANCE.maxEnergy}
        {untilNext !== null ? ` · ${formatCountdown(untilNext)}` : ''}
      </Text>
    </View>
  );
}

function Orders({ state, onComplete }: { state: GameState; onComplete: (id: number) => void }) {
  return (
    <View style={styles.orders}>
      {state.orders.map((order) => {
        const ready = findOrderCells(state, order) !== null;
        return (
          <Pressable
            key={order.id}
            testID="order"
            disabled={!ready}
            onPress={() => onComplete(order.id)}
            style={[styles.order, ready && styles.orderReady]}>
            <View style={styles.orderItems}>
              {order.requirements.map((requirement, index) => {
                const item = CHAINS[requirement.chain].items[requirement.level - 1];
                return (
                  <View key={index} style={styles.orderItem}>
                    <Text style={styles.orderEmoji}>{item.emoji}</Text>
                    <Text style={styles.orderName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.orderReward}>
              {ready ? '點我出餐！' : `🪙${order.coins} ⚡${order.energy}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoBar({
  state,
  selected,
  onSell,
}: {
  state: GameState;
  selected: number | null;
  onSell: (cell: number) => void;
}) {
  const piece = selected !== null ? state.board[selected] : null;
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
        <Text style={styles.infoText}>
          {pieceEmoji(piece)} {CHAINS[piece.chain].generatorName}：再點一次出食材
        </Text>
      </View>
    );
  }
  const items = CHAINS[piece.chain].items;
  const nextItem = items[piece.level];
  return (
    <View style={styles.info}>
      <Text style={styles.infoText} numberOfLines={1}>
        {items[piece.level - 1].emoji} {items[piece.level - 1].name} Lv.{piece.level}
        {nextItem ? ` → ${nextItem.name}` : '（最高階）'}
      </Text>
      <Pressable testID="sell" style={styles.sell} onPress={() => onSell(selected)}>
        <Text style={styles.sellText}>賣出 🪙{sellPrice(piece)}</Text>
      </Pressable>
    </View>
  );
}

export default function GameScreen() {
  const { state, now, apply } = useGame();
  const { width: windowWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!state) return <View style={styles.screen} />;

  const boardWidth = Math.min(windowWidth - SCREEN_PADDING * 2, MAX_BOARD_WIDTH);
  const cellSize = Math.floor(boardWidth / BALANCE.boardColumns);

  const handleTapCell = (cell: number) => {
    const piece = state.board[cell];
    setSelected(piece ? cell : null);
    if (piece?.kind !== 'generator') return;
    const blocker = getSpawnBlocker(state);
    if (blocker === 'no-energy') setToast('體力不足，稍等一下再來');
    if (blocker === 'board-full') setToast('棋盤滿了，先合成或賣掉一些');
    apply((current) => tapGenerator(current, cell));
  };

  const handleMove = (from: number, to: number) => {
    setSelected(null);
    apply((current) => movePiece(current, from, to));
  };

  const handleSell = (cell: number) => {
    setSelected(null);
    apply((current) => sellPiece(current, cell));
  };

  const handleCompleteOrder = (id: number) => {
    setSelected(null);
    apply((current) => completeOrder(current, id));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.content, { width: cellSize * BALANCE.boardColumns }]}>
        <Hud state={state} now={now} />
        <Orders state={state} onComplete={handleCompleteOrder} />
        <InfoBar state={state} selected={selected} onSell={handleSell} />
        <Board
          board={state.board}
          cellSize={cellSize}
          selected={selected}
          onTapCell={handleTapCell}
          onMove={handleMove}
        />
        {toast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1F1630',
  },
  content: {
    flex: 1,
    gap: 10,
    paddingTop: 8,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudText: {
    color: '#FFF3D6',
    fontSize: 14,
    fontWeight: '600',
  },
  orders: {
    flexDirection: 'row',
    gap: 8,
  },
  order: {
    flex: 1,
    minHeight: 96,
    padding: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#322445',
  },
  orderReady: {
    backgroundColor: '#B8741A',
  },
  orderItems: {
    flexDirection: 'row',
    gap: 4,
  },
  orderItem: {
    flexShrink: 1,
    alignItems: 'center',
  },
  orderEmoji: {
    fontSize: 26,
  },
  orderName: {
    color: '#FFF3D6',
    fontSize: 11,
  },
  orderReward: {
    color: '#FFD36E',
    fontSize: 12,
    fontWeight: '600',
  },
  info: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#322445',
  },
  infoText: {
    flexShrink: 1,
    color: '#FFF3D6',
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
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#000000CC',
  },
  toastText: {
    color: '#FFF3D6',
    fontSize: 14,
  },
});
