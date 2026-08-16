// 진영 표시 — 골라인 **바로 뒤**에 그 골을 지키는 팀의 삼각 깃발 둘 (기현 지시 2026-08-15/16).
//
// *"진영을 직관적으로 표시하려면 골라인 바로 뒤에 적당한 크기의 색이 있는 점을 표시하면 됨"*
// *"점 2개 표시해야 해. 골리, 일반"* (2026-08-15)
// *"진영 표시 원이 직관적으로 공과 혼돈할 수있으니 삼각형 깃발 형대로. 안에 G,P 표기해서."*
// *"깃발은 정삼각형에 꼭지점이 다 오른쪽을 향할것. 골라인과는 0.5미터 떨어져 둘것"* (2026-08-16)
// *"글자를 지우고 삼각형을 줄이고 깃발 깃대를 표현하자. 플래이어 종류는 휠체어 칩을 보면
//   직관적으로 알 수 있다."* (2026-08-16)
//
// ── 왜 원이 아닌가 ─────────────────────────────────────────────────────────────────
// 판 위에서 **원은 이미 공이다**. 진영 표시도 원이면 코치는 골라인 뒤에 공이 두 개 놓인 것으로
// 읽는다 — 특히 축소해서 판 전체를 볼 때, 색은 팀색이라 공과 구별되는 단서가 못 된다.
// 삼각 깃발은 판 위 어떤 개체와도 안 겹치는 모양이라(칩=둥근 사각, 공=원, 콘=삼각뿔이지만
// 코트 **안**에만 산다) 그 자체로 "이건 개체가 아니라 표식" 이라고 말한다.
//
// ── 글자(G/P)는 하루 만에 들어왔다 나갔다 — 기록으로 남긴다 ────────────────────────
// 넣은 근거: *"색만으로 가르면 색맹·강한 조명·빛바랜 프로젝터에서 두 깃발이 같은 깃발
// 둘이 된다"*. 뺀 근거(기현님, 판을 실제로 쓰는 사람): *"플래이어 종류는 휠체어 칩을 보면
// 직관적으로 알 수 있다"* — **골키퍼가 누구인지는 코트 위 칩이 이미 말하고 있다.** 진영
// 표시가 답해야 하는 질문은 "이 골을 어느 **팀**이 지키는가" 하나이고, 그 답은 팀색이다.
// 두 깃발의 색이 곧 그 팀의 두 색(골키퍼·일반)이므로 글자는 칩이 하는 말을 되풀이한 것이었다.
// 되살리려면 먼저 답해야 한다: **칩을 보고도 모르는 무엇을 그 글자가 말하는가.**
//
// ── 왜 코트 정의에서 계산하는가 ─────────────────────────────────────────────────────
// 골라인의 자리는 코트 종류·크기마다 다르고(풀은 좌우 세로선, 하프는 아래 가로선), 그 값은
// `courtDefFor` 하나가 갖는다. 좌표를 여기 리터럴로 적으면 25×14 판에서 깃발만 30×18 자리에
// 남는다 — `RuleZones` 가 같은 이유로 같은 규율을 지킨다.
//
// ⚠️ **플랫 코트에는 아무것도 안 그린다.** `ruleZones` 가 비어 있으므로 자연히 그렇게 되고,
// 그것이 곧 "플랫은 진영이 없다" 는 기현님 지시의 구현이다(버튼도 같은 조건으로 비활성이다).
import { memo } from 'react';
import { PX_PER_M } from '../core/units.ts';
import { courtDefFor, type CourtMode, type CourtSize } from '../model/court.ts';
import type { TeamSide, TeamStyle } from '../model/drill.ts';
import { defaultDefense, defendedZones } from '../model/rules.ts';

// ── 깃대에 매달린 정삼각 페넌트, 꼭짓점은 **언제나 오른쪽** (기현 지시 2026-08-16) ─────────
// 처음에는 골라인에 밑변을 대고 판 밖으로 꼭짓점을 보냈다 — 즉 왼쪽 골의 깃발은 왼쪽을,
// 오른쪽 골의 깃발은 오른쪽을 향했다. 코치가 판을 볼 때 그 둘은 **다른 표식**으로 읽힌다.
// 방향을 하나로 묶으면 네 깃발이 한 종류가 되고, 남는 차이는 색뿐이다 — 그것이 이 표식이
// 실제로 말하려는 것이다. 깃대가 붙으면서 삼각형만 있던 때의 "화살촉인가 표식인가" 도
// 사라진다: 깃대에 매달린 삼각형은 **깃발 말고 다른 것으로 안 읽힌다.**
//
// ⚠️ '오른쪽'·'세로 깃대' 는 **판의 좌표계**다. 태블릿 90° 회전(§6.4)에서는 판 전체가 도니까
//    화면에서는 깃대가 눕는다 — 칩·골대와 같은 세계에 사는 것이 옳다(글자가 없으니 되돌려
//    세울 것도 없다).
//
// ── 여백 예산 ───────────────────────────────────────────────────────────────────────
// 골라인 바깥 여백은 `MARGIN_PX` = 1.5 m = **37.5 월드 px** 이고 viewBox 는 딱 거기서 끝난다
// (넘으면 그냥 잘린다). 골라인에서 0.5 m(12.5) 띄우고 나면 **25 px** 이 남는다. 깃발이 그
// 여백 쪽으로 먹는 길이는 골라인 방향마다 다르다:
//   · 세로 골라인(풀) — 깃대는 골라인과 나란하므로 먹는 것은 페넌트 **높이**(≈12.1) 다.
//   · 가로 골라인(하프) — 깃대가 여백 쪽으로 서므로 먹는 것은 **깃대 길이**(19) 다.
// 그래서 상한을 정하는 것은 하프 코트다: 19 + 12.5 = 31.5 ≤ 37.5.
/** 골라인에서 깃발의 **가장 가까운 점**까지(월드 px). 0.5 m — 기현 지시 2026-08-16. */
export const SIDE_FLAG_GAP_PX = 0.5 * PX_PER_M;
/** 페넌트(정삼각형) 한 변(월드 px). 0.56 m. */
export const SIDE_FLAG_SIDE_PX = 14;
/** 페넌트 높이 — 한 변에서 파생한다. 손으로 12.1 을 적으면 변을 바꿨을 때 삼각형이 찌그러진다. */
export const SIDE_FLAG_H_PX = (SIDE_FLAG_SIDE_PX * Math.sqrt(3)) / 2;
/** 페넌트 **아래로 드러나는** 깃대(월드 px). 0.2 m.
 *
 *  ⚠️ 화면에서 '깃대' 로 보이는 것은 이 토막뿐이다 — 위쪽은 페넌트가 덮는다. 그래서 기현님이
 *  *"깃대가 조금 길다. 절반으로 줄여라"*(2026-08-16) 라고 하신 대상도 이것이고, 10 → 5 로
 *  줄였다. 전체 길이를 반으로 줄이는 읽기는 성립하지 않는다: 12 는 페넌트 한 변(14)보다
 *  짧아서 깃발이 대 밖으로 삐져나오고, 바로 앞 지시(*"깃발 깃대를 표현하자"*)가 없던 일이 된다. */
