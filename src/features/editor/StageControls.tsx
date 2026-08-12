// §6.4 줌 컨트롤(a11y blocker — "줌/팬은 필수 기능이다") + 격자/골 지역 가이드 토글.
// 코트 위 우상단에 떠 있는 --hit×--hit(기본 44, 큰 터치 타깃 56) 버튼 묶음 — §5.4 실배선.
import type { CSSProperties, RefObject } from 'react';
import { IconPlus } from '../../ui/icons.tsx';

export interface StageControlsProps {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  showGrid: boolean;
  onToggleGrid(): void;
  showRuleZones: boolean;
  onToggleRuleZones(): void;
  /** [속성] 여닫기 — 인스펙터가 오버레이가 되면서(결정 ③) 그것을 부르는 손잡이가 필요해졌다.
   *  이 묶음에 두는 이유: 코트 우상단은 어느 방향·어느 폭에서도 비어 있는 유일한 자리다.
   *  하단 바에 두면 BoardBar/TransportBar 둘 다 고쳐야 하고, 시트가 올라올 때 그 손잡이를
   *  자기가 덮는다. 이 버튼은 **떠 있으므로 레이아웃 폭·높이를 한 픽셀도 먹지 않는다**. */
  inspectorOpen: boolean;
  onToggleInspector(): void;
  inspectorPanelId: string;
  inspectorButtonRef?: RefObject<HTMLButtonElement | null>;
}

const BTN: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
};

export function StageControls({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  showGrid,
  onToggleGrid,
  showRuleZones,
  onToggleRuleZones,
  inspectorOpen,
  onToggleInspector,
  inspectorPanelId,
  inspectorButtonRef,
}: StageControlsProps) {
  return (
    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
      <button type="button" aria-label="확대" onClick={onZoomIn} style={BTN}>
        <IconPlus size={16} />
      </button>
      <button type="button" aria-label="축소" onClick={onZoomOut} style={{ ...BTN, fontSize: '1.125rem', fontWeight: 700 }}>
        −
      </button>
      <button type="button" aria-label="줌 초기화" onClick={onZoomReset} style={{ ...BTN, fontSize: '0.625rem', fontWeight: 700 }}>
        100%
      </button>
      <button
        type="button"
        aria-pressed={showGrid}
        aria-label="격자 표시 전환"
        onClick={onToggleGrid}
        style={{ ...BTN, color: showGrid ? 'var(--accent-text)' : 'var(--muted)', borderColor: showGrid ? 'var(--accent)' : 'var(--border)' }}
      >
        #
      </button>
      <button
        type="button"
        aria-pressed={showRuleZones}
        aria-label="골 지역 가이드 전환"
        onClick={onToggleRuleZones}
        style={{ ...BTN, color: showRuleZones ? 'var(--accent-text)' : 'var(--muted)', borderColor: showRuleZones ? 'var(--accent)' : 'var(--border)' }}
      >
        Z
      </button>
      <button
        type="button"
        ref={inspectorButtonRef}
        aria-label="속성"
        aria-expanded={inspectorOpen}
        aria-controls={inspectorPanelId}
        onClick={onToggleInspector}
        style={{
          ...BTN,
          marginTop: 6,
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: inspectorOpen ? 'var(--accent-text)' : 'var(--muted)',
          borderColor: inspectorOpen ? 'var(--accent)' : 'var(--border)',
        }}
      >
        속성
      </button>
    </div>
  );
}
