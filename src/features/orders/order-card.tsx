import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CHAINS, RECIPES_BY_ID } from '@/game/content';
import { customerForOrder, type Order } from '@/game/engine';
import { useGameStore } from '@/game/store';

import { CustomerTray } from './customer-tray';

/** 客人圖下方的品名與獎勵標籤；棋盤畫面的版面計算要預留這個高度 */
export const ORDER_LABEL_HEIGHT = 42;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** 線索單的剩餘時間：只在線索卡裡掛每秒計時器，時間加上除錯快轉偏移量（和 HUD 相同）。到期移除由規則層負責。 */
function ClueCountdown({ expiresAt }: { expiresAt: number }) {
  const timeOffsetMs = useGameStore((store) => store.timeOffsetMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text testID="clue-countdown" style={styles.countdown}>
      ⏳ {formatCountdown(expiresAt - (now + timeOffsetMs))}
    </Text>
  );
}

type OrderCardProps = {
  order: Order;
  /** 棋盤上有交付需要的東西 */
  ready: boolean;
  artSize: { width: number; height: number };
  onComplete: (id: number) => void;
  onDismiss: (id: number) => void;
};

/**
 * 一張訂單卡（S4.3）。一般單維持原樣；貴客單有金色外框、托盤上放指定的發明菜；
 * 線索單在客人頭上顯示台詞，標籤區換成「請客人先走」與剩餘時間。
 */
export function OrderCard({ order, ready, artSize, onComplete, onDismiss }: OrderCardProps) {
  const customer = customerForOrder(order);

  if (order.kind === 'clue' && order.recipe !== undefined) {
    const clue = RECIPES_BY_ID[order.recipe].clue;
    return (
      <View testID="order" style={styles.order}>
        <View>
          <CustomerTray
            customer={customer}
            requirements={[]}
            width={artSize.width}
            height={artSize.height}
          />
          <View testID="clue-bubble" style={styles.bubble}>
            <Text style={styles.bubbleText} numberOfLines={3}>
              {clue}
            </Text>
            {order.expiresAt !== undefined ? <ClueCountdown expiresAt={order.expiresAt} /> : null}
          </View>
        </View>
        <Pressable
          testID="dismiss-order"
          accessibilityRole="button"
          accessibilityLabel={`請客人先走。客人說：${clue}`}
          // 視覺高度跟標籤一樣，觸控區上下各加 4，總共 ≥ 44 pt
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={() => onDismiss(order.id)}
          style={({ pressed }) => [styles.label, styles.dismiss, pressed && styles.pressed]}>
          <Text style={styles.dismissText}>請客人先走</Text>
        </Pressable>
      </View>
    );
  }

  const vip = order.kind === 'vip' && order.recipe !== undefined;
  const name = vip
    ? RECIPES_BY_ID[order.recipe!].name
    : order.requirements
        .map((requirement) => CHAINS[requirement.chain].items[requirement.level - 1].name)
        .join('、');
  return (
    <Pressable
      testID="order"
      accessibilityLabel={vip ? `貴客${customer.name}：${name}，${order.coins} 金幣` : undefined}
      disabled={!ready}
      onPress={() => onComplete(order.id)}
      style={[styles.order, vip && styles.vipCard]}>
      <CustomerTray
        customer={customer}
        requirements={order.requirements}
        dish={vip ? order.recipe : undefined}
        width={artSize.width}
        height={artSize.height}
      />
      {vip ? (
        <Text testID="vip-badge" style={styles.vipBadge}>
          貴客
        </Text>
      ) : null}
      <View style={[styles.label, ready && styles.labelReady, vip && !ready && styles.vipLabel]}>
        <Text style={[styles.name, ready && styles.textReady]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.reward, ready && styles.textReady]} numberOfLines={1}>
          {ready ? '點我出餐！' : vip ? `🪙${order.coins}` : `🪙${order.coins} ⚡${order.energy}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 不要設 flex: 1：外層格子沒有固定高度，flex: 1 會讓卡片高度塌成 0（客人圖被資訊列蓋住）
  order: {
    alignItems: 'center',
    gap: 2,
  },
  // 貴客：金色外框（不改變卡片高度）
  vipCard: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD966',
    backgroundColor: '#FFD96622',
  },
  vipBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    paddingHorizontal: 5,
    borderRadius: 6,
    overflow: 'hidden',
    color: '#4A3420',
    backgroundColor: '#FFD966',
    fontSize: 11,
    fontWeight: '800',
  },
  // 少了卡片底色，文字要有深色底才看得清楚
  label: {
    alignSelf: 'stretch',
    height: ORDER_LABEL_HEIGHT - 2,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000AA',
  },
  labelReady: {
    backgroundColor: '#F2C572',
  },
  vipLabel: {
    backgroundColor: '#5A3A0ACC',
  },
  name: {
    color: '#FFF3D6',
    fontSize: 12,
  },
  reward: {
    color: '#FFF3D6',
    fontSize: 12,
    fontWeight: '600',
  },
  textReady: {
    color: '#4A3420',
  },
  // 線索：客人頭上的白色對話框
  bubble: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFFFFFF0',
  },
  bubbleText: {
    color: '#3A2A1A',
    fontSize: 11,
    lineHeight: 14,
  },
  countdown: {
    marginTop: 2,
    color: '#8A5A20',
    fontSize: 11,
    fontWeight: '700',
  },
  dismiss: {
    backgroundColor: '#3A4A7A',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
