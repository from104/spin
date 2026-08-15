// §7 5.2 — **공마다 따로 켜는 거리 원**(2026-08-13 기현님 실기 피드백 ③).
//   *"공 선택하고 계속 선택하면 원 없음, 3미터 원, 5미터 원, 선택해제 순환하여 표시
//     (개별 공 상태 달리 저장, 초기 배치는 원 없음으로"*
//
// 이 파일은 **모델 층**만 잰다: 상태가 어디에 사는가(cast) · 순환 규칙 · 스키마 세 관문 중
// 화이트리스트(validate)와 마이그레이션(migrate). 화면 배선은 render/RuleOverlay.test.tsx,
// 편집기·시연·PNG 는 각 화면의 rules 테스트, 실제 저장 경로 왕복은
// storage/ballRing.roundtrip.test.ts 가 잰다.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDrill } from './defaults.ts';
import { addBall, cycleBallRing } from './edits.ts';
import {
  BALL_RINGS,
  CURRENT_DRILL_SCHEMA,
  ballRingOf,
  nextBallRing,
  type BallRing,
  type Drill,
} from './drill.ts';
import { DRILL_MIGRATIONS, migrateDoc } from './migrate.ts';
import { validateDrill } from './validate.ts';
import { RING_5M_R_PX, RING_R_PX, ringRadiusPx, ringViolation } from './rules.ts';
import { mToPx } from '../core/units.ts';
import type { BallId } from '../core/ids.ts';

const ballsOf = (d: Drill): BallRing[] => d.cast.balls.map(ballRingOf);

/** 공 두 개짜리 판. **하나짜리로는 "개별 저장" 을 잴 수 없다** — 전역 상태 하나로 구현해도
 *  공이 하나면 모든 단언이 통과한다(계획서가 지목한 헛통과 형태). */
function twoBallDrill(): { drill: Drill; a: BallId; b: BallId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const withTwo = addBall(base, 0, { x: 500, y: 300 });
  const [a, b] = withTwo.cast.balls.map((x) => x.id);
  return { drill: withTwo, a: a!, b: b! };
}

describe('5.2 순환 규칙 — 없음 → 3 m → 5 m → 없음', () => {
  it('nextBallRing 은 세 칸을 돈다 — 어디서 시작해도 3번이면 제자리다', () => {
    expect(nextBallRing('none')).toBe('3m');
    expect(nextBallRing('3m')).toBe('5m');
    expect(nextBallRing('5m')).toBe('none');
    for (const start of BALL_RINGS) {
      expect(nextBallRing(nextBallRing(nextBallRing(start)))).toBe(start);
    }
  });

  it('새 드릴의 공은 **원 없음**이다 — 초기 배치가 원 없음이라는 요구 그대로', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    expect(ballsOf(d)).toEqual(['none']);
    // 새로 놓는 공도 마찬가지다(도구로 만든 공).
    expect(ballsOf(addBall(d, 0, { x: 300, y: 300 }))).toEqual(['none', 'none']);
  });

  it('cycleBallRing 이 그 공 하나만 돌린다 — **공 두 개가 서로 다른 상태를 갖는다**', () => {
    const { drill, a, b } = twoBallDrill();
    const s1 = cycleBallRing(drill, a); // a: 3m
    expect(ballsOf(s1)).toEqual(['3m', 'none']);
    const s2 = cycleBallRing(s1, a); // a: 5m
    expect(ballsOf(s2)).toEqual(['5m', 'none']);
    const s3 = cycleBallRing(s2, b); // b: 3m — a 는 그대로
    expect(ballsOf(s3)).toEqual(['5m', '3m']);
    const s4 = cycleBallRing(s3, a); // a: 없음으로 닫힌다
    expect(ballsOf(s4)).toEqual(['none', '3m']);
  });

  it("'없음' 은 **키 삭제**다 — `{ring: undefined}` 로 남기지 않는다", () => {
    const { drill, a } = twoBallDrill();
    const off = cycleBallRing(cycleBallRing(cycleBallRing(drill, a), a), a);
    expect(Object.prototype.hasOwnProperty.call(off.cast.balls[0]!, 'ring')).toBe(false);
    // JSON 왕복(파일)과 structuredClone(IDB)이 같은 문서를 만든다 — 명시적 undefined 였다면
    // 둘이 갈라져 "내보냈다 가져오면 뜻이 달라지는" 문서가 된다.
    expect(JSON.parse(JSON.stringify(off.cast.balls))).toEqual(structuredClone(off.cast.balls));
  });

  it('없는 공 id 는 no-op 이고 **같은 참조**를 돌려준다(리렌더·히스토리 억제)', () => {
    const { drill } = twoBallDrill();
    expect(cycleBallRing(drill, 'bl_nope' as BallId)).toBe(drill);
  });

  it('스텝을 건드리지 않는다 — 상태는 cast 에 산다(스텝마다가 아니라)', () => {
    const { drill, a } = twoBallDrill();
    const next = cycleBallRing(drill, a);
    expect(next.steps).toBe(drill.steps); // 스텝 배열 자체가 그대로다
  });
});

