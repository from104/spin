// 표시 순서(z-order) 순수 함수 검증 — docs/PLAN-Z-ORDER.md 결정 2·5.
//
// 여기서 지키는 실기 버그는 셋이다: ① 옛 드릴(목록 없음)의 그림이 바뀐다 ② 사용자가 정한
// 순서가 렌더에서 무시된다 ③ 겹치지 않는 개체와 자리를 바꿔 "눌렀는데 아무 일도 없음" 이 된다.
// 겹침 기하는 여기서 안 잰다(physics/bounds.ts 의 몫) — 이 파일은 집합을 받기만 한다.
import { describe, expect, it } from 'vitest';
import type { Arrow } from './arrow.ts';
import type { DrillCast, DrillStep, NoteLabel } from './drill.ts';
import type { Shape } from './shape.ts';
import type { Stroke } from './stroke.ts';
import { DEFAULT_TIERS, kindOfId, moveZ, sceneOrder, zMoves } from './zOrder.ts';

/** 이 파일의 함수들은 개체의 `id` 만 읽는다 — 좌표·색은 순서와 무관하므로 최소 리터럴로 짓는다. */
const refs = (ids: readonly string[]): Array<{ id: string }> => ids.map((id) => ({ id }));

function mkCast(ids: { chairs?: string[]; balls?: string[]; cones?: string[] } = {}): DrillCast {
  return {
    chairs: (ids.chairs ?? []).map((id) => ({ id, team: 'home', number: '2', isGk: false })) as DrillCast['chairs'],
    balls: refs(ids.balls ?? []) as DrillCast['balls'],
    cones: (ids.cones ?? []).map((id) => ({ id, colorIndex: 0 })) as DrillCast['cones'],
  };
}

function mkStep(p: {
  chairs?: string[];
  balls?: string[];
  cones?: string[];
  arrows?: string[];
  notes?: string[];
  shapes?: string[];
  strokes?: string[];
  zOrder?: string[];
}): DrillStep {
  const poses = (ids: readonly string[]): Record<string, { x: number; y: number }> =>
    Object.fromEntries(ids.map((id) => [id, { x: 0, y: 0 }]));
  return {
    id: 'st_1',
    name: '',
    note: '',
    chairs: poses(p.chairs ?? []) as DrillStep['chairs'],
    balls: poses(p.balls ?? []) as DrillStep['balls'],
    cones: poses(p.cones ?? []) as DrillStep['cones'],
    arrows: refs(p.arrows ?? []) as unknown as Arrow[],
    notes: refs(p.notes ?? []) as unknown as NoteLabel[],
    shapes: refs(p.shapes ?? []) as unknown as Shape[],
    ...(p.strokes ? { strokes: refs(p.strokes) as unknown as Stroke[] } : {}),
    ...(p.zOrder ? { zOrder: p.zOrder } : {}),
  };
}

const idsOf = (step: DrillStep, cast: DrillCast): string[] => sceneOrder(step, cast).map((r) => r.id);

describe('sceneOrder ① — zOrder 가 없으면 기본층 순서', () => {
  // 지우면 새는 버그: 옛 드릴(목록 없는 드릴 전부)의 그림이 조용히 바뀐다. 도형이 칩 위로
  // 올라오면 2026-08-14 지시("도형은 칩·화살표보다 낮게")가 데이터 변경 없이 뒤집힌다.
  it('도형이 맨 아래, 메모가 맨 위 — DEFAULT_TIERS 그대로다', () => {
    const cast = mkCast({ chairs: ['ch_1'], balls: ['bl_1'], cones: ['cn_1'] });
    const step = mkStep({
      chairs: ['ch_1'],
      balls: ['bl_1'],
      cones: ['cn_1'],
      arrows: ['ar_1'],
      notes: ['nt_1'],
      shapes: ['sh_1'],
      strokes: ['fh_1'],
    });
    expect(idsOf(step, cast)).toEqual(['sh_1', 'cn_1', 'fh_1', 'ar_1', 'ch_1', 'bl_1', 'nt_1']);
    expect(sceneOrder(step, cast).map((r) => r.kind)).toEqual([...DEFAULT_TIERS]);
  });

  // 지우면 새는 버그: 층 안 순서가 흔들리면 겹쳐 놓은 콘 두 개가 저장·복원마다 앞뒤로 튄다.
  // 캐스트 개체는 **cast 배열 순서**여야 한다 — 스텝의 PoseMap 키 순서는 왕복에서 안 정해진다.
  it('층 안에서는 cast 배열 순서(콘)·스텝 배열 순서(화살표)를 따른다', () => {
    const cast = mkCast({ cones: ['cn_a', 'cn_b'] });
    const step = mkStep({ cones: ['cn_b', 'cn_a'], arrows: ['ar_b', 'ar_a'] });
    expect(idsOf(step, cast)).toEqual(['cn_a', 'cn_b', 'ar_b', 'ar_a']);
  });

  // 지우면 새는 버그: 트레이로 뺀(= 스텝에 pose 가 없는) 휠체어가 순서 목록에 끼어들면
  // 렌더가 없는 개체를 그리려 하고, 히트테스트는 화면에 없는 것을 집는다.
  it('cast 에는 있지만 이 스텝에 안 놓인 개체는 빠진다', () => {
    const cast = mkCast({ chairs: ['ch_1', 'ch_2'] });
    expect(idsOf(mkStep({ chairs: ['ch_2'] }), cast)).toEqual(['ch_2']);
  });
});

