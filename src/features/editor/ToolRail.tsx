// §6.10 판 가장자리 트레이 — **개체**(끌어다 놓는 말)와 **기능**(모드)을 나눠 담는다.
//
// 2026-08-11 기현 지시로 재편했다. 이전에는 8종이 한 줄로 섞여 있었고 개체도 "도구를 고르고
// 코트를 찍는" 2단계였는데, 공개판에서 두 카톡방이 독립적으로 "배치를 못 하겠다" 고 했다.
// 이제 개체는 트레이에 **말처럼 놓여 있고** 끌어다 놓으면 된다. 탭하면 예전 2단계도 그대로
// 동작한다(이미 그 방법을 익힌 사용자가 있다 — 김경일님이 방에서 대신 설명해 준 그 경로).
//
// 기능 도구는 모드라서 끌 것이 없다. 그래서 아래쪽에 따로 모은다.
import { useId } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { CONE_COLORS } from '../../core/colors.ts';
import { TOOLS } from './toolDefs.ts';
import type { TrayDragItem } from './useTrayDrag.ts';

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
  /** 태블릿 세로에서는 트레이를 판 **아래**에 가로로 눕힌다(§6.4). */
  orientation?: 'vertical' | 'horizontal';
  /** 끌어다 놓기 연결(useTrayDrag.start). 없으면 탭만 동작한다 — 테스트·프리젠터용. */
  onItemPointerDown?(item: TrayDragItem, e: ReactPointerEvent, onTap: () => void): void;
}

/** 트레이는 **판의 일부**다(기현 결정 2026-08-11) — 배경을 코트 패널과 같은 `--panel-2` 로 두어
 *  패널 경계가 보이지 않게 하고, 대신 안쪽 그림자로 얕은 홈을 판다. 실제 전술판에서 말이
 *  놓여 있는 가장자리처럼 보이게 하는 것이 목적이라, 별도 패널 색(`--panel`)을 쓰지 않는다. */
const RAIL_BASE = {
  flex: 'none',
  background: 'var(--panel-2)',
  display: 'flex',
  gap: 6,
  position: 'relative' as const,
};

const RAIL_STYLE = {
  ...RAIL_BASE,
  width: 78,
  // 판 오른쪽 가장자리의 홈. 선 하나로 자르면 다시 별도 패널로 보인다.
  boxShadow: 'inset 7px 0 12px -10px rgba(0,0,0,.55)',
  flexDirection: 'column' as const,
  alignItems: 'center',
  padding: '13px 0',
};

/** 가로 트레이 — 세로 화면에서 판 아래. 항목이 많아 좁은 태블릿에서는 넘칠 수 있어 가로
 *  스크롤을 연다(줄바꿈하면 트레이 높이가 들쭉날쭉해져 코트 크기가 흔들린다). */
const RAIL_STYLE_H = {
  ...RAIL_BASE,
  boxShadow: 'inset 0 7px 12px -10px rgba(0,0,0,.55)',
  flexDirection: 'row' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 13px',
  overflowX: 'auto' as const,
};

const BALL_TOOL = TOOLS.find((t) => t.id === 'ball')!;
const CONE_TOOL = TOOLS.find((t) => t.id === 'cone')!;
/** 모드 도구 — 끌 것이 없다. 'player' 는 트레이에 칩으로 직접 놓이므로 여기서 뺀다
 *  (키보드 단축키 a/6 은 toolDefs 에 그대로 살아 있다). */
const FUNCTION_TOOLS = TOOLS.filter((t) => t.id !== 'ball' && t.id !== 'cone' && t.id !== 'player');

const BTN_STYLE = {
  position: 'relative' as const,
  width: 52,
  height: 50,
  borderRadius: 11,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
};

