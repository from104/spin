// §5.4 C-3 — **[포메이션으로 채우기]가 코트 모드별로 무엇을 놓는지** 를 표로 못박는다.
//
// 이 파일이 존재하는 이유는 계획서 5.4 의 한 문장이다: *"`FULL_POSITIONS`(825×525)를 하프
// (525×450)에서 쓰면 코트 밖이다."* 5.1 이 그 사고를 막는 사상(scaleIntoSurface)을 넣었지만,
// **무엇이 놓이는가**(대수·미배치 자리·공 유무·크기/포메이션을 타는가)는 여전히 defaults.ts 의
// 세 표(FULL/HALF/FLAT_POSITIONS)에 흩어진 암묵지였다. 손으로 쓴 it 은 조합이 늘면 반드시
// 빠지므로, 명세를 **상수 표**로 두고 테스트가 (full 3단 + half + flat) × 포메이션 3 = 27 조합을
// 전수 순회하게 한다(fillPreset.test.ts).
//
// ⚠️ 표를 고치면 defaults.ts 의 표도 같이 고쳐야 한다 — 둘이 갈라지면 테스트가 먼저 빨개진다.
// 그것이 이 표의 유일한 목적이다(문서가 아니라 **게이트**다).
import type { Vec2 } from '../core/units.ts';
import type { ChairId } from '../core/ids.ts';
import type { StoredChairPose } from './chair.ts';
import type { Drill, PoseMap, TeamSide } from './drill.ts';
import { courtDefFor, type CourtMode } from './court.ts';
import { ballPosFor, defaultStep } from './defaults.ts';
import { addBall } from './edits.ts';

/** 프리셋이 "이 판을 이렇게 세워라" 로 내놓는 **순수 값**. React·리듀서·물리를 모른다.
 *
 *  성질(전부 surface 안 · 이격 거리 · 겹침 없음)이 prop 뒤에 숨지 않게 하는 것이 이 타입의
 *  존재 이유다 — 계획을 값으로 만들어야 단언이 닿는다(drillUses.ts 가 같은 이유로 태어났다). */
export interface PlacementPlan {
  /** 이 스텝의 휠체어 배치 **전량**. 여기 없는 휠체어는 판에서 내려간다(명단에는 남는다). */
  chairs: PoseMap<ChairId, StoredChairPose>;
  /** 공을 놓을 자리. null 이면 공을 건드리지 않는다. */
  ball: Vec2 | null;
}

/** 한 코트 모드에서 [포메이션으로 채우기]가 **무엇을 놓는가**. */
export interface CourtFillSpec {
  /** 놓이는 휠체어 대수(기본 캐스트 8대 중). */
  chairs: number;
  /** **놓이지 않는** 자리. 하프는 홈 GK 와 상대 4번이 빠진다 — 하프는 '공격 진영 한쪽' 이라
   *  양 팀 4대씩이 설 자리가 없다(HALF_POSITIONS 가 6자리만 갖고 있다). */
  unplaced: readonly { team: TeamSide; number: string }[];
  /** 공을 하나 놓는가. */
  ball: boolean;
  /** 포메이션(1-2-1 · 2-1-1 · 1-1-2)이 배치를 바꾸는가. **full 만 true** — 하프·플랫은
   *  포메이션 무관 단일 배치다(defaults.ts HALF_POSITIONS/FLAT_POSITIONS 머리말). */
  formationAware: boolean;
  /** 코트 크기 3단(30×18 · 28×15 · 25×14)을 따라가는가. **full 만 true**
   *  — 근거 셋은 court.ts COURT_DEFS 주석에 있다(하프에는 규격 자체가 없다). */
  sizeAware: boolean;
}

/** ⚠️ 이 표는 **명세**다. 값을 바꾸면 실제 배치가 따라오는 것이 아니라, 실제 배치와 어긋나
 *  fillPreset.test.ts 가 빨개진다. */
export const COURT_FILL_SPECS: Record<CourtMode, CourtFillSpec> = {
  full: { chairs: 8, unplaced: [], ball: true, formationAware: true, sizeAware: true },
  half: {
    chairs: 6,
    unplaced: [
      { team: 'home', number: 'G' },
      { team: 'away', number: '4' },
    ],
    ball: true,
    formationAware: false,
    sizeAware: false,
  },
  flat: { chairs: 8, unplaced: [], ball: true, formationAware: false, sizeAware: false },
};

/** [포메이션으로 채우기] 계획. `defaultStep`(§3.9 기본 배치)이 유일한 출처다 — 좌표를 여기서
 *  다시 만들면 '새 드릴' 과 '채우기' 가 다른 판이 되고, 그 차이는 화면에서 안 보인다. */
export function formationPlan(d: Drill): PlacementPlan {
  const step = defaultStep(d.courtMode, d.formation, d.cast, d.courtSize);
  return { chairs: step.chairs, ball: ballPosFor(d.courtMode, d.courtSize) };
}

/** 계획을 드릴에 앉힌다. **현재 스텝만** 바꾼다(다음 스텝은 그 스텝의 그림이다).
 *
 *  공은 세 갈래다: (a) 캐스트에 공이 있으면 그 첫 공을 옮긴다 (b) 없으면 새로 만든다
 *  (자유 전술판은 `empty:true` 로 태어나 캐스트에 공이 **하나도 없다** — 이 갈래가 없으면
 *  전술판에서 세트피스 프리셋이 공 없는 배치를 놓는다) (c) plan.ball 이 null 이면 안 건드린다. */
export function applyPlacement(d: Drill, stepIndex: number, plan: PlacementPlan): Drill {
  if (!d.steps[stepIndex]) return d;
  let next = d;
  let ballId = d.cast.balls[0]?.id;
  if (plan.ball && ballId === undefined) {
    next = addBall(next, stepIndex, plan.ball);
    ballId = next.cast.balls[next.cast.balls.length - 1]?.id;
  }
  const steps = next.steps.slice();
  const step = steps[stepIndex]!;
  const balls = plan.ball && ballId !== undefined ? { ...step.balls, [ballId]: { x: plan.ball.x, y: plan.ball.y } } : step.balls;
  steps[stepIndex] = { ...step, chairs: { ...plan.chairs }, balls };
  return { ...next, steps };
}

/** 표가 실제 코트 정의와 어긋나지 않는지 보는 데 쓰는 파생값 — 테스트와 UI 문구가 같은 곳에서
 *  읽는다(`courtDefFor` 가 유일한 좌표 출처라는 규칙 10 을 표에도 적용한다). */
export const fillSummary = (mode: CourtMode): string => {
  const s = COURT_FILL_SPECS[mode];
  const def = courtDefFor(mode);
  const shape = s.formationAware ? '포메이션대로' : '포메이션 무관 단일 배치로';
  // ⚠️ 실사용 호출부가 없다(테스트·명세 전용 파생값 — 위 머리말) — UI 로케일에 닿지 않으므로
  //    cloneToCourt() 와 같은 이유로 'ko' 고정만 해 둔다.
  return `${def.label.ko}: ${shape} ${s.chairs}대${s.ball ? ' + 공 1개' : ''}`;
};