describe('5.2 반지름 — 25 px = 1 m 축척에서만 나온다', () => {
  it('3 m 는 판정 반경과 같은 값, 5 m 는 mToPx(5) 다', () => {
    expect(RING_R_PX).toBe(mToPx(3));
    expect(RING_5M_R_PX).toBe(mToPx(5));
    expect(ringRadiusPx('3m')).toBe(RING_R_PX);
    expect(ringRadiusPx('5m')).toBe(RING_5M_R_PX);
  });

  it("'없음' 은 0 이 아니라 null 이다 — 0 은 점을 그린다", () => {
    expect(ringRadiusPx('none')).toBeNull();
  });

  it('★ 판정은 표시와 독립이다 — ringViolation 은 그 공의 원 상태를 **받지도 않는다**', () => {
    // 시그니처가 (공 좌표, 선수, 골 지역) 뿐이다. 5 m 를 켰다고 판정 반경이 5 m 가 되면
    // 규칙을 잘못 가르친다(파워싸커 2-on-1 은 3 m 다).
    const ball = { x: 400, y: 260 };
    // theta 는 2026-08-13 부터 필수다 — 판정이 차체 **사각형**으로 재기 때문(chairOverlap.ts).
    const near = [
      { id: 'ch_a', team: 'home' as const, isGk: false, x: 410, y: 260, theta: 0 },
      { id: 'ch_b', team: 'home' as const, isGk: false, x: 390, y: 260, theta: 0 },
      { id: 'ch_c', team: 'away' as const, isGk: false, x: 420, y: 260, theta: 0 },
    ];
    expect(ringViolation(ball, near, [])).not.toBe(0);
    // 한 명을 3 m 밖 5 m 안으로 뺀다 — theta 0(= +x 를 봄)이라 공 쪽은 **뒷면**이고, 피벗
    // 100 px 은 차체로 92.5 px(3.7 m)이다. 여전히 3~5 m 사이라 문턱이 3 m 라는 증거가 산다.
    const far = [near[0]!, { ...near[1]!, x: 500 }, near[2]!];
    expect(ringViolation(ball, far, [])).toBe(0);
  });
});

describe('5.2 축 열거 — 원을 그리는 화면이 몇 개인가', () => {
  // 5차의 오진("시연 화면만 팀 구분을 잃었다")과 같은 형태를 막는 자리다. 규칙 링을 그리는
  // 화면은 셋뿐이고(편집 CourtStage · 시연 PresentStage · PNG buildStaticSvg) 셋 다 배선했다.
  // **인쇄와 썸네일은 규칙 오버레이 자체가 없다** — 배선할 것이 없다는 사실을 여기 못박는다.
  // 나중에 인쇄에 규칙 존을 얹는 사람이 있으면 이 단언이 먼저 빨개져 "공의 원은?" 을 묻는다.
  it('인쇄·썸네일은 규칙 오버레이를 아예 그리지 않는다', () => {
    const print = readFileSync('src/features/print/PrintCourt.tsx', 'utf-8');
    const thumb = readFileSync('src/render/CourtThumbnail.tsx', 'utf-8');
    for (const src of [print, thumb]) {
      expect(src).not.toContain('ruleOverlay');
      expect(src).not.toContain('RING_');
    }
    // 대조군 — 같은 grep 이 실제 소비처 셋은 찾아낸다(못 찾으면 위 단언이 공허하다).
    for (const p of ['src/render/RuleOverlay.tsx', 'src/features/present/PresentStage.tsx', 'src/features/export/buildStaticSvg.ts']) {
      expect(readFileSync(p, 'utf-8'), p).toContain('ruleOverlay');
    }
  });
});

describe('5.2 스키마 관문 ① — validateDrill 화이트리스트', () => {
  const doc = (balls: unknown[]): Record<string, unknown> => ({
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: 'dr_x',
    courtMode: 'full',
    cast: { chairs: [], balls, cones: [] },
    steps: [{ id: 'st_1', name: '', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] }],
  });

  it("'3m'·'5m' 이 살아남고 **공마다 다르게** 살아남는다", () => {
    const v = validateDrill(doc([{ id: 'bl_1', ring: '3m' }, { id: 'bl_2', ring: '5m' }, { id: 'bl_3' }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['3m', '5m', 'none']);
  });

  it("'none'·쓰레기·엉뚱한 타입은 **키 없음**으로 접힌다 = 'none'", () => {
    const v = validateDrill(doc([{ id: 'bl_1', ring: 'none' }, { id: 'bl_2', ring: '9m' }, { id: 'bl_3', ring: 42 }]));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['none', 'none', 'none']);
    for (const b of v.value.cast.balls) expect(Object.prototype.hasOwnProperty.call(b, 'ring')).toBe(false);
    // 정상 파일마다 "일부 데이터를 자동으로 보정했습니다" 토스트가 뜨지 않게 repairs 는 안 쌓는다.
    expect(v.repairs).toHaveLength(0);
  });

  it('검증은 멱등이다 — 한 번 지난 문서를 다시 넣어도 원이 그대로다', () => {
    const first = validateDrill(doc([{ id: 'bl_1', ring: '5m' }]));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(JSON.parse(JSON.stringify(first.value)));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(ballsOf(second.value)).toEqual(['5m']);
  });
});

