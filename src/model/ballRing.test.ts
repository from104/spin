// §7 5.2 — **공마다 따로 켜는 거리 원**(2026-08-13 기현님 실기 피드백 ③).
//   *"공 선택하고 계속 선택하면 원 없음, 3미터 원, 5미터 원, 선택해제 순환하여 표시
//     (개별 공 상태 달리 저장, 초기 배치는 원 없음으로"*
//
// 이 파일은 **모델 층**만 잰다: 상태가 어디에 사는가(cast) · 순환 규칙 · 스키마 세 관문 중
// 화이트리스트(validate)와 마이그레이션(migrate). 화면 배선은 render/RuleOverlay.test.tsx,
// 편집기·시연·PNG 는 각 화면의 rules 테스트, 실제 저장 경로 왕복은
// storage/ballRing.roundtrip.test.ts 가 잰다.
import { describe, expect, it } from 'vitest';
import { createDrill } from './defaults.ts';
import { addBall, cycleBallRing } from './edits.ts';
import type { TeamSide } from './drill.ts';
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
import { pathsDrawing, RENDER_PATHS } from '../render/renderPaths.ts';
import { mToPx } from '../core/units.ts';
import type { BallId } from '../core/ids.ts';

/** v9 — 링은 스텝 소유다. 별도 지정이 없으면 **첫 스텝**을 본다(옛 케이스들은 전부 스텝이
 *  하나이거나 첫 스텝만 건드리므로, 그때의 뜻이 그대로 보존된다). */
const ballsOf = (d: Drill, i = 0): BallRing[] => d.cast.balls.map((b) => ballRingOf(d.steps[i]!, b.id));

/** 공 두 개짜리 판. **하나짜리로는 "개별 저장" 을 잴 수 없다** — 전역 상태 하나로 구현해도
 *  공이 하나면 모든 단언이 통과한다(계획서가 지목한 헛통과 형태). */
function twoBallDrill(): { drill: Drill; a: BallId; b: BallId } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const withTwo = addBall(base, 0, { x: 500, y: 300 });
  const [a, b] = withTwo.cast.balls.map((x) => x.id);
  return { drill: withTwo, a: a!, b: b! };
}

