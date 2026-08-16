// 진영 표시 — 골라인 **바로 뒤**에 그 골을 지키는 팀의 삼각 깃발 둘 (기현 지시 2026-08-15/16).
//
// *"진영을 직관적으로 표시하려면 골라인 바로 뒤에 적당한 크기의 색이 있는 점을 표시하면 됨"*
// *"점 2개 표시해야 해. 골리, 일반"* (2026-08-15)
// *"진영 표시 원이 직관적으로 공과 혼돈할 수있으니 삼각형 깃발 형대로. 안에 G,P 표기해서."*
// *"깃발은 정삼각형에 꼭지점이 다 오른쪽을 향할것. 골라인과는 0.5미터 떨어져 둘것"* (2026-08-16)
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
import { PX_PER_M } from '../core/units.ts';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { TeamSide, TeamStyle } from '../model/drill.ts';
import { defaultDefense, defendedZones } from '../model/rules.ts';
import { uprightAt, useStageRot } from './stageRot.tsx';

// ── 모양은 **정삼각형 하나**, 방향은 **언제나 오른쪽** (기현 지시 2026-08-16) ──────────────
// 처음에는 골라인에 밑변을 대고 판 밖으로 꼭짓점을 보냈다 — 즉 왼쪽 골의 깃발은 왼쪽을,
// 오른쪽 골의 깃발은 오른쪽을 향했다. 코치가 판을 볼 때 그 둘은 **다른 표식**으로 읽힌다.
// 방향을 하나로 묶으면 네 깃발이 한 종류가 되고, 남는 차이는 색과 글자뿐이다 — 그 둘이
// 이 표식이 실제로 말하려는 것이다. 깃대를 지운 것도 같은 이유다: 지시가 '정삼각형' 이고,
// 삐져나온 깃대는 여백 예산(아래)을 먹으면서 모양을 흐린다.
//
// ⚠️ '오른쪽' 은 **판의 좌표계**다. 태블릿 90° 회전(§6.4)에서는 판 전체가 도니까 화면에서는
//    아래를 향한다 — 칩·골대와 같은 세계에 사는 것이 옳다. 글자만 바로 세운다.
//
// ── 여백 예산 ───────────────────────────────────────────────────────────────────────
// 골라인 바깥 여백은 `MARGIN_PX` = 1.5 m = **37.5 월드 px** 이고 viewBox 는 딱 거기서 끝난다
// (넘으면 그냥 잘린다). 골라인에서 0.5 m(12.5) 띄우고 나면 **25 px** 이 남는다.
//   · 세로 골라인(풀) — 삼각형이 여백 쪽으로 먹는 길이는 **높이**(변×√3/2 ≈ 20.8) 다.
//   · 가로 골라인(하프) — 밑변이 골라인과 수직이므로 먹는 길이는 **한 변**(24) 이다.
// 그래서 한 변의 상한을 정하는 것은 하프 코트다: 24 + 12.5 = 36.5 ≤ 37.5.
/** 골라인에서 삼각형의 **가장 가까운 점**까지(월드 px). 0.5 m — 기현 지시 2026-08-16. */
export const SIDE_FLAG_GAP_PX = 0.5 * PX_PER_M;
/** 정삼각형 한 변(월드 px). 0.96 m. 위 예산에서 하프 코트가 정하는 상한(25)의 바로 아래다. */
export const SIDE_FLAG_SIDE_PX = 24;
/** 정삼각형 높이 — 한 변에서 파생한다. 손으로 20.8 을 적으면 변을 바꿨을 때 삼각형이 찌그러진다. */
export const SIDE_FLAG_H_PX = (SIDE_FLAG_SIDE_PX * Math.sqrt(3)) / 2;
/** 두 깃발 중심 사이(월드 px) — 골라인을 따라. 한 변(24)보다 커야 세로 골라인에서 안 겹친다. */
export const SIDE_FLAG_SPACING_PX = 30;
/** 글자 크기(월드 px). 무게중심 자리의 삼각형 높이는 한 변의 2/3 = 16 이라 위아래가 안 닿는다. */
const INK_SIZE_PX = 11;
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
              // 삼각형은 **판 좌표계에 고정**이다(꼭짓점이 오른쪽). 골라인 방향과 무관하므로
              // 자리만 (바깥 o, 골라인 a) 두 축으로 잡고, 모양은 상자 중심에서 바로 찍는다.
              //
              // 골라인에서 **가장 가까운 점**이 정확히 0.5 m 여야 한다 — 그런데 어느 점이
              // 가장 가까운지가 골라인 방향에 따라 갈린다(세로 골라인이면 꼭짓점 또는 밑변,
              // 가로 골라인이면 밑변의 위/아래 끝). 그래서 상자 중심을 골라인에서
              // `0.5 m + 그 방향으로의 반폭` 만큼 민다 — 두 경우가 한 식으로 닫힌다.
              const reach = (Math.abs(p.ox) * SIDE_FLAG_H_PX + Math.abs(p.oy) * SIDE_FLAG_SIDE_PX) / 2;
              const cx = p.cx + p.ox * (SIDE_FLAG_GAP_PX + reach) + p.ax * f.t;
              const cy = p.cy + p.oy * (SIDE_FLAG_GAP_PX + reach) + p.ay * f.t;
              const hx = SIDE_FLAG_H_PX / 2;
              const hy = SIDE_FLAG_SIDE_PX / 2;
              // 글자는 **무게중심**에 앉는다 — 정삼각형에서 세 점의 평균이고, 꼭짓점 쪽으로
              // 더 밀면 좁아져서 글자가 빗변을 뚫는다.
              const inkX = cx - SIDE_FLAG_H_PX / 6;
              return (
                <g key={f.role} data-side-flag={f.role}>
                  <polygon
                    points={`${cx - hx},${cy - hy} ${cx - hx},${cy + hy} ${cx + hx},${cy}`}
                    fill={f.fill}
                    stroke={FLAG_STROKE}
                    strokeWidth={FLAG_STROKE_W}
                    strokeLinejoin="round"
                  />
                  {/* 글자는 **판이 돌아도 바로 선다**(§6.4) — 등번호·격자 라벨과 같은 규율이다.
                      옆으로 누운 G/P 는 색을 못 가리는 사람에게 남은 유일한 단서를 지운다. */}
                  <text
                    x={inkX}
                    y={cy}
                    transform={uprightAt(rot, inkX, cy)}
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
