import type { CSSProperties } from 'react';
import { Toast, type ToastItem } from './Toast.tsx';

export interface ToastHostProps {
  toasts: ReadonlyArray<ToastItem>;
  onDismiss: (id: string) => void;
}

const HOST_STYLE: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: '1.5rem',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  width: 'min(420px, calc(100vw - 2rem))',
  zIndex: 150,
  pointerEvents: 'none',
};

/** 앱 전역 토스트 큐를 렌더링한다. 큐 상태(`ToastProvider`)는 store 모듈 소유이고
 *  이 컴포넌트는 props 로만 받는다(ui-kit → core 외 의존 금지, §8). */
export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;
  return (
    <div style={HOST_STYLE}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