describe('5.2 순환 규칙 — 없음 → 3 m → 5 m(우리) → 5 m(상대) → 없음', () => {
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
    const s1 = cycleBallRing(drill, 0, a); // a: 3m
    expect(ballsOf(s1)).toEqual(['3m', 'none']);
    const s2 = cycleBallRing(s1, 0, a); // a: 5m(우리)
    expect(ballsOf(s2)).toEqual(['5m', 'none']);
    const s3 = cycleBallRing(s2, 0, b); // b: 3m — a 는 그대로
    expect(ballsOf(s3)).toEqual(['5m', '3m']);
    const s4 = cycleBallRing(s3, 0, a); // a: 5m(상대) — 원은 그대로, 소유만 넘어간다
    expect(ballsOf(s4)).toEqual(['5m', '3m']);
    const s5 = cycleBallRing(s4, 0, a); // a: 없음으로 닫힌다
    expect(ballsOf(s5)).toEqual(['none', '3m']);
  });

  // 기현 지시 2026-08-27 — *"공을 가로지르는 2미터의 흐린 흰색 화살표"* 로 보여 줄 값이다.
  // 소유가 진영과 갈라져야 하는 이유는 drill.ts `ballOwner` 머리말에 있다(골킥과 코너킥은
  // 물러나는 팀이 정반대인데 진영 하나로는 둘을 표현할 수 없었다).
  it('★ 5 m 두 칸이 소유를 나른다 — 우리 공 → 상대 공 → 없음', () => {
    const { drill, a } = twoBallDrill();
    const ownerOf = (d: Drill): TeamSide | undefined => d.steps[0]!.ballOwner?.[a];

    const three = cycleBallRing(cycleBallRing(drill, 0, a), 0, a); // 없음 → 3m → 5m
    expect(ballsOf(three)[0]).toBe('5m');
    expect(ownerOf(three), '5 m 를 켜는 순간 소유가 정해진다').toBe('home');

    const flipped = cycleBallRing(three, 0, a);
    expect(ballsOf(flipped)[0], '원은 그대로 5 m 다').toBe('5m');
    expect(ownerOf(flipped)).toBe('away');

    const off = cycleBallRing(flipped, 0, a);
    expect(ballsOf(off)[0]).toBe('none');
    expect(ownerOf(off), '원이 꺼지면 소유도 함께 사라진다').toBeUndefined();
    // 맵이 비면 키 자체가 없다 — 링과 같은 규약이다.
    expect(Object.prototype.hasOwnProperty.call(off.steps[0]!, 'ballOwner')).toBe(false);
  });

  it('3 m 에는 소유가 붙지 않는다 — 2-on-1 은 누가 차는가와 무관한 규칙이다', () => {
    const { drill, a } = twoBallDrill();
    const three = cycleBallRing(drill, 0, a);
    expect(ballsOf(three)[0]).toBe('3m');
    expect(three.steps[0]!.ballOwner?.[a]).toBeUndefined();
  });

  it("'없음' 은 **키 삭제**다 — `{ring: undefined}` 로 남기지 않는다", () => {
    const { drill, a } = twoBallDrill();
    // 순환이 네 칸이다(5 m 가 우리/상대 두 칸) — 네 번 눌러야 닫힌다.
    let off = drill;
    for (let i = 0; i < 4; i++) off = cycleBallRing(off, 0, a);
    // 마지막 하나가 꺼지면 맵 자체가 사라진다(locked/ignored 가 빈 배열을 지우는 것과 같다).
    expect(Object.prototype.hasOwnProperty.call(off.steps[0]!, 'ballRings')).toBe(false);
    // JSON 왕복(파일)과 structuredClone(IDB)이 같은 문서를 만든다 — 명시적 undefined 였다면
    // 둘이 갈라져 "내보냈다 가져오면 뜻이 달라지는" 문서가 된다.
    expect(JSON.parse(JSON.stringify(off.steps))).toEqual(structuredClone(off.steps));
  });

  it('없는 공 id 는 no-op 이고 **같은 참조**를 돌려준다(리렌더·히스토리 억제)', () => {
    const { drill } = twoBallDrill();
    expect(cycleBallRing(drill, 0, 'bl_nope' as BallId)).toBe(drill);
  });

  // ⚠️ 이 케이스는 2026-08-27 에 **정반대로 뒤집혔다.** 원래 이름은 "스텝을 건드리지 않는다 —
  // 상태는 cast 에 산다" 였고, `next.steps` 가 참조까지 같기를 요구했다. v9 에서 링이 스텝으로
  // 내려오면서 그 단언이 곧 "고장" 을 뜻하게 됐다.
  it('그 스텝만 건드린다 — cast 는 그대로고, 다른 스텝도 그대로다', () => {
    const { drill: one, a } = twoBallDrill();
    // 스텝 둘짜리로 늘린다(하나뿐이면 "다른 스텝은 그대로" 를 잴 수 없다).
    const drill: Drill = { ...one, steps: [one.steps[0]!, { ...one.steps[0]!, id: 'st_2' as typeof one.steps[0]['id'] }] };
    const next = cycleBallRing(drill, 0, a);
    expect(next.cast).toBe(drill.cast); // cast 는 손대지 않는다
    expect(ballsOf(next, 0)).toEqual(['3m', 'none']); // 건드린 스텝만 바뀌고
    expect(ballsOf(next, 1)).toEqual(['none', 'none']); // 다른 스텝은 그대로다
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
  // ⚠️ 이 describe 는 2026-08-27 에 **뜻이 뒤집혔다.** 원래는 인쇄·썸네일 소스에
  // `'ruleOverlay'`·`'RING_'` 문자열이 **없어야** 한다고 단언했다 — 즉 *부재를 계약으로
  // 승격*시키고 있었다. 그리고 그 주석은 이렇게 끝났다: *"나중에 인쇄에 규칙 존을 얹는 사람이
  // 있으면 이 단언이 먼저 빨개져 '공의 원은?' 을 묻는다."*
  //
  // 실제로 일어난 일은 그 반대였다. 기현님이 **종이에 원이 안 나온다고 신고**할 때까지 아무도
  // 안 물었다. 부정 단언은 "여기 없다" 를 지킬 뿐 "어디에 있어야 하는가" 를 모르기 때문이다.
  // 그래서 판단을 `render/renderPaths.ts` 표로 옮기고, 여기서는 **그 표를 읽는다**.
  it('규칙 링을 그리는 경로는 표가 정한다 — 화면 둘 + 정적 렌더 둘', () => {
    expect(pathsDrawing('ballRings')).toEqual(['editor', 'present', 'png', 'print']);
  });

  it('썸네일이 링을 안 그리는 것은 **사유가 적힌 판단**이다 — 우연한 누락이 아니다', () => {
    const s = RENDER_PATHS.thumbnail.ballRings;
    expect(s.draws).toBe(false);
    if (!s.draws) expect(s.why).toContain('개략');
  });
});