export const SIDE_FLAG_TAIL_PX = 5;
/** 깃대 전체 길이(월드 px) — 페넌트가 매달린 구간 + 드러난 토막. **파생값이다**: 손으로 적으면
 *  페넌트를 키웠을 때 깃발이 대 밖으로 나간다. 하프 코트에서 이 값이 여백을 먹으므로
 *  `GAP + POLE ≤ 37.5` 가 상한이다(12.5 + 19 = 31.5). */
export const SIDE_FLAG_POLE_PX = SIDE_FLAG_SIDE_PX + SIDE_FLAG_TAIL_PX;
/** 두 깃발 중심 사이(월드 px) — 골라인을 따라. 깃대 길이(24)보다 커야 세로 골라인에서 안 겹친다. */
export const SIDE_FLAG_SPACING_PX = 28;
/** 깃대·테두리 색. 코트 밖 여백은 잔디색(COURT_BG #1f7a46)이라 어두운 선이 4:1 넘게 선다. */
const FLAG_STROKE = '#0b0f14';
const FLAG_STROKE_W = 1.5;
const POLE_W = 2;

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
        // 골키퍼 깃발이 언제나 **먼저**(세로 골라인이면 위, 가로 골라인이면 왼쪽)다 — 글자를
        // 뺀 뒤로 이 순서가 다시 두 깃발을 가르는 **유일한 비색 채널**이다.
        const half = SIDE_FLAG_SPACING_PX / 2;
        const flags = [
          { t: -half, role: 'gk', fill: style.gkColor },
          { t: +half, role: 'field', fill: style.color },
        ] as const;
        return (
          <g key={`${z.rect.x},${z.rect.y}`} data-side-mark={z.defender} data-side-index={i}>
            {flags.map((f) => {
              // 깃발은 **판 좌표계에 고정**이다(깃대는 세로, 꼭짓점은 오른쪽). 골라인 방향과
              // 무관하므로 자리만 (바깥 o, 골라인 a) 두 축으로 잡고 모양은 상자에서 바로 찍는다.
              //
              // 골라인에서 **가장 가까운 점**이 정확히 0.5 m 여야 한다 — 그런데 어느 점이
              // 가장 가까운지가 골라인 방향에 따라 갈린다(세로 골라인이면 페넌트 꼭짓점 또는
              // 깃대, 가로 골라인이면 깃대의 위 끝). 그래서 상자 중심을 골라인에서
              // `0.5 m + 그 방향으로의 반폭` 만큼 민다 — 두 경우가 한 식으로 닫힌다.
              const reach = (Math.abs(p.ox) * SIDE_FLAG_H_PX + Math.abs(p.oy) * SIDE_FLAG_POLE_PX) / 2;
              const cx = p.cx + p.ox * (SIDE_FLAG_GAP_PX + reach) + p.ax * f.t;
              const cy = p.cy + p.oy * (SIDE_FLAG_GAP_PX + reach) + p.ay * f.t;
              // 깃대는 상자 왼쪽 변, 페넌트는 그 **위쪽**에 매달린다 — 아래쪽 토막이 맨 대다.
              const poleX = cx - SIDE_FLAG_H_PX / 2;
              const top = cy - SIDE_FLAG_POLE_PX / 2;
              return (
                <g key={f.role} data-side-flag={f.role}>
                  {/* 깃대를 먼저 그린다 — 페넌트가 그 위를 덮어야 매달린 것으로 보인다.
                      그래서 **눈에 남는 깃대는 아래 토막**(SIDE_FLAG_TAIL_PX)뿐이다. */}
                  <line
                    x1={poleX}
                    y1={top}
                    x2={poleX}
                    y2={top + SIDE_FLAG_POLE_PX}
                    stroke={FLAG_STROKE}
                    strokeWidth={POLE_W}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${poleX},${top} ${poleX},${top + SIDE_FLAG_SIDE_PX} ${poleX + SIDE_FLAG_H_PX},${top + SIDE_FLAG_SIDE_PX / 2}`}
                    fill={f.fill}
                    stroke={FLAG_STROKE}
                    strokeWidth={FLAG_STROKE_W}
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
});
