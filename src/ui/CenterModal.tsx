// C11(2026-08-19 기현님 지시) — **화면 중앙 모달**(화면의 2/3 규모). Drawer(우측 서랍)의
// 형제다. 서랍에서 갈아탄 이유: 내용이 길면 서랍의 [×]가 스크롤에 밀려 안 보였다 — 닫기가
// 불편하다. 여기서는 **헤더가 고정**이고(본문만 스크롤) 모달 자체가 화면 가운데 서서 닫기
// 접근성이 유지된다.
//
// 포커스 규약은 Drawer 와 같다: 열 때 제목 <h2 tabIndex={-1}> 포커스, Esc·[×]·배경 클릭으로
// 닫고 트리거로 복귀. 배경 클릭 닫기는 Drawer 에 없던 것 — 중앙 모달은 배경이 시각적으로
// "바깥" 이라 닫힘을 기대하는 것이 관용이다.
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { isImeKeyEvent } from './keyboard.ts';

export interface CenterModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel?: string;
  /** 닫힐 때(Esc·[×]·배경) 포커스를 되돌릴 트리거 요소 — §7.6. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function CenterModal({ open, onClose, title, closeLabel = '닫기', returnFocusRef, children }: CenterModalProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openedByRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    openedByRef.current = (document.activeElement as HTMLElement) ?? null;
    titleRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      // 조합 중의 Esc 는 **조합 취소**다 — Modal.tsx 와 같은 규율(`isImeKeyEvent` 머리말).
      // 이 모달 안에는 텍스트 칸이 산다(드릴 정보 시트의 준비물·코칭포인트) — 가드가 없으면
      // 한글 낱말을 물리려고 누른 Esc 가 시트를 통째로 닫아 쓰던 글이 사라진다.
      if (isImeKeyEvent(e)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      (returnFocusRef?.current ?? openedByRef.current)?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onPointerDown={(e) => {
        // 배경(자기 자신)을 눌렀을 때만 닫는다 — 모달 안 클릭이 버블돼 닫히면 입력이 불가능하다.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.45)',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          // "화면의 2/3 정도" — 폭·높이 모두 66% 언저리, 작은 화면에서는 여백만 남기고 채운다.
          width: 'min(66vw, 760px)',
          minWidth: 'min(92vw, 480px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-strong)',
          borderRadius: 16,
          background: 'var(--panel)',
          boxShadow: '0 24px 60px -20px rgba(0,0,0,.6)',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 — 스크롤과 무관하게 **항상 보인다**(이 컴포넌트의 존재 이유). */}
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id={titleId} ref={titleRef} tabIndex={-1} style={{ fontSize: '1.0625rem', fontWeight: 700, outline: 'none' }}>
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--elev)',
              color: 'var(--text)',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}
