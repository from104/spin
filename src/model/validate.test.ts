// §3.8 검증·보정 — 11단계 파이프라인, 멱등성, throw 없음.
import { describe, expect, it } from 'vitest';
import { createDrill } from './defaults.ts';
import { LIMITS, validateDrill, validateSession } from './validate.ts';

describe('validateDrill — 멱등성', () => {
  it('한 번 통과한 값을 다시 넣으면 repairs 가 비어 있다', () => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const first = validateDrill(d);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(first.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.repairs).toHaveLength(0);
  });
});

describe('validateDrill — 실패 조건', () => {
  it('id 가 없으면 ok:false', () => {
    const r = validateDrill({ courtMode: 'full', steps: [] });
    expect(r.ok).toBe(false);
  });
  it('courtMode 가 3종이 아니면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'weird', steps: [] });
    expect(r.ok).toBe(false);
  });
  it('steps 가 배열이 아니면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'full', steps: {} });
    expect(r.ok).toBe(false);
  });
  it('schemaVersion 이 현재보다 크면 ok:false', () => {
    const r = validateDrill({ id: 'dr_x', courtMode: 'full', steps: [], schemaVersion: 999 });
    expect(r.ok).toBe(false);
  });
});

describe('validateDrill — 보정', () => {
  it('cast 에 없는 pose 를 제거한다', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'full',
      cast: { chairs: [{ id: 'ch_a', team: 'home', number: '2', isGk: false }], balls: [], cones: [] },
      steps: [
        {
          id: 'st_1',
          name: 's1',
          note: '',
          chairs: { ch_a: { x: 1, y: 1, angleDeg: 0 }, ch_ghost: { x: 9, y: 9, angleDeg: 0 } },
          balls: {},
          cones: {},
          arrows: [],
          notes: [],
        },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.chairs['ch_a' as never]).toBeDefined();
    expect('ch_ghost' in r.value.steps[0]!.chairs).toBe(false);
    expect(r.repairs.some((x) => x.destructive)).toBe(true);
  });

  it('공 11개는 10개로 절단되고, 잘린 공의 고아 pose 도 같이 제거된다', () => {
    const balls = Array.from({ length: 11 }, (_, i) => ({ id: `bl_${i}` }));
    const ballPoses: Record<string, { x: number; y: number }> = {};
    for (const b of balls) ballPoses[b.id] = { x: 1, y: 1 };
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls, cones: [] },
      steps: [{ id: 'st_1', name: 's', note: '', chairs: {}, balls: ballPoses, cones: {}, arrows: [], notes: [] }],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cast.balls).toHaveLength(10);
    expect(Object.keys(r.value.steps[0]!.balls)).toHaveLength(10);
    expect('bl_10' in r.value.steps[0]!.balls).toBe(false);
  });

  it('viewBox 밖 좌표는 클램프된다', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls: [{ id: 'bl_a' }], cones: [] },
      steps: [
        { id: 'st_1', name: 's', note: '', chairs: {}, balls: { bl_a: { x: -999, y: 99999 } }, cones: {}, arrows: [], notes: [] },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.value.steps[0]!.balls['bl_a' as never]!;
    // flat viewBox 는 마진 1.5 m 반영 후 525×450 이다(half 와 동일해야 한다, D12).
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(525);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(450);
  });

  it('cut: true 는 왕복 보존되고, 잘못된 값(false·1)은 버려진다(키 없음 = 연결)', () => {
    const base = { id: 'st_1', name: 's', note: '', chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] };
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls: [], cones: [] },
      steps: [
        { ...base, id: 'st_1', cut: true },
        { ...base, id: 'st_2', cut: false },
        { ...base, id: 'st_3', cut: 1 },
        { ...base, id: 'st_4' }, // 키 자체가 없는 옛 드릴 형태
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.cut).toBe(true);
    expect('cut' in r.value.steps[1]!).toBe(false); // false 는 버려진다(저장하지 않는다)
    expect('cut' in r.value.steps[2]!).toBe(false); // 1 도 버려진다 — true 만 유효
    expect('cut' in r.value.steps[3]!).toBe(false); // 없음은 그대로 없음 = 연결
    expect(r.repairs.some((x) => x.path === 'steps.cut')).toBe(true);
    // 멱등성: 한 번 통과한 값을 다시 넣으면 repairs.cut 이 재발하지 않는다.
    const second = validateDrill(r.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.repairs.some((x) => x.path === 'steps.cut')).toBe(false);
  });

  it("formation:'4-4-2' 이고 steps:[] 인 파일이 throw 없이 통과한다", () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'full',
      formation: '4-4-2',
      cast: { chairs: [], balls: [], cones: [] },
      steps: [],
    };
    expect(() => validateDrill(raw)).not.toThrow();
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.formation).toBe('1-2-1');
    expect(r.value.steps).toHaveLength(1);
  });

  it('★ 옛 kind 는 버려지고, 화살촉만 살아남는다 (2026-08-16 선 통일)', () => {
    const raw = {
      id: 'dr_x',
      courtMode: 'flat',
      cast: { chairs: [], balls: [], cones: [] },
      steps: [
        {
          id: 'st_1',
          name: 's',
          note: '',
          chairs: {},
          balls: {},
          cones: {},
          arrows: [{ id: 'ar_1', kind: 'teleport', from: { x: 0, y: 0 }, ctrl: { x: 1, y: 1 }, to: { x: 2, y: 2 } }],
          notes: [],
        },
      ],
    };
    const r = validateDrill(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // kind 는 모델에 없는 필드다 — 정화기가 조용히 버린다.
    expect((r.value.steps[0]!.arrows[0]! as unknown as Record<string, unknown>).kind).toBeUndefined();
    // 알 수 없는 화살촉 값도 같은 규율로 버려진다(없으면 기본값이 곧 옛 모양이다).
    expect(r.value.steps[0]!.arrows[0]!.headTo).toBeUndefined();
  });

  it('완전히 깨진(빈) 객체도 throw 없이 실패 결과를 준다', () => {
    expect(() => validateDrill({})).not.toThrow();
    expect(() => validateDrill(null)).not.toThrow();
    expect(() => validateDrill('garbage')).not.toThrow();
    expect(() => validateDrill(42)).not.toThrow();
  });
});

