// §6.10 판 가장자리 트레이 — **개체**(끌어다 놓는 말)와 **기능**(모드)을 나눠 담는다.
//
// 2026-08-11 기현 지시로 재편했다. 이전에는 8종이 한 줄로 섞여 있었고 개체도 "도구를 고르고
// 코트를 찍는" 2단계였는데, 공개판에서 두 카톡방이 독립적으로 "배치를 못 하겠다" 고 했다.
// 이제 개체는 트레이에 **말처럼 놓여 있고** 끌어다 놓으면 된다. 탭하면 예전 2단계도 그대로
// 동작한다(이미 그 방법을 익힌 사용자가 있다 — 김경일님이 방에서 대신 설명해 준 그 경로).
//
// 기능 도구는 모드라서 끌 것이 없다. 그래서 아래쪽에 따로 모은다.
import { Fragment, useId } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ChairId } from '../../core/ids.ts';
import type { ToolId } from '../../physics/index.ts';
import { CONE_COLORS } from '../../core/colors.ts';
import { CHAIR } from '../../core/constants.ts';
import { TOOLS } from './toolDefs.ts';
import type { TrayDragItem } from './useTrayDrag.ts';

/** 트레이의 선수 주차 슬롯. 배치 여부와 상관없이 **전원**이 자리를 유지한다 —
 *  코트에서 빼냈을 때 어디로 돌아가는지 보여야 하고, 트레이 길이도 들쭉날쭉하지 않는다. */
export interface ChairSlot {
  id: ChairId;
  number: string;
  color: string;
  ink: string;
  /** 코트에 나가 있는가. 참이면 빈 슬롯(점선)으로 그리고 끌 수 없다. */
  placed: boolean;
}

export interface ToolRailProps {
  tool: ToolId;
  onSelectTool(id: ToolId): void;
  coneSlot: 0 | 1;
  onConeSlotChange(slot: 0 | 1): void;
  ballCount: number;
  ballMax: number;
  /** 색깔별로 코트에 나가 있는 콘 수. 색마다 상한이 따로라 하나로 합칠 수 없다. */
  coneCounts: readonly [number, number];
  coneMax: number;
  chairSlots: readonly ChairSlot[];
  pendingPlayerId: ChairId | null;
  onArmPlayer(id: ChairId): void;
  courtLabel: string;
  /** 태블릿 세로에서는 트레이를 판 **아래**에 가로로 눕힌다(§6.4). */
  orientation?: 'vertical' | 'horizontal';
  /** 끌어다 놓기 연결(useTrayDrag.start). 없으면 탭만 동작한다 — 테스트·프리젠터용. */
  onItemPointerDown?(item: TrayDragItem, e: ReactPointerEvent, onTap: () => void): void;
}

/** 트레이 칩의 화면 크기. 코트 칩과 **같은 비율**(37.5 : 25)이되 **세로로 세워서** 쓴다
 *  (기현 지시 2026-08-11): 트레이는 세로 레일이라, 칩을 눕히면 두 개가 한 줄에 못 들어가
 *  줄당 하나가 되고 선수 8명이면 트레이가 두 배로 길어진다.
 *
 *  세워도 같은 물건으로 읽히는 이유는 비율·머리·볼가드가 그대로이기 때문이다 — 코트에서
 *  위를 향한 휠체어와 똑같은 그림이다. */
const TRAY_CHIP_H = 33;
const TRAY_CHIP_W = (TRAY_CHIP_H * CHAIR.widthPx) / CHAIR.lengthPx;
/** 칩을 감싸는 상자. 배치 여부와 상관없이 같은 크기라야 칸이 어긋나지 않고, 테두리·여백을
 *  안쪽으로 넣어야(border-box) 선택 테두리가 붙었다 떨어질 때 줄이 밀리지 않는다. */
