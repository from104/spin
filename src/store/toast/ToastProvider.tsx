// §6.10 "role=status, 3초, 중복 시 타이머만 리셋" — 같은 message 로 다시 show() 하면 새 토스트를
// 쌓지 않고 기존 항목을 새 id 로 교체해 <Toast> 를 리마운트시킨다(타이머는 Toast 내부
// useEffect([toast.id]) 가 소유하므로, id 를 바꾸는 것이 "타이머 리셋" 의 가장 단순한 구현이다).
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastAction, ToastItem } from '../../ui/Toast.tsx';

export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}
export interface ToastApi {
  toasts: readonly ToastItem[];
  show(message: string, opts?: ToastOptions): void;
  dismiss(id: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, opts?: ToastOptions) => {
    setToasts((cur) => {
      seq.current += 1;
      const item: ToastItem = { id: `tst_${Date.now().toString(36)}_${seq.current}`, message, action: opts?.action, durationMs: opts?.durationMs };
      const dupIdx = cur.findIndex((t) => t.message === message);
      if (dupIdx === -1) return [...cur, item];
      const next = cur.slice();
      next[dupIdx] = item; // id 교체 = 타이머 리셋
      return next;
    });
  }, []);

  const api = useMemo<ToastApi>(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastApi {
  const v = useContext(ToastContext);
  if (!v) throw new Error('useToast 는 ToastProvider 안에서만 쓸 수 있다');
  return v;
}
