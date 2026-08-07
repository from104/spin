// §10.7 store — ToastProvider: "role=status, 3초, 중복 시 타이머만 리셋"(§6.10).
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider, useToast } from './ToastProvider.tsx';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('ToastProvider', () => {
  it('show() 가 큐에 항목을 추가한다', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.show('공은 최대 10개까지 놓을 수 있습니다.'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe('공은 최대 10개까지 놓을 수 있습니다.');
  });

  it('같은 message 로 다시 show() 하면 새로 쌓지 않고 id 를 교체한다(타이머 리셋)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.show('중복 메시지'));
    const firstId = result.current.toasts[0]!.id;
    act(() => result.current.show('중복 메시지'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.id).not.toBe(firstId);
  });

  it('dismiss() 가 해당 항목만 제거한다', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.show('메시지 A');
      result.current.show('메시지 B');
    });
    const idA = result.current.toasts.find((t) => t.message === '메시지 A')!.id;
    act(() => result.current.dismiss(idA));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe('메시지 B');
  });

  it('action 을 그대로 보존한다(삭제 토스트의 [되돌리기])', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let called = false;
    act(() => result.current.show('삭제됨', { action: { label: '되돌리기', onAction: () => (called = true) } }));
    result.current.toasts[0]!.action!.onAction();
    expect(called).toBe(true);
  });
});
