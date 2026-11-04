import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInRight, LinearTransition, ZoomOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Board, PieceIcon } from '@/components/board';
import { customerArtSize, CustomerTray } from '@/components/customer-tray';
import { BALANCE, CHAINS } from '@/game/content';
import {
  completeOrder,
  customerForOrder,
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
// 棋盤以外的 HUD、資訊列與間距總高，不含訂單
const NON_BOARD_HEIGHT = 106;
const ORDER_GAP = 8;
// 訂單人物圖下方的品名與獎勵標籤
const ORDER_LABEL_HEIGHT = 42;
const TOAST_MS = 1800;
const ORDER_SHIFT_MS = 260;
const ORDER_ENTER_MS = 260;
const ORDER_EXIT_MS = 160;
// 背景圖的寬高比（768×1376）
const BACKGROUND_ASPECT = 768 / 1376;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function Hud({ state }: { state: GameState }) {
  // 倒數只影響這裡，計時放在 Hud 裡，每秒才不會重畫整個畫面
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
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

function Orders({
  state,
  artSize,
  onComplete,
}: {
  state: GameState;
  artSize: { width: number; height: number };
  onComplete: (id: number) => void;
}) {
  return (
    <View style={styles.orders}>
      {state.orders.map((order) => {
        const ready = findOrderCells(state, order) !== null;
        return (
          <Animated.View
            key={order.id}
            // 等其他卡片讓出位置才進場，避免疊在一起
            entering={FadeInRight.delay(ORDER_SHIFT_MS).duration(ORDER_ENTER_MS)}
            exiting={ZoomOut.duration(ORDER_EXIT_MS)}
            layout={LinearTransition.duration(ORDER_SHIFT_MS)}
            style={styles.orderSlot}>
            <Pressable
              testID="order"
              disabled={!ready}
              onPress={() => onComplete(order.id)}
              style={styles.order}>
              <CustomerTray
                customer={customerForOrder(order)}
                requirements={order.requirements}
                width={artSize.width}
                height={artSize.height}
              />
              <View style={[styles.orderLabel, ready && styles.orderLabelReady]}>
                <Text
                  style={[styles.orderName, ready && styles.orderTextReady]}
                  numberOfLines={1}>
                  {order.requirements
                    .map(
                      (requirement) => CHAINS[requirement.chain].items[requirement.level - 1].name
                    )
                    .join('、')}
                </Text>
                <Text
                  style={[styles.orderReward, ready && styles.orderTextReady]}
                  numberOfLines={1}>
                  {ready ? '點我出餐！' : `🪙${order.coins} ⚡${order.energy}`}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
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
        <View style={styles.infoLabel}>
          <PieceIcon piece={piece} size={24} />
          <Text style={styles.infoText}>{CHAINS[piece.chain].generatorName}：再點一次出食材</Text>
        </View>
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

export default function GameScreen() {
  const { state, apply } = useGame();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!state) return <View style={styles.screen} />;

  const boardWidth = Math.min(windowWidth - SCREEN_PADDING * 2, MAX_BOARD_WIDTH);
  const artSize = customerArtSize((boardWidth + ORDER_GAP) / BALANCE.orderSlots);
  const boardHeight =
    windowHeight -
    insets.top -
    insets.bottom -
    NON_BOARD_HEIGHT -
    artSize.height -
    ORDER_LABEL_HEIGHT;
  const cellSize = Math.floor(
    Math.min(boardWidth / BALANCE.boardColumns, boardHeight / BALANCE.boardRows)
  );

  // 背景維持直式比例：手機填滿寬度，寬螢幕置中，兩側露出與夜空相近的底色
  const backgroundWidth = Math.min(
    windowWidth,
    Math.max(windowHeight * BACKGROUND_ASPECT, boardWidth + SCREEN_PADDING * 2)
  );

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
      <Image
        source={require('../../assets/images/night-market-background-direct.jpg')}
        contentFit="cover"
        contentPosition="bottom"
        draggable={false}
        style={[
          styles.background,
          { width: backgroundWidth, left: (windowWidth - backgroundWidth) / 2 },
        ]}
      />
      <View style={[styles.content, { width: boardWidth }]}>
        <Hud state={state} />
        <Orders state={state} artSize={artSize} onComplete={handleCompleteOrder} />
        <InfoBar state={state} selected={selected} onSell={handleSell} />
        <View style={styles.boardArea}>
          <Board
            board={state.board}
            cellSize={cellSize}
            selected={selected}
            onTapCell={handleTapCell}
            onMove={handleMove}
          />
        </View>
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
    backgroundColor: '#0A1E3D',
    // 網頁版靠長按與拖曳操作，不能觸發文字選取
    userSelect: 'none',
  },
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    gap: 10,
    paddingTop: 8,
  },
  boardArea: {
    alignItems: 'center',
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
    gap: ORDER_GAP,
  },
  orderSlot: {
    flex: 1,
  },
  order: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  // 少了卡片底色，文字要有深色底才看得清楚
  orderLabel: {
    alignSelf: 'stretch',
    height: ORDER_LABEL_HEIGHT - 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000AA',
  },
  orderLabelReady: {
    backgroundColor: '#F2C572',
  },
  orderName: {
    color: '#FFF3D6',
    fontSize: 12,
  },
  orderReward: {
    color: '#FFF3D6',
    fontSize: 12,
    fontWeight: '600',
  },
  orderTextReady: {
    color: '#4A3420',
  },
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
