// 진영 표시 — 골라인 **바로 뒤**에 그 골을 지키는 팀의 삼각 깃발 둘 (기현 지시 2026-08-15/16).
//
// *"진영을 직관적으로 표시하려면 골라인 바로 뒤에 적당한 크기의 색이 있는 점을 표시하면 됨"*
// *"점 2개 표시해야 해. 골리, 일반"* (2026-08-15)
// *"진영 표시 원이 직관적으로 공과 혼돈할 수있으니 삼각형 깃발 형대로. 안에 G,P 표기해서."*
//   (2026-08-16)
//
// ── 왜 원이 아닌가 ─────────────────────────────────────────────────────────────────
// 판 위에서 **원은 이미 공이다**. 진영 표시도 원이면 코치는 골라인 뒤에 공이 두 개 놓인 것으로
// 읽는다 — 특히 축소해서 판 전체를 볼 때, 색은 팀색이라 공과 구별되는 단서가 못 된다.
// 삼각 깃발은 판 위 어떤 개체와도 안 겹치는 모양이라(칩=둥근 사각, 공=원, 콘=삼각뿔이지만
// 코트 **안**에만 산다) 그 자체로 "이건 개체가 아니라 표식" 이라고 말한다.
//
// ── 왜 이제는 글자가 있는가 ───────────────────────────────────────────────────────
// 옛 주석은 *"두 점의 색이 곧 칩의 색이니 글자는 같은 말을 두 번 하는 것"* 이라 적었다. 그
// 논리는 **색을 가릴 수 있는 사람에게만** 성립한다 — 색맹·강한 조명·빛바랜 프로젝터에서는
// 두 점이 그냥 같은 점 둘이었고, 남는 단서는 "골키퍼가 언제나 안쪽" 이라는 순서뿐이었다.
// 순서는 하나를 가리고 보면 사라진다. `G`/`P` 는 **깃발 하나만 봐도** 읽히는 채널이다.
// 한글("골"/"일")이 아닌 이유: 골라인 뒤 여백은 1.5 m(37.5 월드 px)뿐이라 이 크기의 글자는
// 한 자만 들어가고, 한글 한 자는 같은 폭에서 라틴 대문자보다 훨씬 뭉갠다.
//
// ── 왜 코트 정의에서 계산하는가 ─────────────────────────────────────────────────────
// 골라인의 자리는 코트 종류·크기마다 다르고(풀은 좌우 세로선, 하프는 아래 가로선), 그 값은
// `courtDefFor` 하나가 갖는다. 좌표를 여기 리터럴로 적으면 25×14 판에서 깃발만 30×18 자리에
// 남는다 — `RuleZones` 가 같은 이유로 같은 규율을 지킨다.
//
// ⚠️ **플랫 코트에는 아무것도 안 그린다.** `ruleZones` 가 비어 있으므로 자연히 그렇게 되고,
// 그것이 곧 "플랫은 진영이 없다" 는 기현님 지시의 구현이다(버튼도 같은 조건으로 비활성이다).
import { memo } from 'react';
import { inkFor } from '../core/colors.ts';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { TeamSide, TeamStyle } from '../model/drill.ts';
import { defaultDefense, defendedZones } from '../model/rules.ts';
import { uprightAt, useStageRot } from './stageRot.tsx';

// ── 깃발은 **골라인에 깃대를 대고 밖으로 펄럭인다** ────────────────────────────────────
// 깃대(밑변)를 골라인과 나란히 두고 꼭짓점을 판 밖으로 보낸다. 이 방향이어야 하는 이유는
// 여백이 한 방향으로만 좁기 때문이다: 골라인 바깥 여백은 `MARGIN_PX` = 1.5 m = **37.5 월드
// px** 이고 viewBox 는 딱 거기서 끝난다(넘으면 그냥 잘린다). 반대로 골라인을 **따라가는**
// 방향은 코트 길이라 사실상 무한하다. 그래서 폭(깃대)은 넉넉히, 깊이(꼭짓점)는 37.5 안에서.
//
// 글자는 밑변 쪽 넓은 자리에 앉는다 — 꼭짓점 쪽은 좁아서 글자가 삼각형 밖으로 나간다.
/** 깃대(밑변)가 골라인에서 떨어진 거리(월드 px). 0 이면 라인에 붙어 라인을 지운다. */
export const SIDE_FLAG_BASE_PX = 5;
/** 깃대에서 꼭짓점까지(월드 px). `BASE + LEN` 이 37.5 를 넘으면 잘린다. */
export const SIDE_FLAG_LEN_PX = 30;
/** 깃대 반길이(월드 px) — 밑변 폭의 절반. */
export const SIDE_FLAG_HALF_PX = 11;
/** 깃대 중심 사이(월드 px) — 골라인을 따라. 밑변 폭(22)보다 커야 두 깃발이 안 겹친다. */
export const SIDE_FLAG_SPACING_PX = 32;
/** 글자 중심이 깃대에서 들어간 깊이(월드 px). 이 자리의 삼각형 폭은 22×(1−10/30) ≈ 14.7 이라
 *  11 px 글자가 위아래로 안 닿는다. 더 깊이 넣으면 좁아져서 글자가 변을 뚫는다. */
