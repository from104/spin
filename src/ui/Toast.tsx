import { useEffect } from 'react';
import type { CSSProperties } from 'react';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  action?: ToastAction;
  /** 기본 3000ms — §6.10 "role=status, 3초, 중복 시 타이머만 리셋". */
  durationMs?: number;
}

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const DEFAULT_DURATION_MS = 3000;

/** 개별 토스트. `role="status"` 는 암묵적으로 `aria-live="polite" aria-atomic="true"` 를
 *  갖는다 — 드래그 좌표 안내용 `liveRegion`(§7.5e)과는 별개 채널이다. */
export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    const duration = toast.durationMs ?? DEFAULT_DURATION_MS;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const rootStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    background: 'var(--panel)',
    border: '1px solid var(--border-strong)',
    boxShadow: '0 12px 24px rgba(0,0,0,.35)',
    fontSize: '0.8125rem',
    color: 'var(--text)',
    minHeight: 'var(--hit)',
  };

  return (
    <div role="status" style={rootStyle}>
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onAction();
            onDismiss(toast.id);
          }}
          style={{
            flex: 'none',
            minHeight: '2.5rem',
            padding: '0 0.75rem',
            borderRadius: '0.5rem',
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: 'var(--accent-text)',
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