function ActiveRing() {
  return (
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
  );
}

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
  orientation = 'vertical',
  onItemPointerDown,
}: ToolRailProps) {
  const horiz = orientation === 'horizontal';
  // ⚠️ 세로 트레이는 **판 오른쪽**에 있으므로 플라이아웃을 왼쪽(코트 쪽)으로 편다. 오른쪽으로
  // 펴면 화면 밖이다 — 트레이가 왼쪽에 있던 시절의 `left:'100%'` 를 그대로 두면 콘 색 선택이
  // 통째로 잘린다. 가로 트레이는 판 아래에 있으니 위쪽으로 편다(같은 이유).
  const flyoutAnchor = horiz ? { bottom: '100%', left: 0, marginBottom: 8 } : { right: '100%', top: 0, marginRight: 8 };
  const coneFlyoutId = useId();
  const isBallCapped = ballCount >= ballMax;

  /** 끌 수 있는 개체 버튼의 공통 배선. 문턱을 못 넘으면 onTap 이 불린다(=예전 2단계 경로).
   *  style 은 여기서 주지 않는다 — 호출부가 자기 style 과 합쳐야 해서 섞이면 순서 사고가 난다.
   *  대신 `touchAction:'none'` 을 각 버튼 style 에 직접 넣는다(빠지면 태블릿에서 드래그 도중
   *  브라우저가 스크롤·확대로 포인터를 가져가 세션이 끊긴다). */
  const dragProps = (item: TrayDragItem, onTap: () => void) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (onItemPointerDown) onItemPointerDown(item, e, onTap);
    },
    // 끌어다 놓기를 못 쓰는 환경(키보드·보조기기 포함)에서도 탭은 되어야 한다.
    onClick: () => {
      if (!onItemPointerDown) onTap();
    },
  });

  const divider = (
    <div
      aria-hidden
      style={{
        flex: 'none',
        alignSelf: 'stretch',
        ...(horiz
          ? { width: 1, margin: '6px 4px', background: 'var(--border)' }
          : { height: 1, margin: '4px 12px', background: 'var(--border)' }),
      }}
    />
  );

  return (
    <nav aria-label="도구" style={horiz ? RAIL_STYLE_H : RAIL_STYLE}>
      {/* ─── 개체: 판에 올려놓는 말. 끌어다 놓거나, 탭해서 고른 뒤 코트를 찍는다. ─── */}
      <div
        aria-label="개체"
        role="group"
        style={{
          flex: horiz ? 'none' : '0 1 auto',
          display: 'flex',
          flexDirection: horiz ? 'row' : 'column',
          alignItems: 'center',
          gap: 6,
          minHeight: 0,
          // 선수가 8명 다 미배치면 세로로 길다 — 트레이 안에서만 스크롤한다.
          ...(horiz ? { overflowX: 'auto' as const } : { overflowY: 'auto' as const, width: '100%' }),
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: horiz ? 'row' : 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 5,
            maxWidth: horiz ? undefined : 66,
          }}
        >
          {unplacedChairs.length === 0 ? (
            <span style={{ fontSize: '0.5625rem', color: 'var(--faint-text)', padding: '4px 2px', textAlign: 'center' }}>
              선수 모두 배치됨
            </span>
          ) : (
            unplacedChairs.map((c) => {
              const armed = pendingPlayerId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={armed}
                  aria-label={`${c.number}번 선수 배치`}
                  title={`${c.number}번 — 끌어다 놓거나 탭한 뒤 코트를 누르세요`}
                  {...dragProps({ kind: 'player', chairId: c.id }, () => onArmPlayer(c.id))}
                  style={{
                    touchAction: 'none',
                    position: 'relative',
                    flex: 'none',
                    width: 28,
                    height: 36,
                    borderRadius: 7,
                    background: c.color,
                    color: c.ink,
                    border: armed ? '2px solid var(--accent)' : '1.5px solid rgba(255,255,255,.85)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,.4)',
                  }}
                >
                  {c.number}
                </button>
              );
            })
          )}
        </div>

        {/* 공 */}
        <button
          type="button"
          title={`${BALL_TOOL.label} (${BALL_TOOL.digit}) — 끌어다 놓으세요`}
          aria-pressed={tool === 'ball'}
          aria-disabled={isBallCapped || undefined}
          aria-describedby={isBallCapped ? 'ball-cap-hint' : undefined}
          {...dragProps({ kind: 'ball' }, () => onSelectTool('ball'))}
          style={{
            ...BTN_STYLE,
            touchAction: 'none',
            color: tool === 'ball' ? 'var(--accent-text)' : 'var(--muted)',
            opacity: isBallCapped ? 0.5 : 1,
          }}
        >
          {tool === 'ball' && <ActiveRing />}
          <span style={{ position: 'relative', display: 'flex' }}>
            <BALL_TOOL.Icon />
          </span>
          <span style={{ position: 'relative', fontSize: '0.6875rem', fontWeight: 600 }}>{BALL_TOOL.label}</span>
          {ballCount > 0 && (
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
        {isBallCapped && (
          <span id="ball-cap-hint" className="sr-only">
            최대 10개 도달
          </span>
        )}

        {/* 콘 — 활성 상태에서 다시 누르면 색 토글(§6.10) */}
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            type="button"
            title={`${CONE_TOOL.label} (${CONE_TOOL.digit}) — 끌어다 놓으세요`}
            aria-pressed={tool === 'cone'}
            aria-haspopup="true"
            aria-expanded={tool === 'cone'}
            aria-controls={coneFlyoutId}
            {...dragProps({ kind: 'cone' }, () => {
              if (tool === 'cone') onConeSlotChange(coneSlot === 0 ? 1 : 0);
              else onSelectTool('cone');
            })}
            style={{
              ...BTN_STYLE,
              touchAction: 'none',
              color: tool === 'cone' ? 'var(--accent-text)' : 'var(--muted)',
            }}
          >
            {tool === 'cone' && <ActiveRing />}
            <span style={{ position: 'relative', display: 'flex' }}>
              <CONE_TOOL.Icon />
            </span>
            <span style={{ position: 'relative', fontSize: '0.6875rem', fontWeight: 600 }}>{CONE_TOOL.label}</span>
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
          </button>

          {tool === 'cone' && (
            <div
              id={coneFlyoutId}
              role="radiogroup"
              aria-label="콘 색상"
              style={{
                position: 'absolute',
                ...flyoutAnchor,
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
        </div>
      </div>

      {divider}

      {/* ─── 기능: 모드. 끌 것이 없다. ─── */}
      <div
        aria-label="기능"
        role="group"
        style={{ flex: 'none', display: 'flex', flexDirection: horiz ? 'row' : 'column', alignItems: 'center', gap: 5 }}
      >
        {FUNCTION_TOOLS.map((t) => {
          const active = t.id === tool;
          return (
            <button
              key={t.id}
              type="button"
              title={`${t.label} (${t.digit})`}
              aria-pressed={active}
              onClick={() => onSelectTool(t.id)}
              style={{ ...BTN_STYLE, color: active ? 'var(--accent-text)' : 'var(--muted)' }}
            >
              {active && <ActiveRing />}
              <span style={{ position: 'relative', display: 'flex' }}>
                <t.Icon />
              </span>
              <span style={{ position: 'relative', fontSize: '0.6875rem', fontWeight: 600 }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {!horiz && (
        <div style={{ marginTop: 'auto', fontSize: '0.5625rem', color: 'var(--faint-text)', textAlign: 'center', lineHeight: 1.5, padding: '0 4px' }}>
          {courtLabel}
        </div>
      )}
    </nav>
  );
}