describe('sceneOrder ②③ — 목록이 있을 때', () => {
  const cast = mkCast({ chairs: ['ch_1'], balls: ['bl_1'] });

  // 지우면 새는 버그: 사용자가 공을 휠체어 밑으로 보냈는데 화면은 그대로다(= 기능 자체가 죽는다).
  it('목록 순서가 기본층을 이긴다', () => {
    const step = mkStep({ chairs: ['ch_1'], balls: ['bl_1'], zOrder: ['bl_1', 'ch_1'] });
    expect(idsOf(step, cast)).toEqual(['bl_1', 'ch_1']);
  });

  // 지우면 새는 버그: 지워진 개체의 id 가 목록에 남아 있으면 렌더가 없는 것을 그리려 한다.
  it('스텝에 없는 id·모르는 접두·중복은 무시한다', () => {
    const step = mkStep({ chairs: ['ch_1'], zOrder: ['ch_9', 'st_1', 'ch_1', 'ch_1'] });
    expect(idsOf(step, cast)).toEqual(['ch_1']);
  });

  // 지우면 새는 버그: 목록이 있는 스텝에 새 콘을 놓았을 때 그것이 기본층 자리(아래쪽)로
  // 끼어들면, 방금 놓은 개체가 사용자가 올려 둔 것들 **밑에 깔려** 안 보인다.
  it('목록에 없는 개체는 기본층 자리가 아니라 끝(맨 위)에 붙는다', () => {
    const c = mkCast({ chairs: ['ch_1'], cones: ['cn_new'] });
    const step = mkStep({ chairs: ['ch_1'], cones: ['cn_new'], zOrder: ['ch_1'] });
    expect(idsOf(step, c)).toEqual(['ch_1', 'cn_new']);
  });
});

describe('kindOfId', () => {
  // 지우면 새는 버그: 접두를 잘못 읽으면 렌더가 콘을 메모 컴포넌트로 그린다(빈 화면).
  it('7종 접두를 종류로 옮기고, 그 밖은 null', () => {
    expect(['cn_1', 'fh_1', 'ar_1', 'ch_1', 'bl_1', 'nt_1', 'sh_1'].map(kindOfId)).toEqual([
      'cone',
      'stroke',
      'arrow',
      'chair',
      'ball',
      'note',
      'shape',
    ]);
    expect(kindOfId('st_1')).toBeNull();
    expect(kindOfId('nope')).toBeNull();
  });
});

// ── 명령 (결정 5) ────────────────────────────────────────────────────────────────────────
// 판: 아래→위 [sh_1, cn_1, ar_1, ch_1, nt_1]. 겹치는 것은 sh_1·ch_1 뿐이라고 치자.
const cmdCast = mkCast({ chairs: ['ch_1'], cones: ['cn_1'] });
const cmdStep = mkStep({ chairs: ['ch_1'], cones: ['cn_1'], arrows: ['ar_1'], notes: ['nt_1'], shapes: ['sh_1'] });

