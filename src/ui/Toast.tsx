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
/** 삭제 [실행 취소] 전용(PLAN-DELETE-SAFETY.md §C-2) — 드릴·세션 삭제처럼 **앱 되돌리기
 *  스택이 없어 이 토스트가 유일한 복구 수단**인 경우에만 쓴다. 스텝 삭제는 여기 안 낀다 —
 *  Ctrl/⌘+Z 가 시간과 무관하게 남아 있어 토스트를 놓쳐도 복구 수단이 하나 더 있다. */
export const DELETE_UNDO_TOAST_MS = 8000;

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