describe('5.2 스키마 관문 ① — validateDrill 화이트리스트', () => {
  /** v9 — 링은 스텝에 싣는다. 공 좌표도 함께 넣는 것이 중요하다: 그 스텝의 판에 없는 공의
   *  링은 뜻이 없어서 validate 가 좌표와 같은 기준으로 떨구기 때문이다. */
  const doc = (rings: Record<string, unknown>): Record<string, unknown> => ({
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: 'dr_x',
    courtMode: 'full',
    cast: { chairs: [], balls: [{ id: 'bl_1' }, { id: 'bl_2' }, { id: 'bl_3' }], cones: [] },
    steps: [
      {
        id: 'st_1',
        name: '',
        note: '',
        chairs: {},
        balls: { bl_1: { x: 400, y: 260 }, bl_2: { x: 420, y: 260 }, bl_3: { x: 440, y: 260 } },
        ballRings: rings,
        cones: {},
        arrows: [],
        notes: [],
      },
    ],
  });

  it("'3m'·'5m' 이 살아남고 **공마다 다르게** 살아남는다", () => {
    const v = validateDrill(doc({ bl_1: '3m', bl_2: '5m' }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['3m', '5m', 'none']);
  });

  it("'none'·쓰레기·엉뚱한 타입은 **키 없음**으로 접힌다 = 'none'", () => {
    const v = validateDrill(doc({ bl_1: 'none', bl_2: '9m', bl_3: 42 }));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['none', 'none', 'none']);
    for (const b of v.value.cast.balls) expect(Object.prototype.hasOwnProperty.call(b, 'ring')).toBe(false);
    // 정상 파일마다 "일부 데이터를 자동으로 보정했습니다" 토스트가 뜨지 않게 repairs 는 안 쌓는다.
    expect(v.repairs).toHaveLength(0);
  });

  it('검증은 멱등이다 — 한 번 지난 문서를 다시 넣어도 원이 그대로다', () => {
    const first = validateDrill(doc({ bl_1: '5m' }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(JSON.parse(JSON.stringify(first.value)));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(ballsOf(second.value)).toEqual(['5m', 'none', 'none']);
  });
});

describe('5.2 스키마 관문 ② — 도장을 올렸고, 옮겨 적기가 무손실인가', () => {
  // ⚠️ 이 describe 는 2026-08-27 에 **뜻이 뒤집혔다.** 원래 이름은 *"도장을 올리지 않은 것이
  // 성립하는가"* 였고, v4~v8 이 오를 때마다 "역시 링 때문이 아니다" 를 한 줄씩 덧붙여 왔다.
  // v9 에서 마침내 **링 때문에** 올랐다(cast → 스텝). 그래서 지키는 것도 바뀐다: 이제
  // "안 건드렸는가" 가 아니라 **"옮겨 적었는가"** 다. 옛 문서의 링이 조용히 사라지는 것이
  // 이 변경의 유일한 손실 경로이기 때문이다(링은 표시가 아니라 규칙 선택이다 — ruleForRing).
  it('체인의 끝이 곧 현재 버전이다', () => {
    const last = DRILL_MIGRATIONS[DRILL_MIGRATIONS.length - 1]!;
    expect(last.to).toBe(CURRENT_DRILL_SCHEMA);
    // 2026-09-06 — v11(개체 표시 순서 zOrder). 이 리터럴은 도장이 오를 때마다 손으로 올린다:
    // 값을 상수에서 끌어오면 "도장이 올랐는지" 를 아무도 안 보는 항등식이 된다.
    expect(CURRENT_DRILL_SCHEMA).toBe(11);
  });

  it('★ 옛 문서(v1)의 cast 링이 전 스텝으로 옮겨 적히고, cast 에서는 사라진다', () => {
    const balls = [{ id: 'bl_1', ring: '5m' }, { id: 'bl_2' }];
    const steps = [
      { id: 'st_1', balls: { bl_1: { x: 400, y: 260 }, bl_2: { x: 420, y: 260 } } },
      { id: 'st_2', balls: { bl_1: { x: 500, y: 300 }, bl_2: { x: 520, y: 300 } } },
    ];
    const doc = { schemaVersion: 1, id: 'dr_x', courtMode: 'full', cast: { chairs: [], balls, cones: [] }, steps };
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const out = m.doc as { cast: { balls: { id: string; ring?: string }[] }; steps: { ballRings?: Record<string, string> }[] };
    // cast 에는 더 이상 링이 없다.
    expect(out.cast.balls.every((b) => b.ring === undefined), 'cast 에 링이 남았다').toBe(true);
    // 전 스텝이 같은 값을 물려받는다 = cast 소유였다는 말의 정확한 뜻(모든 스텝이 한 값을 공유).
    for (const st of out.steps) expect(st.ballRings).toEqual({ bl_1: '5m' });
  });

  it('★ 링이 하나도 없던 문서는 스텝에 키를 만들지 않는다 — 없음은 계속 키 없음이다', () => {
    const doc = {
      schemaVersion: 1,
      id: 'dr_y',
      courtMode: 'full',
      cast: { chairs: [], balls: [{ id: 'bl_1' }], cones: [] },
      steps: [{ id: 'st_1', balls: { bl_1: { x: 400, y: 260 } } }],
    };
    const m = migrateDoc(doc, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect((m.doc as { steps: { ballRings?: unknown }[] }).steps[0]!.ballRings).toBeUndefined();
  });

  it("**손으로 만든 v3 문서가 무손실로 열린다** — v9 를 지나며 원이 스텝으로 옮겨 적힌다", () => {
    const handMade = {
      schemaVersion: 3,
      id: 'dr_hand',
      title: '손으로 만든 v3',
      courtMode: 'full',
      courtSize: '28x15',
      cast: { chairs: [], balls: [{ id: 'bl_1', ring: '5m' }, { id: 'bl_2' }], cones: [] },
      // 공 좌표가 있어야 링이 그 스텝에 실린다(판에 없는 공의 링은 뜻이 없다).
      steps: [{ id: 'st_1', name: '', note: '', chairs: {}, balls: { bl_1: { x: 400, y: 260 }, bl_2: { x: 420, y: 260 } }, cones: {}, arrows: [], notes: [] }],
    };
    const mig = migrateDoc(handMade, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
    expect(mig.ok).toBe(true);
    if (!mig.ok) return;
    // 2026-08-14 — v3→v4(도형) 한 단계는 지난다. **원과 무관한 단계**라는 것이 요점이었다.
    // 2026-08-15 — v4→v5·v5→v6, 2026-08-16 — v6→v7, 2026-08-18 — v7→v8 이 붙어 다섯이 됐다.
    // 2026-08-27 — v8→v9 가 붙어 여섯. **이번엔 원과 무관하지 않다** — 이 단계가 원을 옮긴다.
    // 2026-09-03 — v9→v10(자유 그리기 획)이 붙어 일곱. 다시 원과 무관한 단계다.
    // 2026-09-06 — v10→v11(개체 표시 순서)이 붙어 여덟. 역시 원과 무관한 도장만의 단계다.
    expect(mig.applied).toHaveLength(8);
    const migrated = mig.doc as { cast: { balls: { ring?: string }[] }; steps: { ballRings?: Record<string, string> }[] };
    // 옮겼으므로 cast 에는 안 남고, 스텝에 있어야 한다. 둘 중 하나만 참이면 손실이다.
    expect(migrated.cast.balls.every((b) => b.ring === undefined), 'cast 에 원이 남았다').toBe(true);
    expect(migrated.steps[0]!.ballRings, '스텝으로 옮겨 적히지 않았다').toEqual({ bl_1: '5m' });
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
    // 2026-08-15 — 다섯. 2026-08-16 — 여섯(v6→v7 선 통일). 2026-08-18 — 일곱(v7→v8 분류 개편).
    // 2026-08-27 — 여덟(v8→v9 공 링 이관). 2026-09-03 — 아홉(v9→v10 자유 그리기 획).
    // 2026-09-06 — 열(v10→v11 개체 표시 순서).
    expect(mig.applied).toHaveLength(10); // v1→v2→v3 은 그대로 돈다(대조군)
    const v = validateDrill(mig.doc);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(ballsOf(v.value)).toEqual(['none']);
  });
});
