// §5.2 / 결정 ③(A) 인스펙터의 껍데기 — **판 위에 뜨는 오버레이 시트**(기본) ↔ **붙박이 312px**(핀).
//
// 2026-08-12 전까지 이 자리에는 BottomSheet 가 있었고 그 주석은 *"오버레이가 아니라 자리를
// 차지하는 방식"* 이라고 적혀 있었다. 그 판단이 뒤집혔다: 세로 화면뿐 아니라 **가로·PC 에서도**
// 인스펙터가 폭을 먹는 것이 축척 손해의 최대 항목이었다(1280×800 에서 pxPerUnit +25.4%).
// "보면서 고치기" 는 자리를 차지해서가 아니라 **기본 접힘 + 한 번의 탭**으로 지킨다.
//
// ── 포커스 계약 [D-5] (완료 판정 (d)) ─────────────────────────────────────────────
// 1. **모달이 아니다.** `role="dialog" aria-modal="false"`, 포커스 트랩 **없음**.
//    이 패널은 판의 동반자다 — 속성 하나를 고치고 곧바로 코트·트레이로 Tab 해 나가야 한다.
//    트랩을 걸면 열려 있는 동안 키보드 사용자가 앱의 본체(판)에서 격리된다. 세션 드로어
//    (ui/Drawer.tsx, §6.11 "편집기 인스펙터와 같은 시각 언어")가 이미 같은 계약이다.
//    붙박이(핀) 상태에서는 dialog 도 아니다 — 그냥 자리를 가진 영역이라 role 을 벗는다.
// 2. **연 순간 제목(h2 tabIndex=-1)으로 포커스**, **닫으면 트리거로 복귀**(§7.6 세션 드로어 행).
//    복귀는 트리거가 아직 문서에 붙어 있을 때만 한다 — 화면 전환으로 편집기째 사라질 때
//    떼어진 버튼에 focus() 를 걸면 포커스가 <body> 로 떨어져 §7.6 의 `<main>` 포커스를 지운다.
// 3. **Esc 우선순위** — 세 소비자가 겹친다(1.7 이 Esc 를 전역 '선택 해제'로 넣었다):
//      (1) 모달(ui/Modal.tsx) > (2) 이 패널 > (3) 선택 해제(useEditorKeyboard).
//    이 순서는 플래그가 아니라 **등록 단계**가 보장한다. 모달은 document **캡처**에서 잡아
//    stopPropagation 하므로 그 아래(=이 패널의 루트 요소, 타깃 단계)까지 내려오지 않는다.
//    이 패널은 **자기 루트 요소**에만 리스너를 달아 *포커스가 패널 안에 있을 때만* Esc 를 먹고,
//    먹었으면 stopPropagation 으로 전역 선택 해제를 막는다 — 속성을 고치다 Esc 를 눌렀는데
//    선택까지 풀리면 패널 내용이 통째로 비어 버린다. 포커스가 판에 있으면 이 리스너는 아예
//    호출되지 않으므로 Esc 는 예전대로 선택 해제다.
//    입력 중(INPUT/TEXTAREA/SELECT)에는 먹지 않는다 — IME 조합 취소를 빼앗지 않기 위해서고,
//    useEditorKeyboard 의 editable 가드와 같은 규칙이다.
import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { IconClose } from '../../ui/icons.tsx';
import { isEditableTarget } from '../../ui/keyboard.ts';
import { INSPECTOR_WIDTH_PX, canPinInspector, inspectorMode } from './inspectorLayout.ts';