const TRAY_CHIP_BOX = {
  flex: 'none' as const,
  boxSizing: 'border-box' as const,
  width: TRAY_CHIP_W + 8,
  height: TRAY_CHIP_H + 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
/** 칩 두 개 + 간격. 이 값이 세로 트레이의 폭을 정한다. */
const TRAY_CHIP_ROW_MAX = (TRAY_CHIP_W + 8) * 2 + 5;

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
  // 개체 그룹은 스크롤 컨테이너라 min-content 기여가 0 이다 — 안쪽 칩 줄이 아무리 넓어도
  // 트레이를 벌리지 못하고 조용히 잘린다. 폭은 여기서 못박는다.
  minWidth: TRAY_CHIP_ROW_MAX,
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
/** 상자 라벨이자 스크린리더 이름. 52px 폭에 '주황 콘'은 넘쳐서 화면에는 색 이름만 쓴다. */
const CONE_SLOT_NAMES = ['주황', '파랑'] as const;
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


/** 코트 칩의 축소판. 좌표계를 코트와 **똑같이** 쓰고(뷰박스가 곧 차체) 스케일만 다르므로,
 *  차체 치수를 바꾸면 트레이도 따라온다 — 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 *  코트에서 휠체어는 가로로 놓인다(앞이 오른쪽). 트레이만 세로로 세워 두면 같은 말이
 *  두 모습으로 보인다 — 머리(피벗)와 볼가드가 어느 쪽인지도 사라진다. */
function TrayChairArt({ color, ink, number, empty }: { color?: string; ink?: string; number: string; empty?: boolean }) {
  const half = CHAIR.widthPx / 2;
  return (
    <svg
      aria-hidden
      width={TRAY_CHIP_W}
      height={TRAY_CHIP_H}
      // 차체 좌표계는 코트와 **같다**(앞이 +x). 뷰박스만 가로세로를 바꿔 잡고 안쪽을 -90°
      // 돌려 앞이 위를 보게 한다 — 그림 자체를 다시 그리면 두 곳이 어긋나기 시작한다.
      viewBox={`${-half} ${-CHAIR.pivotToFrontPx} ${CHAIR.widthPx} ${CHAIR.lengthPx}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g transform="rotate(-90)">
      <rect
        x={-CHAIR.pivotToRearPx}
        y={-half}
        width={CHAIR.lengthPx}
        height={CHAIR.widthPx}
        rx={5}
        fill={empty ? 'none' : color}
        stroke={empty ? 'var(--border-strong)' : 'rgba(255,255,255,.92)'}
        strokeWidth={2.2}
        strokeDasharray={empty ? '5 4' : undefined}
      />
      {!empty && (
        <>
          {/* 볼가드(앞) · 머리(피벗) — 어느 쪽이 앞인지 알려 주는 두 표식 */}
          <rect
            x={CHAIR.pivotToFrontPx - CHAIR.guardPx}
            y={-half}
            width={CHAIR.guardPx}
            height={CHAIR.widthPx}
            rx={2}
            fill="rgba(255,255,255,.24)"
            stroke="rgba(255,255,255,.92)"
            strokeWidth={1.4}
          />
          <circle cx={0} cy={0} r={4.2} fill="rgba(255,255,255,.92)" />
        </>
      )}
      {/* 등번호는 되돌려 세운다. 코트에서도 칩이 아무리 돌아도 숫자는 절대 눕지 않는다
          (§3.4 — writer 가 rotate(-θ) 를 기록한다). 여기서는 그 θ 가 고정 90° 다. */}
      <g transform={`translate(${CHAIR.centroidOffsetPx} 0) rotate(90)`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill={empty ? 'var(--faint-text)' : ink}
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: (20 * 2) / 3 }}
        >
          {number}
        </text>
      </g>
      </g>
    </svg>
  );
}

/** 개체 **상자**. 트레이의 개체는 코트에 "그리는" 것이 아니라 상자에서 꺼내는 것이고,
 *  코트에서 도로 끌어다 넣으면 상자로 돌아간다. 안쪽 그림자로 얕게 파인 홈을 만들어
 *  버튼(눌러서 켜는 것)이 아니라 담긴 것을 꺼내는 자리로 읽히게 한다. */
const BOX_STYLE = {
  ...BTN_STYLE,
  border: '1px solid var(--border-strong)',
  background: 'color-mix(in srgb, var(--text) 5%, transparent)',
  boxShadow: 'inset 0 2px 5px -2px rgba(0,0,0,.55)',
};

/** 상자에 **남은** 개수. 코트에 놓은 수가 아니다 — 손이 다음에 알고 싶은 것은
 *  "몇 개 놓았나"가 아니라 "몇 개 더 꺼낼 수 있나"다. 0이면 상자가 빈 것으로 보인다. */
function RemainingBadge({ n }: { n: number }) {
  const empty = n <= 0;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        padding: '0 3px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: '0.625rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        border: '1px solid var(--border-strong)',
        background: empty ? 'transparent' : 'var(--panel)',
        color: empty ? 'var(--faint-text)' : 'var(--text)',
      }}
    >
      {n}
    </span>
  );
}

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
  coneCounts,
  coneMax,
  chairSlots,
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
  const ballHintId = useId();
  const coneHintId = useId();
  const ballRemaining = Math.max(0, ballMax - ballCount);
  const isBallCapped = ballRemaining <= 0;

  /** 끌 수 있는 개체 버튼의 공통 배선. 문턱을 못 넘으면 onTap 이 불린다(=예전 2단계 경로).
   *  style 은 여기서 주지 않는다 — 호출부가 자기 style 과 합쳐야 해서 섞이면 순서 사고가 난다.
   *  대신 `touchAction:'none'` 을 각 버튼 style 에 직접 넣는다(빠지면 태블릿에서 드래그 도중
   *  브라우저가 스크롤·확대로 포인터를 가져가 세션이 끊긴다). */
  const dragProps = (item: TrayDragItem, onTap: () => void) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      if (onItemPointerDown) onItemPointerDown(item, e, onTap);
    },
    // 끌어다 놓기를 못 쓰는 환경(키보드·보조기기 포함)에서도 탭은 되어야 한다.
    // 배선된 경로에서는 마우스 탭을 pointerdown(useTrayDrag 문턱)이 처리하므로, 여기서
    // 조건 없이 onTap 을 부르면 **이중 발화**다. 키보드 활성화(Enter·Space)는 pointerdown
    // 없이 click 만 오고 그때 detail 이 0 이다 — 그 경우만 통과시킨다(§5.6).
    onClick: (e: ReactMouseEvent) => {
      if (!onItemPointerDown || e.detail === 0) onTap();
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
    // data-tray: 코트에서 끌어온 개체를 여기 놓으면 빼낸다(useEditorPointer 가 좌표로 찾는다).
    <nav aria-label="도구" data-tray="" style={horiz ? RAIL_STYLE_H : RAIL_STYLE}>
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
            // 세로 트레이는 이 줄이 폭을 정한다 — maxWidth 만 두면 부모(nav)가 더 좁을 때
            // 조용히 한 줄에 하나만 들어가고, 선수 8명이면 트레이가 두 배로 길어진다.
            ...(horiz ? {} : { width: TRAY_CHIP_ROW_MAX, minWidth: TRAY_CHIP_ROW_MAX }),
          }}
        >
          {chairSlots.map((c) => {
            const armed = pendingPlayerId === c.id;
            // 나가 있는 선수는 **빈 자리**로 남긴다. 버튼이 아니라 표식이라 끌 수도, 누를 수도 없다.
            if (c.placed) {
              return (
                <span
                  key={c.id}
                  aria-hidden="true"
                  title={`${c.number}번 — 코트에 나가 있습니다. 코트에서 이리로 끌어다 놓으면 돌아옵니다.`}
                  style={{ ...TRAY_CHIP_BOX, opacity: 0.5 }}
                >
                  <TrayChairArt number={c.number} empty />
                </span>
              );
            }
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={armed}
                aria-label={`${c.number}번 선수 배치`}
                title={`${c.number}번 — 끌어다 놓거나 탭한 뒤 코트를 누르세요`}
                {...dragProps({ kind: 'player', chairId: c.id }, () => onArmPlayer(c.id))}
                style={{
                  ...TRAY_CHIP_BOX,
                  touchAction: 'none',
                  position: 'relative',
                  borderRadius: 7,
                  border: armed ? '2px solid var(--accent)' : '2px solid transparent',
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))',
                }}
              >
                <TrayChairArt color={c.color} ink={c.ink} number={c.number} />
              </button>
            );
          })}
        </div>

        {/* 공 상자 */}
        <button
          type="button"
          title={
            isBallCapped
              ? `${BALL_TOOL.label} — 상자가 비었습니다. 코트의 공을 트레이로 끌어다 놓으면 돌아옵니다.`
              : `${BALL_TOOL.label} (${BALL_TOOL.digit}) — ${ballRemaining}개 남음, 끌어다 놓으세요`
          }
          aria-pressed={tool === 'ball'}
          aria-disabled={isBallCapped || undefined}
          aria-describedby={ballHintId}
          {...dragProps({ kind: 'ball' }, () => onSelectTool('ball'))}
          style={{
            ...BOX_STYLE,
            touchAction: 'none',
            color: tool === 'ball' ? 'var(--accent-text)' : 'var(--muted)',
            opacity: isBallCapped ? 0.5 : 1,
          }}
        >
          {tool === 'ball' && <ActiveRing />}
          <span style={{ position: 'relative', display: 'flex' }}>
            <BALL_TOOL.Icon />
          </span>
          <span
            style={{
              position: 'relative',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            {BALL_TOOL.label}
          </span>
          <RemainingBadge n={ballRemaining} />
        </button>
        {/* 남은 개수는 이름이 아니라 **설명**이다. 이름에 넣으면 개수가 바뀔 때마다
            같은 버튼이 다른 것으로 들리고, 이름으로 찾는 코드도 전부 깨진다. */}
        <span id={ballHintId} className="sr-only">
          {isBallCapped ? `상자가 비었습니다 — 최대 ${ballMax}개` : `${ballRemaining}개 남음`}
        </span>

        {/* 콘 상자 — 색마다 따로 둔다(기현 지시 2026-08-11). 예전에는 한 버튼을 다시 눌러
            색을 바꾸는 팝오버였는데, 색마다 남은 개수가 따로 있으면 배지 하나로 둘을
            나타낼 수 없다. 상자를 나누면 어느 색이 몇 개 남았는지가 누르기 전에 보인다. */}
        {CONE_COLORS.map((color, i) => {
          const idx = i as 0 | 1;
          const name = CONE_SLOT_NAMES[idx];
          const remaining = Math.max(0, coneMax - coneCounts[idx]);
          const empty = remaining <= 0;
          const active = tool === 'cone' && coneSlot === idx;
          return (
            <Fragment key={color}>
              <button
                type="button"
                aria-label={`${name} 콘`}
                aria-pressed={active}
                aria-disabled={empty || undefined}
                aria-describedby={`${coneHintId}-${idx}`}
                title={
                  empty
                    ? `${name} 콘 — 상자가 비었습니다. 코트의 콘을 트레이로 끌어다 놓으면 돌아옵니다.`
                    : `${name} 콘 — ${remaining}개 남음, 끌어다 놓으세요`
                }
                {...dragProps({ kind: 'cone', coneSlot: idx }, () => {
                  onConeSlotChange(idx);
                  onSelectTool('cone');
                })}
                style={{
                  ...BOX_STYLE,
                  touchAction: 'none',
                  color: active ? 'var(--accent-text)' : 'var(--muted)',
                  opacity: empty ? 0.5 : 1,
                }}
              >
                {active && <ActiveRing />}
                <span style={{ position: 'relative', display: 'flex', color }}>
                  <CONE_TOOL.Icon />
                </span>
                <span
                  style={{
                    position: 'relative',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                  }}
                >
                  {name}
                </span>
                <RemainingBadge n={remaining} />
              </button>
              {/* 공 상자와 같은 이유로 설명이다. 게다가 aria-label 이 붙은 버튼은
                안쪽 텍스트가 아예 낭독되지 않아, 넣어 봐야 들리지 않는다. */}
              <span id={`${coneHintId}-${idx}`} className="sr-only">
                {empty ? `상자가 비었습니다 — 최대 ${coneMax}개` : `${remaining}개 남음`}
              </span>
            </Fragment>
          );
        })}
      </div>

      {divider}

      {/* ─── 기능: 모드. 끌 것이 없다. ─── */}
      <div
        aria-label="기능"
        role="group"
        style={{
          flex: 'none',
          display: 'flex',
          flexDirection: horiz ? 'row' : 'column',
          alignItems: 'center',
          gap: 5,
        }}
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
              style={{
                ...BTN_STYLE,
                color: active ? 'var(--accent-text)' : 'var(--muted)',
              }}
            >
              {active && <ActiveRing />}
              <span style={{ position: 'relative', display: 'flex' }}>
                <t.Icon />
              </span>
              <span
                style={{
                  position: 'relative',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {!horiz && (
        <div
          style={{
            marginTop: 'auto',
            fontSize: '0.5625rem',
            color: 'var(--faint-text)',
            textAlign: 'center',
            lineHeight: 1.5,
            padding: '0 4px',
          }}
        >
          {courtLabel}
        </div>
      )}
    </nav>
  );
}
