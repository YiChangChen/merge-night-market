import { createEventBus, type GameEvent } from '../events';

const merged: GameEvent = { type: 'item_merged', chain: 'tea', level: 2 };
const upgraded: GameEvent = { type: 'stall_upgraded', stall: 'fried', level: 2 };

describe('createEventBus', () => {
  it('依序把事件送給所有訂閱者', () => {
    const bus = createEventBus(jest.fn());
    const a: GameEvent[] = [];
    const b: GameEvent[] = [];
    bus.subscribe((event) => a.push(event));
    bus.subscribe((event) => b.push(event));

    bus.emit(merged);
    bus.emit(upgraded);

    expect(a).toEqual([merged, upgraded]);
    expect(b).toEqual([merged, upgraded]);
  });

  it('取消訂閱後不再收到事件', () => {
    const bus = createEventBus(jest.fn());
    const received: GameEvent[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event));

    bus.emit(merged);
    unsubscribe();
    bus.emit(upgraded);

    expect(received).toEqual([merged]);
  });

  it('某個訂閱者丟出錯誤時，其他訂閱者照常收到事件，錯誤交給 onError', () => {
    const onError = jest.fn();
    const bus = createEventBus(onError);
    const error = new Error('音效載入失敗');
    const received: GameEvent[] = [];
    bus.subscribe(() => {
      throw error;
    });
    bus.subscribe((event) => received.push(event));

    bus.emit(merged);

    expect(received).toEqual([merged]);
    expect(onError).toHaveBeenCalledWith(error, merged);
  });

  it('沒有設定錯誤處理器時，訂閱者的錯誤被吞掉，不會重新丟出', async () => {
    const bus = createEventBus();
    const microtasks = jest.spyOn(globalThis, 'queueMicrotask');
    bus.subscribe(() => {
      throw new Error('音效載入失敗');
    });

    expect(() => bus.emit(merged)).not.toThrow();
    expect(microtasks).not.toHaveBeenCalled();
    microtasks.mockRestore();
  });

  it('setErrorHandler 可以在之後接上（例如 log.error），處理器本身出錯也不會往外丟', () => {
    const bus = createEventBus();
    const handler = jest.fn(() => {
      throw new Error('handler broke');
    });
    bus.setErrorHandler(handler);
    bus.subscribe(() => {
      throw new Error('boom');
    });

    expect(() => bus.emit(merged)).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('訂閱者在處理事件時取消訂閱，不影響這一輪的其他訂閱者', () => {
    const bus = createEventBus(jest.fn());
    const received: string[] = [];
    const unsubscribeFirst = bus.subscribe(() => {
      received.push('first');
      unsubscribeFirst();
    });
    bus.subscribe(() => received.push('second'));

    bus.emit(merged);
    bus.emit(merged);

    expect(received).toEqual(['first', 'second', 'second']);
  });
});