describe('5.2 스키마 관문 ② — 도장을 올리지 않은 것이 성립하는가', () => {
  it('체인의 끝이 곧 현재 버전이다 — **링 때문에 오른 단계는 없다**', () => {
    // ⚠️ 2026-08-14 — 스키마가 4 가 됐다. 그러나 **링 때문이 아니다**: v3→v4 는 작도 도형
    // (`DrillStep.shapes`) 때문이고, 그 판단 근거는 drill.ts 의 CURRENT_DRILL_SCHEMA 주석에
    // 링과 **나란히** 적혀 있다(링은 조건 ②를 넘어 안 올렸고, 도형은 못 넘어 올렸다).
    // ⚠️ 2026-08-15 — 5 가 됐다. 역시 링 때문이 아니다(v4→v5 는 자유 삼각형 `Shape.pts`).
    // ⚠️ 2026-08-15 — 6 이 됐다. 역시 링 때문이 아니다(v5→v6 은 진영 `Drill.defense`).
    // 이 describe 가 지키는 것은 여전히 "링이 도장을 올리지 않았다" 이므로, 그 사실을 링을
    // 건드리는 단계가 체인에 없다는 것으로 잰다.
    const last = DRILL_MIGRATIONS[DRILL_MIGRATIONS.length - 1]!;
    expect(last.to).toBe(CURRENT_DRILL_SCHEMA);
    expect(CURRENT_DRILL_SCHEMA).toBe(6);
    // ⚠️ 문구로 세지 않는다 — v1→v2 의 '필요 **인원**' 이 '원' 을 품고 있어 헛걸린다.
    // 행동으로 잰다: 전 체인을 돌려도 `cast.balls` 가 바이트 동일해야 한다.
    const balls = [{ id: 'bl_1', ring: '5m' }, { id: 'bl_2' }];
    const doc = { schemaVersion: 1, id: 'dr_x', courtMode: 'full', cast: { chairs: [], balls, cones: [] }, steps: [] };
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (m.ok) expect((m.doc as { cast: { balls: unknown } }).cast.balls, '링을 건드리는 단계가 생겼다').toEqual(balls);
  });

  it("**손으로 만든 v3 문서가 무손실로 열린다** — 도형 단계를 지나도 원은 손대지 않는다", () => {
    const handMade = {
      schemaVersion: 3,
      id: 'dr_hand',
      title: '손으로 만든 v3',
      courtMode: 'full',
      courtSize: '28x15',
      cast: { chairs: [], balls: [{ id: 'bl_1', ring: '5m' }, { id: 'bl_2' }], cones: [] },
      steps: [{ id: 'st_1', name: '', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] }],
    };
    const mig = migrateDoc(handMade, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(mig.ok).toBe(true);
    if (!mig.ok) return;
    // 2026-08-14 — v3→v4(도형) 한 단계는 지난다. **원과 무관한 단계**라는 것이 요점이다.
    // 2026-08-15 — v4→v5(자유 삼각형)·v5→v6(진영)이 붙어 셋이 됐다. 역시 원과 무관하다.
    expect(mig.applied).toHaveLength(3);
    expect((mig.doc as { cast: { balls: unknown[] } }).cast.balls, '도형 단계가 원을 건드렸다').toEqual(handMade.cast.balls);
    const v = validateDrill(mig.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['5m', 'none']);
    expect(v.value.courtSize).toBe('28x15'); // 대조군 — 다른 필드도 무손실이다
  });

  it("**옛 문서(v1)는 원이 없으므로 'none' 이다** — 채울 것이 없어 마이그레이션이 필요 없었다", () => {
    const v1 = {
      schemaVersion: 1,
      id: 'dr_old',
      courtMode: 'full',
      cast: { chairs: [], balls: [{ id: 'bl_1' }], cones: [] },
      steps: [{ id: 'st_1', name: '', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] }],
    };
    const mig = migrateDoc(v1, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(mig.ok).toBe(true);
    if (!mig.ok) return;
    // 2026-08-14 — 체인이 셋이 됐다(v3→v4 작도 도형).
    // 2026-08-15 — 다섯(v4→v5 자유 삼각형 · v5→v6 진영).
    expect(mig.applied).toHaveLength(5); // v1→v2→v3 은 그대로 돈다(대조군)
    const v = validateDrill(mig.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['none']);
  });
});