describe('zMoves — 겹침 문지기', () => {
  // 지우면 새는 버그: 아무것도 안 겹치는 개체에 메뉴가 열려, 눌러도 화면이 안 변한다.
  it('겹치는 개체가 하나도 없으면 넷 다 false', () => {
    expect(zMoves(cmdStep, cmdCast, 'ch_1', new Set())).toEqual({
      back: false,
      backward: false,
      forward: false,
      front: false,
    });
  });

  // 지우면 새는 버그: 위쪽에 겹치는 것이 없는데 [한 단계 앞으로] 가 눌린다 → 무반응.
  it('그 방향에 겹치는 것이 없으면 그 한 단계만 막힌다', () => {
    // sh_1 은 맨 아래. 위에 겹치는 것(ch_1)이 있으니 forward 는 되고 backward 는 안 된다.
    expect(zMoves(cmdStep, cmdCast, 'sh_1', new Set(['ch_1']))).toEqual({
      back: false, // 이미 맨 아래
      backward: false,
      forward: true,
      front: true,
    });
  });

  // 지우면 새는 버그: 이미 맨 위인데 [맨 앞으로] 가 눌린다(무반응 + undo 스택만 쌓인다).
  it('이미 끝이면 front/back 이 막힌다', () => {
    expect(zMoves(cmdStep, cmdCast, 'nt_1', new Set(['sh_1']))).toMatchObject({ front: false, back: true });
  });

  // 지우면 새는 버그: 지워졌거나 이 스텝에 없는 개체에 메뉴가 열린다.
  it('이 스텝에 없는 id 는 넷 다 false', () => {
    expect(zMoves(cmdStep, cmdCast, 'ch_9', new Set(['sh_1']))).toMatchObject({ forward: false, front: false });
  });
});

describe('moveZ', () => {
  // 지우면 새는 버그: 안 겹치는 개체와 한 칸씩 바꾸느라 [한 단계 앞으로] 를 서너 번 눌러야
  // 화면이 변한다 — 사용자에게는 "몇 번은 무반응" 으로 보인다.
  it('forward 는 안 겹치는 것을 건너뛰고 겹치는 것 바로 위로 간다', () => {
    // sh_1 위: cn_1(안 겹침) ar_1(안 겹침) ch_1(겹침) nt_1. → ch_1 바로 위.
    const next = moveZ(cmdStep, cmdCast, 'sh_1', 'forward', new Set(['ch_1']));
    expect(next.zOrder).toEqual(['cn_1', 'ar_1', 'ch_1', 'sh_1', 'nt_1']);
  });

  it('backward 는 대칭 — 겹치는 것 바로 아래로 간다', () => {
    const next = moveZ(cmdStep, cmdCast, 'nt_1', 'backward', new Set(['cn_1']));
    expect(next.zOrder).toEqual(['sh_1', 'nt_1', 'cn_1', 'ar_1', 'ch_1']);
  });

  // 지우면 새는 버그: [맨 앞으로] 가 한 칸만 올리거나 목록 밖으로 나간다.
  it('front/back 은 목록 끝·처음으로 간다', () => {
    const ov = new Set(['sh_1', 'ch_1']);
    expect(moveZ(cmdStep, cmdCast, 'sh_1', 'front', ov).zOrder).toEqual(['cn_1', 'ar_1', 'ch_1', 'nt_1', 'sh_1']);
    expect(moveZ(cmdStep, cmdCast, 'nt_1', 'back', ov).zOrder).toEqual(['nt_1', 'sh_1', 'cn_1', 'ar_1', 'ch_1']);
  });

  // 지우면 새는 버그: 불가능한 명령이 새 객체를 만들어 undo 스택에 "아무 일도 안 한 편집" 이
  // 쌓인다 — 되돌리기를 여러 번 눌러야 진짜 편집으로 돌아간다(edits.ts 의 동일 참조 규약).
  it('불가능하면 같은 step 참조를 그대로 돌려준다', () => {
    expect(moveZ(cmdStep, cmdCast, 'ch_1', 'forward', new Set())).toBe(cmdStep);
    expect(moveZ(cmdStep, cmdCast, 'nt_1', 'front', new Set(['sh_1']))).toBe(cmdStep);
    expect(moveZ(cmdStep, cmdCast, 'ch_9', 'back', new Set(['sh_1']))).toBe(cmdStep);
  });

  // 지우면 새는 버그: 옮긴 개체 하나만 적는 부분 목록은 "목록에 없는 것" 규칙(③)에 걸려
  // 나머지 개체가 전부 그 위로 튀어 오른다.
  it('첫 재배치가 그 스텝의 전체 순서를 물질화하고, 원본은 안 건드린다', () => {
    const next = moveZ(cmdStep, cmdCast, 'sh_1', 'front', new Set(['sh_1', 'ch_1']));
    expect(next.zOrder).toHaveLength(5);
    expect(cmdStep.zOrder).toBeUndefined();
  });
});
