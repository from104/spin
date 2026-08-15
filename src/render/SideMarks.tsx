// 진영 표시 — 골라인 **바로 뒤**에 그 골을 지키는 팀의 점 둘 (기현 지시 2026-08-15).
//
// *"진영을 직관적으로 표시하려면 골라인 바로 뒤에 적당한 크기의 색이 있는 점을 표시하면 됨"*
// *"점 2개 표시해야 해. 골리, 일반"*
//
// ── 왜 글자가 없는가 ────────────────────────────────────────────────────────────────
// 두 점의 색이 곧 **판 위 칩의 색**이다(골키퍼 색 · 일반 선수 색). 글자를 붙이면 같은 말을 두
// 번 하는 셈이고, 골라인 뒤 여백(1.5 m = 37.5 월드 px)에 한글을 넣으면 판을 벗어나거나 점이
// 작아진다. 색을 못 가리는 사람에게는 **골키퍼 점이 언제나 안쪽**이라는 순서가 남는다.
//
// ── 왜 코트 정의에서 계산하는가 ─────────────────────────────────────────────────────
// 골라인의 자리는 코트 종류·크기마다 다르고(풀은 좌우 세로선, 하프는 아래 가로선), 그 값은
// `courtDefFor` 하나가 갖는다. 좌표를 여기 리터럴로 적으면 25×14 판에서 점만 30×18 자리에
// 남는다 — `RuleZones` 가 같은 이유로 같은 규율을 지킨다.
//
// ⚠️ **플랫 코트에는 아무것도 안 그린다.** `ruleZones` 가 비어 있으므로 자연히 그렇게 되고,
// 그것이 곧 "플랫은 진영이 없다" 는 기현님 지시의 구현이다(버튼도 같은 조건으로 비활성이다).
import { memo } from 'react';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { TeamSide, TeamStyle } from '../model/drill.ts';
import { defaultDefense, defendedZones } from '../model/rules.ts';

// ── 두 점은 **골라인과 나란히** 눕는다 (기현 지시 2026-08-15) ─────────────────────────────
// 처음에는 골라인에서 바깥으로 **겹쳐 나가게**(수직) 놓았다. 그러면 여백 하나에 점 둘의 지름이
// 다 들어가야 해서 — 골라인 바깥 여백은 `MARGIN_PX` = 1.5 m = **37.5 월드 px** 이고 viewBox 는
// 딱 거기서 끝난다(넘으면 그냥 잘린다) — 점을 r=7 까지 줄여야 했고, 그러고도 하프 코트에서
// 한 번 잘렸다.
//
// 나란히 놓으면 여백은 **한 겹만** 쓰고(20+8=28 ≤ 37.5) 둘 사이는 골라인 방향으로 벌어진다.
// 그 방향은 코트 길이라 사실상 무한하다 — 그래서 점을 8 로 되돌렸다.
/** 점 반지름(월드 px). 0.64 m. */
export const SIDE_DOT_R_PX = 8;
/** 골라인에서 점 중심까지(월드 px). 둘 다 **같은 거리**다(나란하다는 것이 곧 이 뜻이다). */
export const SIDE_DOT_GAP_PX = 20;
/** 두 점 중심 사이(월드 px) — 골라인을 따라. 지름(16)보다 커야 서로 안 겹친다. */
export const SIDE_DOT_SPACING_PX = 20;
/** 테두리 — 코트 밖 배경(#0b0f14 계열) 위에서도, 흰 라인 위에서도 점의 경계가 남는다. */
const DOT_STROKE = '#0b0f14';
const DOT_STROKE_W = 1.5;

export interface SideMarksProps {
  mode: CourtMode;
  size?: CourtSize;
  teams: Record<TeamSide, TeamStyle>;
  /** `ruleZones[0]` 을 지키는 팀. 없으면 `defaultDefense(mode)`. */
  defense?: TeamSide;
}

