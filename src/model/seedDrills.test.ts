// §3 seed 드릴 — **스펙 → Drill 변환기**의 계약. 여기서 지키는 것은 *"내용이 좋은가"* 가 아니라
// *"내용이 무엇이든 앱이 삼킬 수 있는 문서가 되는가"* 다(내용 판정은 기현님 몫이고 아직 승인 전이다).
//
// 가장 중요한 단언은 `validateDrill` 왕복이다: 좌표가 코트 밖이면 **말없이 클램프되고**, 글이
// 상한을 넘으면 **말없이 잘리며**, cast 에 없는 pose 는 **말없이 사라진다.** 셋 다 예외를 던지지
// 않으므로 왕복 동일성으로만 잡힌다. AND 로 뭉치지 않도록 각 조건을 따로 찌르는 it 도 함께 둔다.
import { describe, it, expect } from 'vitest';
import { buildSeedDrill, buildSeedDrills, SEED_STAGGER_MS, type SeedDrillSpec } from './seedDrills.ts';
import { SEED_DRILL_SPECS } from './seedDrillContent.ts';
import { CURRENT_DRILL_SCHEMA, DRILL_LEVELS } from './drill.ts';
import { validateDrill, LIMITS } from './validate.ts';
import { COURT_DEFS } from './court.ts';
import { poseFromStored } from './chair.ts';
import { chairsOverlap } from '../physics/obb.ts';
import { CHAIR_SEP_PX } from '../core/constants.ts';
import { KNOWN_CATEGORIES } from '../core/colors.ts';

const built = () => buildSeedDrills(SEED_DRILL_SPECS, 1_700_000_000_000);

describe('seed 드릴 — 목록의 모양', () => {
  it('초급 · 중급 · 고급 하나씩 세 개다', () => {
    const drills = built();
    expect(drills).toHaveLength(3);
    expect(drills.map((d) => d.level)).toEqual(['초급', '중급', '고급']);
  });

  it('제목이 서로 다르고 비어 있지 않다 — 제목은 storage/seed.ts 의 자물쇠 ② 가 쓰는 열쇠다', () => {
    const titles = built().map((d) => d.title);
    expect(new Set(titles).size).toBe(3);
    for (const t of titles) expect(t.length).toBeGreaterThan(0);
  });

  it('초급이 목록 맨 위에 오도록 updatedAt 이 한 칸씩 뒤로 밀린다', () => {
    const [a, b, c] = built();
    expect(a!.updatedAt - b!.updatedAt).toBe(SEED_STAGGER_MS);
    expect(b!.updatedAt - c!.updatedAt).toBe(SEED_STAGGER_MS);
    // createdAt 도 같은 값이어야 '만든 순서'와 '고친 순서'가 어긋나지 않는다.
    for (const d of built()) expect(d.createdAt).toBe(d.updatedAt);
  });

  it('부를 때마다 새 id 다 — 두 번 심으면 두 벌이 된다(막는 것은 도장이지 이 함수가 아니다)', () => {
    expect(built()[0]!.id).not.toBe(built()[0]!.id);
    expect(built()[0]!.steps[0]!.id).not.toBe(built()[0]!.steps[0]!.id);
  });

  it('카테고리는 UI 가 노출하는 목록 안에 있다 — 아니면 목록 필터 칩으로 영영 못 찾는다', () => {
    for (const d of built()) expect(KNOWN_CATEGORIES as readonly string[]).toContain(d.category);
  });

  it('스키마 버전이 현행이라 마이그레이션이 한 단계도 돌지 않는다', () => {
    for (const d of built()) expect(d.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
  });
});

describe('seed 드릴 — 저장 왕복', () => {
  it('validateDrill 을 통과하고 문서가 한 글자도 바뀌지 않는다', () => {
    for (const d of built()) {
      const res = validateDrill(JSON.parse(JSON.stringify(d)));
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.value).toEqual(d);
    }
  });

  it('파괴적 보정이 0건이다 — 보정이 붙는다는 것은 심는 순간 내용이 깎였다는 뜻이다', () => {
    for (const d of built()) {
      const res = validateDrill(JSON.parse(JSON.stringify(d)));
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.repairs.filter((r) => r.destructive)).toEqual([]);
    }
  });

  it('교육 필드 7종이 저장 왕복을 견딘다 — validate.ts 화이트리스트 조립부의 함정', () => {
    for (const d of built()) {
      const res = validateDrill(JSON.parse(JSON.stringify(d)));
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      const v = res.value;
      expect(v.objective).toBe(d.objective);
      expect(v.coachingPoints).toEqual(d.coachingPoints);
      expect(v.playersNeeded).toBe(d.playersNeeded);
      expect(v.equipment).toBe(d.equipment);
      expect(v.reps).toBe(d.reps);
      expect(v.sets).toBe(d.sets);
      expect(v.intervalSec).toBe(d.intervalSec);
    }
  });
});

