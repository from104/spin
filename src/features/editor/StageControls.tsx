// §6.4 줌 컨트롤(a11y blocker — "줌/팬은 필수 기능이다") + 격자/골 지역 가이드 토글.
// 코트 위 우상단에 떠 있는 44×44 버튼 묶음.
import type { CSSProperties } from 'react';
import { IconPlus } from '../../ui/icons.tsx';

export interface StageControlsProps {
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  showGrid: boolean;
  onToggleGrid(): void;
  showRuleZones: boolean;
  onToggleRuleZones(): void;
}

const BTN: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--panel) 82%, transparent)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
};

export function StageControls({ onZoomIn, onZoomOut, onZoomReset, showGrid, onToggleGrid, showRuleZones, onToggleRuleZones }: StageControlsProps) {
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
    </div>
  );
}