/** 존 하나의 점 둘이 앉을 자리·바깥 방향·**골라인 방향**.
 *
 *  존의 어느 변이 골라인인가는 **존이 경기면의 어느 끝에 붙어 있는가**로 정한다 — 풀 코트의
 *  왼쪽 존은 왼쪽 변, 오른쪽 존은 오른쪽 변, 하프 코트의 존은 아래 변이다. 모드 이름으로
 *  분기하지 않는 이유: 코트가 늘면 그 분기를 또 고쳐야 하는데, 기하는 이미 정의에 있다.
 *
 *  `ax/ay` 는 골라인을 따라가는 방향이다(바깥 방향에 수직). 세로 골라인(풀)이면 아래쪽,
 *  가로 골라인(하프)이면 오른쪽으로 잡는다 — 그래야 골키퍼 점이 언제나 **위/왼쪽**, 즉
 *  읽는 순서의 처음에 온다. */
function markPlacement(zone: { x: number; y: number; w: number; h: number }, surface: { x: number; y: number; w: number; h: number }) {
  const EPS = 0.5;
  // 골라인 = 존이 맞닿아 있는 경기면의 변. 바깥 방향은 그 변에서 판 밖으로 나가는 쪽이다.
  if (Math.abs(zone.x - surface.x) < EPS) return { cx: surface.x, cy: zone.y + zone.h / 2, ox: -1, oy: 0, ax: 0, ay: 1 };
  if (Math.abs(zone.x + zone.w - (surface.x + surface.w)) < EPS)
    return { cx: surface.x + surface.w, cy: zone.y + zone.h / 2, ox: 1, oy: 0, ax: 0, ay: 1 };
  if (Math.abs(zone.y - surface.y) < EPS) return { cx: zone.x + zone.w / 2, cy: surface.y, ox: 0, oy: -1, ax: 1, ay: 0 };
  return { cx: zone.x + zone.w / 2, cy: surface.y + surface.h, ox: 0, oy: 1, ax: 1, ay: 0 };
}

export const SideMarks = memo(function SideMarks({ mode, size, teams, defense }: SideMarksProps) {
  const def = courtDefFor(mode, size);
  if (def.ruleZones.length === 0) return null; // 플랫 코트 — 진영이라는 개념이 없다
  const zones = defendedZones(def.ruleZones, defense ?? defaultDefense(mode));

  return (
    // 판정·조작과 무관한 표식이라 접근성 트리와 포인터에서 모두 뺀다. 진영을 **말로** 알리는
    // 것은 진영 버튼의 접근성 이름이 진다(FunctionBar/InspectorPanel).
    <g aria-hidden="true" pointerEvents="none" data-side-marks="">
      {zones.map((z, i) => {
        const p = markPlacement(z.rect, def.surface);
        const style = teams[z.defender];
        // 둘은 골라인에서 **같은 거리**에 있고, 골라인을 따라 좌우로 벌어진다.
        // 골키퍼 점이 언제나 **먼저**(세로 골라인이면 위, 가로 골라인이면 왼쪽)다 — 색을
        // 못 가려도 이 순서는 남는다. 두 점을 구별하는 유일한 비색(非色) 채널이다.
        const half = SIDE_DOT_SPACING_PX / 2;
        const dots: Array<{ t: number; fill: string }> = [
          { t: -half, fill: style.gkColor },
          { t: +half, fill: style.color },
        ];
        return (
          <g key={`${z.rect.x},${z.rect.y}`} data-side-mark={z.defender} data-side-index={i}>
            {dots.map((dot) => (
              <circle
                key={dot.t}
                cx={p.cx + p.ox * SIDE_DOT_GAP_PX + p.ax * dot.t}
                cy={p.cy + p.oy * SIDE_DOT_GAP_PX + p.ay * dot.t}
                r={SIDE_DOT_R_PX}
                fill={dot.fill}
                stroke={DOT_STROKE}
                strokeWidth={DOT_STROKE_W}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
});
