import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons.tsx';
import { isImeKeyEvent } from './keyboard.ts';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel?: string;
  /** 닫힐 때(Esc·[×]) 포커스를 되돌릴 트리거 요소 — §7.6. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  widthPx?: number;
  children: ReactNode;
}

const DEFAULT_WIDTH_PX = 380;

/** §6.11 세션 드로어(편집기 인스펙터와 같은 시각 언어) — `role="dialog" aria-modal="false"`.
 * 배경이 계속 상호작용 가능한 비모달 다이얼로그라 포커스 트랩은 두지 않는다(WAI-ARIA 비모달
 * 패턴). 열 때 제목 `<h2 tabIndex={-1}>` 로 포커스, 닫을 때 트리거로 복귀. */
export function Drawer({ open, onClose, title, closeLabel = '닫기', returnFocusRef, widthPx = DEFAULT_WIDTH_PX, children }: DrawerProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const openedByRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    openedByRef.current = (document.activeElement as HTMLElement) ?? null;
    titleRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      // 조합 중의 Esc 는 **조합 취소**다 — Modal.tsx 와 같은 규율(`isImeKeyEvent` 머리말).
      // 서랍은 비모달이라 배경 입력칸이 살아 있고, 그 칸에서 조합 중일 수 있다.
      if (isImeKeyEvent(e)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const root = rootRef.current;
    root?.addEventListener('keydown', onKeyDown);
    return () => {
      root?.removeEventListener('keydown', onKeyDown);
      (returnFocusRef?.current ?? openedByRef.current)?.focus({ preventScroll: true });
    };
    // open 전환 시에만 다시 바인딩한다 — onClose/returnFocusRef identity 변화로 재설정하지 않는다.
  }, [open]);

  if (!open) return null;

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 190,
    width: `min(${widthPx}px, 100vw)`,
    background: 'var(--panel)',
    borderLeft: '1px solid var(--border-strong)',
    boxShadow: '-16px 0 32px rgba(0,0,0,.35)',
    padding: '1.25rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  };

  return createPortal(
    // 비모달(aria-modal="false")이라 배경을 덮는 스크림을 두지 않는다 — 편집기 인스펙터와
    // 같은 시각 언어(§6.11)로, 뒤 콘텐츠가 계속 보이고 상호작용 가능해야 한다.
    <div ref={rootRef} role="dialog" aria-modal="false" aria-labelledby={titleId} style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} style={{ fontSize: '1.0625rem', fontWeight: 700 }}>
          {title}
        </h2>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          style={{
            flex: 'none',
            width: 'var(--hit)',
            height: 'var(--hit)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.6rem',
            color: 'var(--muted)',
          }}
        >
          <IconClose />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}
