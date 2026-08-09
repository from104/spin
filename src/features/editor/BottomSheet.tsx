// §6.4 태블릿 세로 레이아웃 — 화면 아래에서 손잡이로 여닫는 패널. 속성(인스펙터)을 담는다.
//
// **기본은 접힘**이다. 제목·선수 명단은 가끔 만지는 것이라 상시 노출할 이유가 없고, 세로
// 화면에서 코트에 줄 수 있는 높이가 그만큼 늘어난다.
//
// 오버레이(코트 위에 띄우기)가 아니라 **자리를 차지하는** 방식이다 — 오버레이로 하면 열었을 때
// 코트가 가려져서 "보면서 고치기" 가 안 된다. 대신 열리면 코트 영역이 줄고, CourtStage 가
// ResizeObserver 로 그 변화를 받아 회전 판정을 다시 한다.
import { useId } from 'react';
import type { ReactNode } from 'react';

export interface BottomSheetProps {
  label: string;
  open: boolean;
  onToggle(): void;
  /** 열렸을 때 본문 최대 높이(px). 화면을 다 먹지 않게 상한을 둔다. */
  maxHeight?: number;
  children: ReactNode;
}

export function BottomSheet({ label, open, onToggle, maxHeight = 320, children }: BottomSheetProps) {
  const panelId = useId();
  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--border)', background: 'var(--panel)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'transparent',
          color: 'var(--muted)',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}
      >
        {/* 손잡이 — 여닫을 수 있다는 것을 모양으로 알린다. 라벨은 스크린리더용이자 시각용. */}
        <span aria-hidden style={{ width: 34, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        {label}
        <span aria-hidden style={{ fontSize: '0.6875rem' }}>{open ? '▾' : '▴'}</span>
      </button>
      {/* 닫힐 때 DOM 에서 아예 빼낸다 — display:none 으로 두면 인스펙터 안의 입력들이 계속
          탭 순서에 남아 키보드 사용자가 보이지 않는 곳으로 끌려간다(§7.5). */}
      {open && (
        <div id={panelId} style={{ maxHeight, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
