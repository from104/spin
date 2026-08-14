// 개체 팝업 메뉴 — 오른쪽 클릭 / 긴 터치 (기현 지시 2026-08-14).
//
// *"모든 오브젝트에 오른쪽 클릭 또는 긴 터치(모바일, 태블릿) 누르면 잠김, 무시(흐리게,
// 상호작용안함, 칩들의 한해서), 삭제 메뉴가 팝업으로 떠서 동작하게."*
//
// ── 왜 `Modal` 이 아니라 이 파일인가 ─────────────────────────────────────────────────
// 이 저장소의 팝오버는 지금까지 전부 `ui/Modal` 이었다([보기]·[코트]·[내보내기]). 그것들은
// **화면 가운데** 뜨는 것이 맞았다 — 어느 버튼에서 열었든 내용이 같기 때문이다.
// 개체 메뉴는 다르다: *"이 콘"* 을 눌러 연 메뉴가 화면 반대편에 뜨면 어느 개체의 메뉴인지
// 사라진다. 그래서 **누른 자리**에 뜬다. Modal 이 주던 것 중 필요한 둘(Esc·바깥 클릭 닫기)은
// 여기서 직접 단다.
//
// ── 자리 잡기 ────────────────────────────────────────────────────────────────────────
// 포인터 위치에 그대로 띄우면 화면 오른쪽·아래 가장자리에서 메뉴가 잘린다. 넘치면 반대편으로
// 뒤집는다 — 자리를 옮기는 것이 아니라 **뒤집는 것**이라, 메뉴 모서리 하나는 언제나 손끝에 붙어 있다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOCK_TINT_COLOR } from '../../core/colors.ts';

export interface ObjectMenuTarget {
  id: string;
  /** 화면 좌표(clientX/Y). 메뉴가 뜰 자리다. */
  x: number;
  y: number;
  /** 지금 잠겨 있는가 — 메뉴 글자가 '잠금'/'잠금 해제' 로 갈린다. */
  locked: boolean;
  /** 지금 무시 중인가. `canIgnore` 가 false 면 안 쓴다. */
  ignored: boolean;
  /** '무시' 항목을 낼 것인가 — **휠체어만** true 다(기현 지시). */
  canIgnore: boolean;
}

export interface ObjectMenuProps {
  target: ObjectMenuTarget | null;
  onClose(): void;
  onToggleLock(id: string, next: boolean): void;
  onToggleIgnore(id: string, next: boolean): void;
  onDelete(id: string): void;
}

const ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 14px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

export function ObjectMenu({ target, onClose, onToggleLock, onToggleIgnore, onDelete }: ObjectMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 열면 첫 항목에 선다 — 키보드로 연 사람(Shift+F10·메뉴 키)이 곧바로 고를 수 있어야 한다.
  useEffect(() => {
    if (target) firstRef.current?.focus({ preventScroll: true });
  }, [target]);

  // 자리 계산은 **페인트 전**이라야 한다. useEffect 로 미루면 한 프레임 동안 잘린 자리에
  // 그려졌다가 튄다 — 발 마우스 사용자에게는 그 한 프레임이 조준 실패로 이어진다.
  useLayoutEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 180;
    const h = el?.offsetHeight ?? 140;
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
    // 캡처로 잡는다 — 판의 전역 Esc(선택 해제)보다 **먼저** 와야 메뉴만 닫힌다
    // ([보기] 팝오버가 인스펙터보다 먼저 닫히는 것과 같은 등록 단계 규율이다).
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, onClose]);

  if (!target) return null;

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <>
      {/* 바깥을 덮는 판 — 클릭 한 번으로 닫힌다. 투명이지만 **포인터를 받는다**:
          안 두면 메뉴를 닫으려던 탭이 코트에 닿아 개체를 하나 더 놓는다. */}
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
        aria-label="개체 메뉴"
        style={{
          position: 'fixed',
          left: pos?.left ?? target.x,
          top: pos?.top ?? target.y,
          zIndex: 61,
          minWidth: 168,
          padding: '6px 0',
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          background: 'var(--panel)',
          boxShadow: '0 12px 28px rgba(0,0,0,.5)',
          // 자리를 아직 못 쟀으면 그리지 않는다(위 useLayoutEffect 의 첫 통과).
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <button
          type="button"
          role="menuitem"
          ref={firstRef}
          onClick={act(() => onToggleLock(target.id, !target.locked))}
          style={ITEM}
        >
          <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', color: LOCK_TINT_COLOR }}>
            {target.locked ? '○' : '●'}
          </span>
          {target.locked ? '잠금 해제' : '잠금'}
        </button>

        {/* 무시는 **휠체어만**이다(기현 지시). 다른 개체에서 이 자리를 비워 두지 않고 **아예
            안 내는** 이유: 항목이 있는데 눌러도 아무 일이 없는 것보다, 없는 편이 정직하다. */}
        {target.canIgnore && (
          <button type="button" role="menuitem" onClick={act(() => onToggleIgnore(target.id, !target.ignored))} style={ITEM}>
            <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.5 }}>
              {target.ignored ? '◍' : '◌'}
            </span>
            {target.ignored ? '무시 해제' : '무시'}
          </button>
        )}

        <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />

        {/* 삭제만 붉다 — 되돌릴 수 없는 항목은 색으로도 갈려야 한다. 잠금·무시의 보라와
            같은 색을 쓰면 세 항목이 한 덩어리로 읽혀 실수로 누르기 쉬워진다.
            (#d93a3a 는 빨강 팀 칩과 같은 값이다 — 여기는 메뉴 글자라 코트 위 개체와 섞이지 않는다.) */}
        <button type="button" role="menuitem" onClick={act(() => onDelete(target.id))} style={{ ...ITEM, color: '#ff6b6b' }}>
          <span aria-hidden style={{ width: '1.125rem', textAlign: 'center' }}>
            ✕
          </span>
          삭제
        </button>
      </div>
    </>,
    document.body,
  );
}
