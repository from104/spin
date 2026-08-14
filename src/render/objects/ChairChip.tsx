// §3.4 "피벗 원점 렌더 규약" 그대로 이식. `<g>` 에는 transform prop 을 절대 주지 않는다
// (§6.1 규칙 1) — 위치는 TransformWriter 가 마운트된 ref 에 직접 쓴다.
import { memo, useEffect, useRef } from 'react';
import { LockTintRect } from './LockTint.tsx';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { CHAIR } from '../../core/constants.ts';
import { inkFor, strokeFor } from '../../core/colors.ts';
import type { ChairId } from '../../core/ids.ts';
import type { TransformWriter } from '../transformWriter.ts';
import type { ZoneConfig } from '../../model/chair.ts';
import type { TeamSide } from '../../model/drill.ts';
import { teamPatternFor } from '../teamMark.ts';
import { ZONE_CURSOR } from '../zoneCursors.ts';
import { useUprightTransform } from '../stageRot.tsx';

export interface ChairChipProps {
  id: ChairId;
  writer: TransformWriter;
  color: string;
  /** 팀 소속. **색이 아닌 채널**(테두리 파선·볼가드 톤)의 유일한 입력이다 — 4.6.
   *  ⚠️ 선택(optional)으로 내리지 마라. 필수라서 새 호출자가 생길 때 tsc 가 먼저 잡는다.
   *  빠뜨리면 그 칩은 색 하나로만 갈리는 상태로 조용히 돌아간다(색각 이상·흑백 인쇄 결함). */
  team: TeamSide;
  number: string;
  selected: boolean;
  /** 잠김(2026-08-14) — 이동만 막힌 상태. 붉은 테두리로 표시한다. */
  locked?: boolean;
  /** 로빙 tabindex 대상(§7.5b `aria-activedescendant`). */
  active: boolean;
  ariaLabel: string;
  /** 넘기면 차체 위 4개 존에 각각 다른 마우스 커서를 얹는다(편집기 전용).
   *  시연 화면은 드래그가 없으므로 넘기지 않는다. */
  zoneCursors?: ZoneConfig | null;
  onPointerDown?: (id: ChairId, e: ReactPointerEvent<SVGGElement>) => void;
  onKeyDown?: (id: ChairId, e: ReactKeyboardEvent<SVGGElement>) => void;
}

const FONT = "'Space Grotesk',sans-serif";
const HALF_W = CHAIR.widthPx / 2;
/** 칩에 찍는 글자(등번호와 골키퍼 'G') 크기. 2026-08-11 기현 지시로 20 의 2/3 로 줄였다 —
 *  칩 위에 존 음영·선택 링·가이드가 겹치면서 글자가 차체를 꽉 채워 답답했다.
 *  유도식을 남겨 둔다: 원래 20, 지금 20 × 2/3. 값만 바꾸면 근거가 사라진다. */
const LABEL_FONT_PX = (20 * 2) / 3;

/** 선택 링 여백(월드 px). 차체 테두리(2.2)와 겹치지 않게 띄운다. */
const SEL_PAD = 3.5;

/** s∈[0,1] 을 차체 로컬 x 로 옮긴다. s=0 이 뒤끝(−pivotToRear), s=1 이 앞범퍼(+pivotToFront). */
const sToX = (s: number): number => -CHAIR.pivotToRearPx + s * CHAIR.lengthPx;

/** 선택된 차체에 비치는 존 음영(기현 지시 2026-08-11). 그대로 이동이 진하고 제자리 회전이
 *  약하다 — 강도 차이가 곧 "여기를 잡으면 통째로 끌린다 / 여기는 제자리에서 돈다" 의 신호다.
 *  견인은 차체 밖 가이드 전용이라 차체에는 칠할 것이 없다. */
const ZONE_TINT: Record<'towRear' | 'translate' | 'spin' | 'towFront', string> = {
  towRear: 'transparent',
  translate: 'rgba(255,255,255,.22)',
  spin: 'rgba(255,255,255,.07)',
  towFront: 'transparent',
};

/** 존 경계로 차체를 4구간으로 자른다. 경계값은 설정에서 바뀔 수 있어 매번 계산한다. */
function zoneSpans(z: ZoneConfig): { zone: 'towRear' | 'translate' | 'spin' | 'towFront'; x0: number; x1: number }[] {
  return [
    { zone: 'towRear' as const, x0: sToX(0), x1: sToX(z.sTowRearMax) },
    { zone: 'translate' as const, x0: sToX(z.sTowRearMax), x1: sToX(z.sSpinMin) },
    { zone: 'spin' as const, x0: sToX(z.sSpinMin), x1: sToX(z.sTowFrontMin) },
    { zone: 'towFront' as const, x0: sToX(z.sTowFrontMin), x1: sToX(1) },
  ];
}

