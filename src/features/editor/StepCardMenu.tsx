// 스텝 카드 우클릭 메뉴(2026-08-18 기현님 지시: *"왼쪽바 스텝에 오른쪽 버튼 메뉴 연결.
// 거기에는 선턱(선턱모드 시작), 위/아래로 복제, 삭제 등이 있어야함"*).
//
// ObjectMenu.tsx(코트 개체 우클릭 메뉴)와 **같은 관용구**를 쓴다 — 포털 + fixed 배치,
// useLayoutEffect 로 페인트 전에 화면 밖 잘림을 피하고, 투명 백드롭이 바깥 탭을 먹어서
// 닫으며, Esc 는 캡처 단계에서 잡아 전역 Esc(선택 해제)보다 먼저 닫는다. 이 파일이 그
// 관용구를 복사하는 이유는 ObjectMenu 가 코트 개체 전용 타깃(ids·잠금·무시)을 들고 있어
// 일반화하면 두 메뉴가 서로의 조건 분기를 떠안기 때문이다 — 겹치는 것은 골격뿐이다.
//
// 항목 넷의 순서: [선택]이 맨 위다 — ObjectMenu 의 '고르기가 맨 위' 와 같은 근거(판을 바꾸지
// 않는 유일한 항목이고, 열자마자 포커스가 서는 자리라 되돌릴 것이 없어야 한다). 그다음이
// 복제 둘(위/아래 — 기현님 확정 2026-08-17 "후방 복제가 기본" 이라 [아래로]가 앞), 삭제는
// 경계 다음 맨 끝(경고색 — ObjectMenu 삭제 항목과 같은 관행).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { StepId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';

export interface StepCardMenuTarget {
  /** 포인터 좌표(clientX/Y) — 메뉴 좌상단 후보. 화면 밖이면 반대쪽으로 편다. */
  x: number;
  y: number;
  id: StepId;
  /** 화면 순서(0-기반) — [위로 복제]가 `toIndex` 로 그대로 쓴다. */
  index: number;
}

export interface StepCardMenuProps {
  target: StepCardMenuTarget | null;
  /** 정원(LIMITS.maxSteps) — 카드·틈의 복제 버튼과 같은 기준으로 복제 둘을 잠근다. */
  atMax: boolean;
  /** 최소 1장 — 마지막 남은 스텝이면 삭제를 잠근다(deleteStep 의 가드와 같은 기준). */
  canDelete: boolean;
  onClose(): void;
  /** [선택] — 선택 모드를 켜고 이 카드를 체크한 채 시작한다. */
  onStartSelect(id: StepId): void;
  /** [아래로 복제] = onDuplicateStep(id) (기본 삽입 자리가 바로 뒤),
   *  [위로 복제] = onDuplicateStep(id, index) (자기 자리에 꽂으면 원본이 아래로 밀린다). */
  onDuplicate(id: StepId, toIndex?: number): void;
  onDelete(id: StepId): void;
}

const ITEM: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

export function StepCardMenu({ target, atMax, canDelete, onClose, onStartSelect, onDuplicate, onDelete }: StepCardMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (target) firstRef.current?.focus({ preventScroll: true });
  }, [target]);

  useLayoutEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 160;
    const h = el?.offsetHeight ?? 200;
    const pad = 8;
    const left = target.x + w + pad > window.innerWidth ? Math.max(pad, target.x - w) : target.x;
    const top = target.y + h + pad > window.innerHeight ? Math.max(pad, target.y - h) : target.y;
    setPos({ left, top });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, onClose]);

  if (!target) return null;

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const dupTitle = atMax ? `스텝은 ${LIMITS.maxSteps}장까지입니다.` : undefined;

  return createPortal(
    <>
      <div
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
      />
      <div
        ref={panelRef}
        role="menu"
        aria-label={`스텝 ${target.index + 1} 메뉴`}
        style={{
          position: 'fixed',
          left: pos?.left ?? target.x,
          top: pos?.top ?? target.y,
          zIndex: 61,
          minWidth: 128,
          padding: '6px 0',
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          background: 'var(--panel)',
          boxShadow: '0 12px 28px rgba(0,0,0,.5)',
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <button type="button" role="menuitem" ref={firstRef} onClick={act(() => onStartSelect(target.id))} style={ITEM}>
          선택
        </button>
        <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />
        <button
          type="button"
          role="menuitem"
          disabled={atMax}
          title={dupTitle}
          onClick={act(() => onDuplicate(target.id))}
          style={{ ...ITEM, opacity: atMax ? 0.4 : 1 }}
        >
          아래로 복제
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={atMax}
          title={dupTitle}
          onClick={act(() => onDuplicate(target.id, target.index))}
          style={{ ...ITEM, opacity: atMax ? 0.4 : 1 }}
        >
          위로 복제
        </button>
        <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />
        <button
          type="button"
          role="menuitem"
          disabled={!canDelete}
          title={canDelete ? undefined : '스텝은 최소 1장 있어야 합니다.'}
          onClick={act(() => onDelete(target.id))}
          style={{ ...ITEM, color: '#ff6b6b', opacity: canDelete ? 1 : 0.4 }}
        >
          삭제
        </button>
      </div>
    </>,
    document.body,
  );
}
