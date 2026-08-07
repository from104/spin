// §6.10 편집기 도구 8종 레일. 프로토타입 template.html 239–248행(66px 레일, 50×48 버튼) 을
// 이식하되 버튼은 §6.10 이 지정한 52×50(라벨 11px)으로 키운다 — 레일 높이 검증(§6.10):
// 8×50 + 7×5 + 26 + 코트라벨 30 = 491px < 최소 뷰포트 600 − 헤더 62 = 538px.
import { useId } from 'react';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { CONE_COLORS } from '../../core/colors.ts';
import { TOOLS } from './toolDefs.ts';

export interface UnplacedChair {
  id: ChairId;
  number: string;
  color: string;
  ink: string;
}

export interface ToolRailProps {
  tool: ToolId;
  onSelectTool(id: ToolId): void;
  coneSlot: 0 | 1;
  onConeSlotChange(slot: 0 | 1): void;
  ballCount: number;
  ballMax: number;
  unplacedChairs: readonly UnplacedChair[];
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  courtLabel: string;
}

const RAIL_STYLE = {
  flex: 'none',
  width: 66,
  borderRight: '1px solid var(--border)',
  background: 'var(--panel)',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 5,
  padding: '13px 0',
  position: 'relative' as const,
};

export function ToolRail({
  tool,
  onSelectTool,
  coneSlot,
  onConeSlotChange,
  ballCount,
  ballMax,
  unplacedChairs,
  pendingPlayerId,
  onArmPlayer,
  courtLabel,
}: ToolRailProps) {
  const coneFlyoutId = useId();
  const playerFlyoutId = useId();

  return (
    <nav aria-label="도구" style={RAIL_STYLE}>
      {TOOLS.map((t) => {
        const active = t.id === tool;
        const isBallCapped = t.id === 'ball' && ballCount >= ballMax;
        const isPlayerEmpty = t.id === 'player' && unplacedChairs.length === 0;
        const describedBy = isBallCapped ? 'ball-cap-hint' : undefined;
        return (
          <div key={t.id} style={{ position: 'relative' }}>
            <button
              type="button"
              title={`${t.label} (${t.digit})`}
              aria-pressed={active}
              aria-disabled={isBallCapped || isPlayerEmpty || undefined}
              aria-describedby={describedBy}
              aria-haspopup={t.id === 'cone' || t.id === 'player' ? 'true' : undefined}
              aria-expanded={t.id === 'cone' || t.id === 'player' ? active : undefined}
              aria-controls={t.id === 'cone' ? coneFlyoutId : t.id === 'player' ? playerFlyoutId : undefined}
              onClick={() => {
                if (t.id === 'cone' && active) {
                  onConeSlotChange(coneSlot === 0 ? 1 : 0); // §6.10 "활성 상태에서 다시 클릭 = 색 토글"
                  return;
                }
                onSelectTool(t.id);
              }}
              style={{
                position: 'relative',
                width: 52,
                height: 50,
                borderRadius: 11,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color: active ? 'var(--accent-text)' : 'var(--muted)',
                opacity: isBallCapped || isPlayerEmpty ? 0.5 : 1,
              }}
            >
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 11,
                    border: '1.5px solid var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  }}
                />
              )}
              <span style={{ position: 'relative', display: 'flex' }}>
                <t.Icon />
              </span>
              <span style={{ position: 'relative', fontSize: '0.6875rem', fontWeight: 600 }}>{t.label}</span>
              {t.id === 'cone' && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: 6,
                    bottom: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: CONE_COLORS[coneSlot],
                    border: '1px solid rgba(0,0,0,.4)',
                  }}
                />
              )}
              {t.id === 'ball' && ballCount > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: ballCount >= 8 ? 'var(--accent-text)' : 'var(--faint-text)',
                  }}
                >
                  {ballCount}/{ballMax}
                </span>
              )}
            </button>

            {t.id === 'ball' && isBallCapped && (
              <span id="ball-cap-hint" className="sr-only">
                최대 10개 도달
              </span>
            )}

            {t.id === 'cone' && active && (
              <div
                id={coneFlyoutId}
                role="radiogroup"
                aria-label="콘 색상"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  marginLeft: 8,
                  zIndex: 20,
                  display: 'flex',
                  gap: 6,
                  padding: 8,
                  borderRadius: 12,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--panel)',
                  boxShadow: '0 12px 26px -10px rgba(0,0,0,.55)',
                }}
              >
                {CONE_COLORS.map((c, i) => {
                  const idx = i as 0 | 1;
                  const checked = coneSlot === idx;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={idx === 0 ? '주황 콘' : '분홍 콘'}
                      onClick={() => onConeSlotChange(idx)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: checked ? '2px solid var(--accent)' : '1px solid var(--border)',
                      }}
                    >
                      <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', background: c }} />
                    </button>
                  );
                })}
              </div>
            )}

            {t.id === 'player' && active && (
              <div
                id={playerFlyoutId}
                aria-label="배치할 선수"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  marginLeft: 8,
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 8,
                  borderRadius: 12,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--panel)',
                  boxShadow: '0 12px 26px -10px rgba(0,0,0,.55)',
                  minWidth: 160,
                }}
              >
                {unplacedChairs.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--faint-text)', padding: '0 4px' }}>미배치 선수 없음</span>
                ) : (
                  unplacedChairs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={pendingPlayerId === c.id}
                      onClick={() => onArmPlayer(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minHeight: 44,
                        padding: '0 8px',
                        borderRadius: 8,
                        border: pendingPlayerId === c.id ? '1.5px solid var(--accent)' : '1px solid transparent',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          flex: 'none',
                          width: 19,
                          height: 26,
                          borderRadius: 5,
                          background: c.color,
                          border: '1.5px solid rgba(255,255,255,.85)',
                          color: c.ink,
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {c.number}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>코트에 배치</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 'auto', fontSize: '0.5625rem', color: 'var(--faint-text)', textAlign: 'center', lineHeight: 1.5, padding: '0 4px' }}>
        {courtLabel}
      </div>
    </nav>
  );
}