describe('seed 드릴 — 판 위의 값', () => {
  it('모든 개체가 코트 viewBox 안이다 (밖이면 validate 가 말없이 클램프한다)', () => {
    for (const d of built()) {
      const { vbW, vbH } = COURT_DEFS[d.courtMode];
      for (const s of d.steps) {
        for (const p of [...Object.values(s.chairs), ...Object.values(s.balls), ...Object.values(s.cones), ...s.notes]) {
          expect(p!.x).toBeGreaterThanOrEqual(0);
          expect(p!.x).toBeLessThanOrEqual(vbW);
          expect(p!.y).toBeGreaterThanOrEqual(0);
          expect(p!.y).toBeLessThanOrEqual(vbH);
        }
      }
    }
  });

  it('한 스텝 안에서 휠체어 두 대가 겹치지 않는다', () => {
    for (const d of built()) {
      for (const [i, s] of d.steps.entries()) {
        const poses = Object.values(s.chairs)
          .filter((p) => p !== undefined)
          .map(poseFromStored);
        for (let a = 0; a < poses.length; a++) {
          for (let b = a + 1; b < poses.length; b++) {
            expect(
              chairsOverlap(poses[a]!, poses[b]!, CHAIR_SEP_PX),
              `${d.title} 스텝 ${i + 1}: 휠체어 OBB 겹침`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('스텝의 pose 키가 전부 cast 안에 있다 — 없으면 심는 즉시 조용히 버려진다', () => {
    for (const d of built()) {
      const chairIds = new Set(d.cast.chairs.map((c) => c.id));
      const ballIds = new Set(d.cast.balls.map((b) => b.id));
      const coneIds = new Set(d.cast.cones.map((c) => c.id));
      for (const s of d.steps) {
        for (const k of Object.keys(s.chairs)) expect(chairIds.has(k as never)).toBe(true);
        for (const k of Object.keys(s.balls)) expect(ballIds.has(k as never)).toBe(true);
        for (const k of Object.keys(s.cones)) expect(coneIds.has(k as never)).toBe(true);
      }
    }
  });

  it('cast 에 놓이지 않는 유령 개체가 없다 — 공·콘은 어느 스텝에선가 반드시 쓰인다', () => {
    for (const d of built()) {
      for (const b of d.cast.balls) expect(d.steps.some((s) => s.balls[b.id])).toBe(true);
      for (const c of d.cast.cones) expect(d.steps.some((s) => s.cones[c.id])).toBe(true);
    }
  });

  it('화살표 세 점이 모두 유한하고 곧은 화살표의 굽힘점은 중점이다', () => {
    for (const d of built()) {
      for (const s of d.steps) {
        for (const a of s.arrows) {
          for (const p of [a.from, a.ctrl, a.to]) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
          }
          expect(a.ctrl.x).toBeCloseTo((a.from.x + a.to.x) / 2, 6);
          expect(a.ctrl.y).toBeCloseTo((a.from.y + a.to.y) / 2, 6);
        }
      }
    }
  });
});

describe('seed 드릴 — 온보딩 대본 계약 (§3)', () => {
  it('모든 스텝 note 가 훈련 내용과 조작 설명을 함께 담는다', () => {
    for (const d of built()) {
      for (const [i, s] of d.steps.entries()) {
        const at = s.note.indexOf('\n조작: ');
        expect(at, `${d.title} 스텝 ${i + 1}: '조작: ' 도막이 없다`).toBeGreaterThan(0);
        // 앞 도막(훈련 내용)이 실제로 있어야 한다 — 조작 설명만 있는 스텝은 드릴이 아니다.
        expect(s.note.slice(0, at).trim().length).toBeGreaterThan(10);
        // 뒤 도막(조작 설명)도 마찬가지다.
        expect(s.note.slice(at + 5).trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('스펙의 스텝 이름은 상한 안이고, 빌드된 스텝은 이미 이관되어 있다', () => {
    // 과제⑦(기현님 확정 2026-08-17): DrillStep.name 은 UI 에서 폐기됐다 — buildStep 이
    // validate.ts 와 같은 규칙(migrateStepName)으로 미리 note 에 합쳐 넣으므로 빌드된
    // 스텝은 항상 name:'' 이고, 스펙에 적은 이름은 note 첫 줄로 살아 있다(보존 이관).
    // SeedStepSpec.name 자체는 여전히 저작용 필드다(제목 한 줄 + 본문이 대본 쓰기 편해서) —
    // 그 원문의 길이 상한만 여기서 잰다.
    for (const spec of SEED_DRILL_SPECS) {
      for (const s of spec.steps) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.name.length).toBeLessThanOrEqual(LIMITS.stepNameLen);
      }
    }
    for (const [di, d] of built().entries()) {
      for (const [si, s] of d.steps.entries()) {
        const specName = SEED_DRILL_SPECS[di]!.steps[si]!.name;
        expect(s.name, `${d.title} 스텝 ${si + 1}: name 이 남아 있다`).toBe('');
        expect(s.note.startsWith(specName), `${d.title} 스텝 ${si + 1}: note 가 이름으로 시작하지 않는다`).toBe(true);
      }
    }
  });

  it('note 가 상한(600자) 안이다 — 넘으면 validate 가 말없이 자른다', () => {
    for (const d of built()) {
      for (const s of d.steps) expect(s.note.length).toBeLessThanOrEqual(LIMITS.noteLen);
    }
  });

  it('교육 필드가 비어 있지 않다 — 4차 PDF 계획서가 읽어 갈 값이다', () => {
    for (const d of built()) {
      expect(d.objective!.length).toBeGreaterThan(0);
      expect(d.objective!.length).toBeLessThanOrEqual(LIMITS.objectiveLen);
      expect(d.coachingPoints!.length).toBeGreaterThan(0);
      expect(d.coachingPoints!.length).toBeLessThanOrEqual(LIMITS.coachingPointCount);
      for (const p of d.coachingPoints!) expect(p.length).toBeLessThanOrEqual(LIMITS.coachingPointLen);
      expect(d.playersNeeded).toBeGreaterThan(0);
      expect(d.equipment!.length).toBeGreaterThan(0);
    }
  });

  it('세 드릴 전체가 앱의 말을 한 번씩 쓴다 — 선수·공·콘·선·코트 메모·스텝 시간·실명', () => {
    const drills = built();
    const steps = drills.flatMap((d) => d.steps);
    expect(steps.some((s) => Object.keys(s.chairs).length > 0)).toBe(true);
    expect(steps.some((s) => Object.keys(s.balls).length > 0)).toBe(true);
    expect(steps.some((s) => Object.keys(s.cones).length > 0)).toBe(true);
    // 2026-08-16 — 화살표 종류가 사라져 '2종' 이 '선' 하나가 됐다. 대본이 선을 **쓰기는 하는가**
    // 만 재면 된다(옛 단언이 지키던 것도 결국 그것이다).
    expect(steps.some((s) => s.arrows.length > 0)).toBe(true);
    expect(steps.some((s) => s.notes.length > 0)).toBe(true);
    expect(steps.some((s) => s.durationMs !== undefined)).toBe(true);
    expect(drills.some((d) => d.cast.chairs.some((c) => c.name))).toBe(true);
  });
});

describe('buildSeedDrill — 변환기 자체', () => {
  const minimal: SeedDrillSpec = {
    title: '변환기 시험',
    category: '공격',
    level: '중급',
    courtMode: 'full',
    durationMin: 5,
    steps: [{ name: '한 장', note: '내용입니다.\n조작: 이렇게 합니다.', chairs: { 'home-2': [200, 200, 0] } }],
  };

  it('명단은 8명 그대로다 — 스텝에 안 놓인 선수도 트레이 주차 슬롯에 남아야 한다', () => {
    const d = buildSeedDrill(minimal, 1);
    expect(d.cast.chairs).toHaveLength(8);
    expect(Object.keys(d.steps[0]!.chairs)).toHaveLength(1);
  });

  it('공 개수를 스텝에서 파생한다 — 스펙에 개수 필드가 없어 어긋날 수 없다', () => {
    const two = buildSeedDrill({ ...minimal, steps: [{ ...minimal.steps[0]!, balls: [[10, 10], [20, 20]] }] }, 1);
    expect(two.cast.balls).toHaveLength(2);
    // 대조군 — 공이 한 번도 안 나오는 스펙은 cast 에도 공이 없다(놓지도 못하는 유령 방지).
    expect(buildSeedDrill(minimal, 1).cast.balls).toHaveLength(0);
  });

  it('콘 색이 드릴 쪽 배열 순서대로 붙는다', () => {
    const d = buildSeedDrill({ ...minimal, cones: [1, 0], steps: [{ ...minimal.steps[0]!, cones: [[10, 10], [20, 20]] }] }, 1);
    expect(d.cast.cones.map((c) => c.colorIndex)).toEqual([1, 0]);
  });

  it('실명은 적은 자리에만 붙는다', () => {
    const d = buildSeedDrill({ ...minimal, players: { 'home-2': '민수' } }, 1);
    const byNumber = Object.fromEntries(d.cast.chairs.filter((c) => c.team === 'home').map((c) => [c.number, c.name]));
    expect(byNumber['2']).toBe('민수');
    expect(byNumber['3']).toBeUndefined();
  });

  it('durationMs 는 적은 스텝에만 실린다 — 안 적은 스텝에 0 을 심으면 재생이 멈춘다', () => {
    const d = buildSeedDrill({ ...minimal, steps: [minimal.steps[0]!, { ...minimal.steps[0]!, durationMs: 3000 }] }, 1);
    expect('durationMs' in d.steps[0]!).toBe(false);
    expect(d.steps[1]!.durationMs).toBe(3000);
  });

  it('DRILL_LEVELS 밖의 난이도는 애초에 타입이 막는다(런타임 폴백에 기대지 않는다)', () => {
    expect(DRILL_LEVELS as readonly string[]).toContain(buildSeedDrill(minimal, 1).level);
  });
});