const INK_DEPTH_PX = 10;
/** 글자 크기(월드 px). */
const INK_SIZE_PX = 11;
/** 깃대가 밑변 양 끝에서 더 나가는 길이 — 이 삐져나온 조각이 삼각형을 **깃발로** 읽게 한다. */
const STAFF_OVERHANG_PX = 3;
/** 테두리 — 코트 밖 배경(#0b0f14 계열) 위에서도, 흰 라인 위에서도 깃발의 경계가 남는다. */
const FLAG_STROKE = '#0b0f14';
const FLAG_STROKE_W = 1.5;
const FONT = "'Space Grotesk',sans-serif";

export interface SideMarksProps {
  mode: CourtMode;
  size?: CourtSize;
  teams: Record<TeamSide, TeamStyle>;
  /** `ruleZones[0]` 을 지키는 팀. 없으면 `defaultDefense(mode)`. */
  defense?: TeamSide;
}

/** 존 하나의 깃발 둘이 앉을 자리·바깥 방향·**골라인 방향**.
 *
 *  존의 어느 변이 골라인인가는 **존이 경기면의 어느 끝에 붙어 있는가**로 정한다 — 풀 코트의
 *  왼쪽 존은 왼쪽 변, 오른쪽 존은 오른쪽 변, 하프 코트의 존은 아래 변이다. 모드 이름으로
 *  분기하지 않는 이유: 코트가 늘면 그 분기를 또 고쳐야 하는데, 기하는 이미 정의에 있다.
 *
 *  `ax/ay` 는 골라인을 따라가는 방향이다(바깥 방향에 수직). 세로 골라인(풀)이면 아래쪽,
 *  가로 골라인(하프)이면 오른쪽으로 잡는다 — 그래야 골키퍼 깃발이 언제나 **위/왼쪽**, 즉
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
  const rot = useStageRot();
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
        // 골키퍼 깃발이 언제나 **먼저**(세로 골라인이면 위, 가로 골라인이면 왼쪽)다. 글자가
        // 생긴 뒤로 이 순서는 유일한 비색 채널이 아니라 **거드는 채널**이다 — 그래도 지킨다.
        const half = SIDE_FLAG_SPACING_PX / 2;
        const flags = [
          { t: -half, role: 'gk', letter: 'G', fill: style.gkColor },
          { t: +half, role: 'field', letter: 'P', fill: style.color },
        ] as const;
        return (
          <g key={`${z.rect.x},${z.rect.y}`} data-side-mark={z.defender} data-side-index={i}>
            {flags.map((f) => {
              // 깃대 중심 → 깃대 양 끝 → 꼭짓점. 전부 (바깥 o, 골라인 a) 두 축의 합이라
              // 코트가 세로 골라인이든 가로 골라인이든 같은 식이 그대로 돈다.
              const bx = p.cx + p.ox * SIDE_FLAG_BASE_PX + p.ax * f.t;
              const by = p.cy + p.oy * SIDE_FLAG_BASE_PX + p.ay * f.t;
              const s1x = bx - p.ax * SIDE_FLAG_HALF_PX;
              const s1y = by - p.ay * SIDE_FLAG_HALF_PX;
              const s2x = bx + p.ax * SIDE_FLAG_HALF_PX;
              const s2y = by + p.ay * SIDE_FLAG_HALF_PX;
              const tipX = bx + p.ox * SIDE_FLAG_LEN_PX;
              const tipY = by + p.oy * SIDE_FLAG_LEN_PX;
              const inkX = bx + p.ox * INK_DEPTH_PX;
              const inkY = by + p.oy * INK_DEPTH_PX;
              const over = STAFF_OVERHANG_PX;
              return (
                <g key={f.role} data-side-flag={f.role}>
                  <polygon
                    points={`${s1x},${s1y} ${s2x},${s2y} ${tipX},${tipY}`}
                    fill={f.fill}
                    stroke={FLAG_STROKE}
                    strokeWidth={FLAG_STROKE_W}
                    strokeLinejoin="round"
                  />
                  <line
                    x1={s1x - p.ax * over}
                    y1={s1y - p.ay * over}
                    x2={s2x + p.ax * over}
                    y2={s2y + p.ay * over}
                    stroke={FLAG_STROKE}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  {/* 글자는 **판이 돌아도 바로 선다**(§6.4) — 등번호·격자 라벨과 같은 규율이다.
                      옆으로 누운 G/P 는 색을 못 가리는 사람에게 남은 유일한 단서를 지운다. */}
                  <text
                    x={inkX}
                    y={inkY}
                    transform={uprightAt(rot, inkX, inkY)}
                    fill={inkFor(f.fill)}
                    fontFamily={FONT}
                    fontSize={INK_SIZE_PX}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {f.letter}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
});
