import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons.tsx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** 제목 요소의 id — `aria-labelledby` 로 연결한다. */
  titleId: string;
  title: ReactNode;
  closeLabel?: string;
  /** 닫힐 때 포커스를 되돌릴 대상(연 트리거 버튼). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** §7.5f "Shift+? 도움말 오버레이 (role="dialog", 포커스 트랩, Esc)" 의 일반형.
 * `role="dialog" aria-modal="true"` + Tab 순환 트랩 + Esc 닫기 + 트리거로 포커스 복귀. */
export function Modal({ open, onClose, titleId, title, closeLabel = '닫기', returnFocusRef, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openedByRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openedByRef.current = (document.activeElement as HTMLElement) ?? null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

    // 포커스가 패널 **밖으로** 새면 되돌린다.
    //
    // ⚠️ 아래 Tab 순환만으로는 부족하다 — 그 트랩이 보는 것은 Tab 키뿐이라, 배경이 부르는
    // `focus()` 와 **브라우저 기본 동작**은 그대로 새어 나간다. `aria-modal="true"` 라고
    // 말해 놓고 배경이 포커스를 가져가면 그 말이 거짓이 된다.
    //
    // 2026-08-17 기현 신고 *"첫 배치 시 모달의 텍스트박스에 포커스가 안 간다"* 가 정확히
    // 후자다: 메모를 놓는 그 누름이 모달을 여는데, 모달이 뜬 **뒤에** 같은 손짓의 호환
    // mousedown 이 도착해 `tabIndex=0` 인 코트(CourtStage 의 `<svg>`)가 포커스를 도로
    // 가져갔다. 글 칸은 열렸는데 커서가 없다. 여는 쪽에서 한 틱 더 미루는 식으로는 못 막는다
    // — 손짓이 언제 끝나는지는 여는 쪽이 모른다. 막을 자리는 다이얼로그 자신이다.
    //
    // 되돌릴 자리는 **패널 안에서 마지막으로 서 있던 요소**다. 첫 요소(닫기 ✕)로 되돌리면
    // 글 칸에 섰다가 뺏긴 사람이 ✕ 로 끌려간다.
    let lastInside: HTMLElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      if (!panel?.isConnected) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && panel.contains(t)) {
        lastInside = t;
        return;
      }
      // 위에 다른 다이얼로그가 열렸으면 임자는 그쪽이다 — 둘이 서로 포커스를 뺏으면 둘 다 죽는다.
      if (t?.closest('[role="dialog"]')) return;
      (lastInside ?? panel).focus({ preventScroll: true });
    };
    document.addEventListener('focusin', onFocusIn);

    (first ?? panel)?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      // IME 조합 중의 Esc 는 **조합 취소**이지 닫기가 아니다. InspectorHost.tsx 머리말이 이미
      // 지키는 규율("입력 중(INPUT/TEXTAREA/SELECT)에는 먹지 않는다 — IME 조합 취소를 빼앗지
      // 않기 위해서고, useEditorKeyboard 의 editable 가드와 같은 규칙이다")을 Modal 로 옮긴 것.
      // keyCode 229 는 isComposing 이 아직 서지 않은 조합 keydown 의 레거시 신호(구형 IME 경로).
      // 2026-08-14 확인: 지금 Modal 6개 사용처에 텍스트 입력은 0개라 **잠재** 결함이다 — 모달에
      // 텍스트 편집기가 들어가는 라운드에서 이 가드가 없으면 한글 조합 취소가 모달을 통째로 닫는다.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // ⚠️ 아래 복귀 focus() 보다 **먼저** 떼야 한다 — 안 그러면 가드가 그 복귀를 "밖으로 샜다"
      // 로 읽고 사라질 패널로 도로 끌어당긴다.
      document.removeEventListener('focusin', onFocusIn);
      const back = returnFocusRef?.current ?? openedByRef.current;
      // InspectorHost.tsx:85 의 back?.isConnected 검사와 같은 형태. 검사가 없으면 화면 전환으로
      // 트리거가 이미 DOM 에서 떼어진 채 닫힐 때 떼어진 노드에 focus 를 걸게 되고, 그 호출이
      // 새 화면이 잡아 둔 포커스를 <body> 로 떨어뜨린다 — §7.6 포커스 복귀가 깨진다.
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
    // open 전환 시에만 다시 바인딩한다 — onClose/returnFocusRef identity 변화로 트랩을 재설정하지 않는다.
  }, [open]);

  if (!open) return null;

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem',
  };
  const panelStyle: CSSProperties = {
    width: 'min(560px, 100%)',
    maxHeight: '85vh',
    overflowY: 'auto',
    borderRadius: '1rem',
    border: '1px solid var(--border-strong)',
    background: 'var(--panel)',
    color: 'var(--text)',
    padding: '1.5rem',
    position: 'relative',
  };

  return createPortal(
    <div style={backdropStyle} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={panelStyle}>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
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
        <h2 id={titleId} style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.75rem', paddingRight: '2.5rem' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