// 과제⑦(기현님 확정 2026-08-17): 스텝 이름 필드는 UI 에서 폐기됐다. 정화기가 옛 이름을
// note 로 이관해 유실 없이 보존하되, 자동 생성 패턴('스텝 N')은 사용자 내용이 아니므로
// 이관 없이 버린다. §스텝 카드.
describe('validateDrill — 스텝 이름 이관(과제⑦)', () => {
  const withStepName = (name: string, note: string) => {
    const d = createDrill({ courtMode: 'full', formation: '1-2-1' });
    return { ...d, steps: [{ ...d.steps[0]!, name, note }] };
  };

  it('의미 있는 이름은 note 첫 줄로 합쳐 보존하고 name 을 비운다', () => {
    const r = validateDrill(withStepName('어깨너비 확인', '설명'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.name).toBe('');
    expect(r.value.steps[0]!.note).toBe('어깨너비 확인\n설명');
  });

  it('note 가 비어 있으면 이름만 note 가 된다(가운데 줄바꿈 없음)', () => {
    const r = validateDrill(withStepName('어깨너비 확인', ''));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.note).toBe('어깨너비 확인');
  });

  it("자동 생성 이름('스텝 N')은 이관 없이 버린다 — 사용자 내용이 아니다", () => {
    const r = validateDrill(withStepName('스텝 7', '내용'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.name).toBe('');
    expect(r.value.steps[0]!.note).toBe('내용'); // 자동 생성 이름이 note 에 섞여 들지 않는다
  });

  it("'스텝'으로 시작해도 숫자만이 아니면(예: '스텝 3: 킥오프') 자동 생성 패턴이 아니라 이관한다", () => {
    const r = validateDrill(withStepName('스텝 3: 킥오프', '내용'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.note).toBe('스텝 3: 킥오프\n내용');
  });

  it('note 가 이미 그 이름으로 시작하면 중복 병합을 건너뛴다', () => {
    const r = validateDrill(withStepName('서두', '서두\n이미 있는 내용'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.name).toBe('');
    expect(r.value.steps[0]!.note).toBe('서두\n이미 있는 내용');
  });

  it('이름이 비어 있으면 note 가 그대로다(무변)', () => {
    const r = validateDrill(withStepName('', '원래 메모'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.steps[0]!.name).toBe('');
    expect(r.value.steps[0]!.note).toBe('원래 메모');
  });

  it('병합이 노트 상한(600)을 넘으면 뒤(원래 note 쪽)를 자르고 이름은 잘리지 않는다', () => {
    const name = 'X'.repeat(LIMITS.stepNameLen); // 40자 — 이름 자체 길이 상한 안
    const note = 'Y'.repeat(LIMITS.noteLen); // 600자 — note 단독으로는 상한 안
    const r = validateDrill(withStepName(name, note));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const got = r.value.steps[0]!.note;
    expect(got.length).toBe(LIMITS.noteLen);
    expect(got.startsWith(`${name}\n`)).toBe(true); // 이름 40자 + 줄바꿈까지 온전 — 잘린 건 note 꼬리뿐
  });

  it('멱등성: 이관 결과를 다시 정화해도 바뀌지 않는다', () => {
    const first = validateDrill(withStepName('어깨너비 확인', '설명'));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = validateDrill(first.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.steps[0]!.name).toBe('');
    expect(second.value.steps[0]!.note).toBe('어깨너비 확인\n설명');
    expect(second.repairs.filter((r) => r.path === 'steps.name' || r.path === 'steps.note')).toHaveLength(0);
  });
});

describe('validateSession', () => {
  it('정상 세션은 그대로 통과한다', () => {
    const raw = {
      id: 'se_x',
      title: '세션',
      items: [{ id: 'it_1', drillId: 'dr_1', titleCache: 'A', durationMinCache: 10, categoryCache: '공격' }],
    };
    const r = validateSession(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.drillIds).toEqual(['dr_1']);
  });

  it('id 가 없으면 ok:false', () => {
    expect(validateSession({ items: [] }).ok).toBe(false);
  });
});