export interface InspectorHostProps {
  /** 트리거(StageControls 의 [속성])의 `aria-controls` 와 맞추는 id. */
  id: string;
  open: boolean;
  pinned: boolean;
  /** 편집기 컨테이너 실측 폭 — [고정] 노출 판정(≥1100)에만 쓴다. */
  containerWidthPx: number;
  /** 'bottom' = 세로 화면(아래에서 올라온다) · 'side' = 가로 화면(핀이 설 자리에서 미끄러진다). */
  edge: 'bottom' | 'side';
  onClose(): void;
  onTogglePin(): void;
  /** 닫을 때 포커스를 되돌릴 트리거 — §7.6. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const HEADER_BTN: CSSProperties = {
  flex: 'none',
  width: 'var(--hit)',
  height: 'var(--hit)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.6rem',
  color: 'var(--muted)',
};

export function InspectorHost({ id, open, pinned, containerWidthPx, edge, onClose, onTogglePin, returnFocusRef, children }: InspectorHostProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    // 되돌릴 포커스 대상은 **설치 시점에** 정한다. 정리 함수 안에서 ref.current 를 읽으면
    // 그때는 이미 값이 바뀌어 있을 수 있고(오래된 ref 경고), 여기서 잡아 두면 "이 시트를 연
    // 그 버튼" 이라는 뜻도 더 정확해진다.
    const openedBy = (document.activeElement as HTMLElement) ?? null;
    const back = returnFocusRef?.current ?? openedBy;
    titleRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isEditableTarget(e.target)) return;
      e.stopPropagation();
      onClose();
    };
    const root = rootRef.current;
    root?.addEventListener('keydown', onKeyDown);
    return () => {
      root?.removeEventListener('keydown', onKeyDown);
      // isConnected 검사가 없으면 화면 전환(편집기 언마운트)에서 떼어진 버튼에 포커스를 걸어
      // 새 화면의 <main> 포커스를 <body> 로 되돌려 놓는다.
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
    // onClose 는 호출부에서 useCallback 으로 고정한다 — 렌더마다 새 함수면 이 이펙트가 매번
    // 다시 돌아 제목으로 포커스를 계속 빼앗는다. **핀 토글은 여기에 걸리지 않는다**:
    // 모드가 바뀌어도 포커스를 다시 뺏지 않는다(완료 판정 (b)).
  }, [open, onClose, returnFocusRef]);

  const mode = inspectorMode({ open, pinned, containerWidthPx });
  if (mode === 'hidden') return null;
  const overlay = mode === 'overlay';
  const pinnable = canPinInspector(containerWidthPx);

  // ★ 오버레이는 out-of-flow 다 — 그래서 코트 상자가 인스펙터 유무와 무관해진다(완료 판정 (a)).
  //   붙박이일 때만 flex 항목으로 서서 312+1 을 떼어 간다(inspectorChromeWidthPx 와 같은 값).
  const overlayBase: CSSProperties = {
    position: 'absolute',
    zIndex: 40,
    background: 'var(--panel)',
    border: '1px solid var(--border-strong)',
    boxShadow: '0 -10px 30px rgba(0,0,0,.35)',
  };
  const style: CSSProperties = overlay
    ? edge === 'bottom'
      ? { ...overlayBase, left: 0, right: 0, bottom: 0, maxHeight: 'min(340px, 62%)', borderRadius: '0.9rem 0.9rem 0 0' }
      : { ...overlayBase, top: 0, right: 0, bottom: 0, width: `min(${INSPECTOR_WIDTH_PX}px, 92%)`, borderRadius: '0.9rem 0 0 0.9rem' }
    : { flex: 'none', width: INSPECTOR_WIDTH_PX, borderLeft: '1px solid var(--border)', background: 'var(--panel)' };

  return (
    // 오버레이/붙박이가 **같은 자리·같은 요소**를 쓴다. 분기해서 서로 다른 부모에 넣으면 핀을
    // 누를 때마다 InspectorPanel 이 언마운트–재마운트돼 선수 카드 펼침 상태가 날아간다
    // (§5.1 "컨테이너만 바꾼다"). 여기서 바뀌는 것은 style 과 role 뿐이다.
    <div
      ref={rootRef}
      id={id}
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay ? 'false' : undefined}
      aria-labelledby={titleId}
      style={{ ...style, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 0 12px', borderBottom: '1px solid var(--border)' }}>
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', outline: 'none' }}
        >
          속성
        </h2>
        {pinnable && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label="고정"
            title={pinned ? '고정 해제 — 판 위로 띄웁니다' : '고정 — 판 옆에 붙박이로 둡니다'}
            style={{
              ...HEADER_BTN,
              fontSize: '0.6875rem',
              fontWeight: 700,
              // 이모지·아이콘 폰트를 쓰지 않는다(번들에 없다). 글자 두 자가 가장 확실하다.
              color: pinned ? 'var(--accent-text)' : 'var(--muted)',
              border: `1px solid ${pinned ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            고정
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="속성 닫기" style={HEADER_BTN}>
          <IconClose />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