export const ChairChip = memo(function ChairChip({
  id,
  writer,
  color,
  team,
  number,
  selected,
  locked = false,
  active,
  ariaLabel,
  zoneCursors,
  onPointerDown,
  onKeyDown,
}: ChairChipProps) {
  const bodyRef = useRef<SVGGElement | null>(null);
  const counterRef = useRef<SVGGElement | null>(null);
  const upright = useUprightTransform();

  useEffect(() => {
    writer.register(id, bodyRef.current);
    return () => writer.register(id, null);
  }, [writer, id]);
  useEffect(() => {
    writer.registerCounter(id, counterRef.current);
    return () => writer.registerCounter(id, null);
  }, [writer, id]);

  const ink = inkFor(color);
  // ⚠️ 6.5 — 칩의 선 색은 차체 밝기로 뒤집힌다(밝은 차체 → 어두운 선). 리터럴
  // `rgba(255,255,255,.92)` 로 되돌리면 **화면에서만** 밝은 차체의 파선이 사라진다
  // (PNG·인쇄는 teamMarkFor 를 거치므로 멀쩡한 채로 — 종이와 화면이 갈라지는 사고다).
  // 실측: #e08a12 2.50 → 7.28 · GK어웨이 #22a95b 2.80 → 6.44 · GK홈 #f2c811 1.55 → 11.84.
  const stroke = strokeFor(color);
  // 4.6 — 색 밖의 팀 채널. 화면에도 넣는 이유는 인쇄 때문만이 아니다: 적록 색각 이상(남성
  // 약 8%)에게는 #d93a3a / #1f6bb8 이 화면에서 이미 같은 색이다. 근거·크기 검산은
  // src/render/teamMark.ts 머리말. ⚠️ 아래 두 값을 리터럴로 되돌리면 그 사용자에게 판이
  // 통째로 무의미해진다.
  const pattern = teamPatternFor(team);

  return (
    <g
      ref={bodyRef}
      id={`obj-${id}`}
      className="court-obj"
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      tabIndex={active ? 0 : -1}
      onPointerDown={(e) => onPointerDown?.(id, e)}
      onKeyDown={(e) => onKeyDown?.(id, e)}
    >
      {/* 선택 링 — 차체보다 살짝 크게 둘러 그린다. 어두운 밑선 위에 액센트 파선을 얹어
          어떤 팀 색·코트 밝기에서도 보이게 한다(단색 한 겹이면 팀 색과 겹쳐 사라진다). */}
      {selected && (
        <g className="sel-ring" pointerEvents="none">
          <rect
            x={-CHAIR.pivotToRearPx - SEL_PAD}
            y={-HALF_W - SEL_PAD}
            width={CHAIR.lengthPx + SEL_PAD * 2}
            height={CHAIR.widthPx + SEL_PAD * 2}
            rx={5 + SEL_PAD}
            fill="none"
            stroke="rgba(0,0,0,.65)"
            strokeWidth={4.5}
          />
          <rect
            x={-CHAIR.pivotToRearPx - SEL_PAD}
            y={-HALF_W - SEL_PAD}
            width={CHAIR.lengthPx + SEL_PAD * 2}
            height={CHAIR.widthPx + SEL_PAD * 2}
            rx={5 + SEL_PAD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeDasharray="6 4"
          />
        </g>
      )}
      <rect
        x={-CHAIR.pivotToRearPx}
        y={-HALF_W}
        width={CHAIR.lengthPx}
        height={CHAIR.widthPx}
        rx={5}
        fill={color}
        stroke={stroke}
        strokeWidth={2.2}
        strokeDasharray={pattern.strokeDash}
      />
      {/* 볼가드 s∈[0.85,1.00] — 전방 견인 존의 시각적 힌트 */}
      <rect
        x={CHAIR.pivotToFrontPx - CHAIR.guardPx}
        y={-HALF_W}
        width={CHAIR.guardPx}
        height={CHAIR.widthPx}
        rx={2}
        fill={pattern.guardFill}
        stroke={stroke}
        strokeWidth={1.4}
      />
      {/* 두 구역의 음영. 어디를 잡으면 어떻게 되는지 커서만이 아니라 눈으로도 보여야 한다 —
          터치에는 커서가 없다(태블릿이 1순위 대상이다). 순수 시각용이라 pointer-events 를 끄고,
          커서·히트는 아래 최상단 레이어가 맡는다(등번호·머리 위에서도 커서가 바뀌게 하려면
          그 요소들보다 뒤에 와야 한다).
          **선택된 칩에만** 얹는다: 코트에 9대가 있는데 전부 존 커서를 물고 있으면
          어느 칩이 조작 대상인지 흐려지고, 지나가기만 해도 커서가 계속 바뀌어 시끄럽다. */}
      {selected && zoneCursors &&
        zoneSpans(zoneCursors)
          // 견인 존은 폭이 0 이다(경계가 차체 양끝에 붙어 있다) — 그리면 보이지 않는 0폭
          // 사각형이 커서만 물고 늘어진다.
          .filter((z) => z.x1 - z.x0 > 0.01)
          .map((z) => (
            <rect
              key={z.zone}
              className="zone-tint"
              x={z.x0}
              y={-HALF_W}
              width={z.x1 - z.x0}
              height={CHAIR.widthPx}
              // 2026-08-11 기현 지시: 뒤 1/3(그대로 이동)은 **진하게**, 앞 2/3(제자리 회전)은
              // **약하게** 비친다. 어디를 잡으면 어떻게 되는지 커서만이 아니라 눈으로도
              // 보여야 한다 — 터치에는 커서가 없다(태블릿이 1순위 대상이다).
              fill={ZONE_TINT[z.zone]}
              pointerEvents="none"
            />
          ))}
      {/* 머리 = 피벗 = 원점 */}
      <circle cx={0} cy={0} r={4.2} fill={stroke} />
      <g transform={`translate(${CHAIR.centroidOffsetPx} 0)`}>
        {/* writer 가 rotate(-θ) 를 기록한다 — 등번호는 절대 회전하지 않는다(§3.4). */}
        <g ref={counterRef}>
          {/* 스테이지가 90° 돌아 있으면 그만큼 더 되돌린다(§6.4). writer 가 쓰는 위 <g> 안쪽에
              두므로 두 회전이 곱해지고, 60fps 프레임 루프는 이 존재를 모른다. */}
          <g transform={upright}>
            <text
              x={0}
              y={0}
              fontFamily={FONT}
              fontSize={LABEL_FONT_PX}
              fontWeight={700}
              fill={ink}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {number}
            </text>
          </g>
        </g>
      </g>
      <rect
        className="focus-ind-outer"
        x={-CHAIR.pivotToRearPx - 3}
        y={-HALF_W - 3}
        width={CHAIR.lengthPx + 6}
        height={CHAIR.widthPx + 6}
        rx={8}
      />
      <rect
        className="focus-ind-inner"
        x={-CHAIR.pivotToRearPx - 3}
        y={-HALF_W - 3}
        width={CHAIR.lengthPx + 6}
        height={CHAIR.widthPx + 6}
        rx={8}
      />
      {/* 잠김 덮개 — **차체·볼가드·등번호보다 뒤에** 와야 한다(SVG 는 나중에 그린 것이 위다).
          ⚠️ 2026-08-14 에는 이 줄이 <g> 의 **첫 자식**이었다. 그래서 불투명한 차체가 덮개를
          통째로 가려 "잠갔는데 아무 표시도 안 난다" 가 됐다(기현 신고 2026-08-15). 테스트는
          `.lock-tint` 가 **있는지**만 봤기 때문에 초록이었다 — 있는 것과 보이는 것은 다르다.
          커서 레이어보다는 앞이다(아래 주석의 "마지막 자식" 계약은 그것의 것이다). */}
      {locked && (
        <LockTintRect
          x={-CHAIR.pivotToRearPx - SEL_PAD}
          y={-HALF_W - SEL_PAD}
          width={CHAIR.lengthPx + SEL_PAD * 2}
          height={CHAIR.widthPx + SEL_PAD * 2}
          rx={5 + SEL_PAD}
        />
      )}
      {/* 존 커서 레이어 — **차체의 마지막 자식**이어야 한다. 예전에는 음영 사각형이 커서까지
          맡았는데 그 위에 등번호·머리·포커스 링이 얹혀, 정작 눈이 가는 한가운데에서는 커서가
          기본 화살표로 돌아갔다. 투명하고 그림에 영향이 없으며, onPointerDown 은 부모 <g> 로
          버블링되므로 히트 처리도 그대로다. 세로로는 차체 폭 전체를 덮는다. */}
      {selected && zoneCursors &&
        zoneSpans(zoneCursors)
          .filter((z) => z.x1 - z.x0 > 0.01)
          .map((z) => (
            <rect
              key={`cur-${z.zone}`}
              className="zone-cursor"
              x={z.x0}
              y={-HALF_W}
              width={z.x1 - z.x0}
              height={CHAIR.widthPx}
              fill="transparent"
              style={{ cursor: ZONE_CURSOR[z.zone] }}
            />
          ))}
    </g>
  );
});
