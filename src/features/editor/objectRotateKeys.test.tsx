// Q·E 회전이 **어느 개체에 걸리고 어느 개체에 안 걸리는가**(2026-09-14 기현님 지시:
// *"모든 객체가 wasd,qe 키에 의해 위치 및 회전이 되어야한다. 단 메모와 다중 선택에서 회전은 예외"*).
//
// 지우면 새는 것 셋:
// ① 도(度)와 라디안을 한 번 헷갈리면 한 번 눌렀는데 도형이 286° 돈다 — 화면에서는 "왜 이러지"
//    한 번이고, 테스트로는 **리터럴 숫자 하나**로 잡힌다. 그래서 여기 값은 전부 손으로 적었다.
// ② 획의 회전축을 매 키마다 다시 재면 획이 슬금슬금 흘러간다(경계상자 중심이 돌면 같이 움직인다).
//    ⚠️ 그 드리프트는 **한 바퀴(360°)에서 정확히 상쇄된다** — 처음에 72번 돌려 제자리인지 재려다
//    래치 없이도 초록이 나오는 것을 보고 알았다. 90°로 잰다(아래 주석에 실측표).
// ③ 여럿을 고른 채 E 를 누르면 **아무것도 안 돌아야** 한다. 예전에는 포커스 하나만 조용히 돌았다.
//
// 리듀서를 직접 돌린다 — 키 이벤트→DOM 경로는 jsdom 에서 좌표가 0 이라 못 재고, 여기서 재려는
// 것은 «어느 값이 얼마나 바뀌는가» 이지 «키가 배선됐는가» 가 아니다(배선은 keymap.contract 가 잰다).
import { describe, expect, it } from 'vitest';
import { canRotate, canRotateKind, canNudge } from './nudgeCaps.ts';
import { rotateStrokeAbout, strokeCenter } from '../../model/stroke.ts';
import { arrowMid, rotateArrowAbout } from '../../model/arrow.ts';
import type { Stroke } from '../../model/stroke.ts';
import type { Arrow } from '../../model/arrow.ts';
import { rotateShapeBy } from '../../model/shape.ts';
import type { Shape } from '../../model/shape.ts';
import type { ArrowId, ShapeId, StrokeId } from '../../core/ids.ts';

/** Q 는 −5°, E 는 +5°(Shift 는 15°) — EditorStage 의 FINE/COARSE_STEP_DEG 와 같은 값이다. */
const FINE_DEG = 5;
const RAD = Math.PI / 180;

describe('회전이 걸리는 종류', () => {
  it('휠체어·도형·선·자유선은 돌고, 공·콘·메모는 안 돈다 — 없는 축을 지어내지 않는다', () => {
    for (const id of ['ch_1', 'sh_1', 'ar_1', 'fh_1']) expect(canRotateKind(id), id).toBe(true);
    // 메모는 기현님이 명시한 예외이고, 공·콘은 모델에 각도 필드가 아예 없다.
    for (const id of ['nt_1', 'bl_1', 'cn_1']) expect(canRotateKind(id), id).toBe(false);
  });

  it('여럿이면 종류와 무관하게 안 돈다 — 무리의 회전축은 답이 하나로 안 나온다', () => {
    expect(canRotate(['sh_1'])).toBe(true);
    expect(canRotate(['sh_1', 'sh_2'])).toBe(false);
    expect(canRotate(['ch_1', 'nt_1'])).toBe(false);
    expect(canRotate([])).toBe(false);
  });

  it('도형은 이제 옮길 수 있다 — 이 줄이 빨개지면 [미세 조정] 칸과 키보드가 다시 갈린 것이다', () => {
    expect(canNudge(['sh_1'])).toBe(true);
    expect(canNudge(['sh_1', 'ch_1'])).toBe(true);
  });
});

describe('도형 회전 — 도(度)와 라디안을 섞지 않는다', () => {
  // ⚠️ **진짜 함수를 부른다.** 처음에는 같은 식을 테스트 안에 옮겨 적었는데, 그러면 EditorStage
  //    가 환산을 빼먹어도 초록이다(검사표가 제 손으로 답을 만든 셈). 그래서 산수를 모델
  //    (`rotateShapeBy`)로 옮기고 여기서 그것을 부른다 — 기대값만 리터럴로 적는다.
  const shape = (rot: number): Shape => ({ id: 'sh_1' as ShapeId, kind: 'rect', x: 0, y: 0, w: 100, h: 60, rot });

  it('E 한 번이면 5°, Q 한 번이면 355° — 라디안을 그대로 더하면 286° 가 나온다', () => {
    expect(rotateShapeBy(shape(0), FINE_DEG * RAD).rot).toBeCloseTo(5, 9);
    expect(rotateShapeBy(shape(0), -FINE_DEG * RAD).rot).toBeCloseTo(355, 9);
  });

  it('한 바퀴를 넘으면 0~360 으로 접힌다 — 같은 도형이 −5° 와 355° 두 값으로 저장되면 안 된다', () => {
    expect(rotateShapeBy(shape(357), FINE_DEG * RAD).rot).toBeCloseTo(2, 9);
    expect(rotateShapeBy(shape(2), -FINE_DEG * RAD).rot).toBeCloseTo(357, 9);
  });

  it('자리·크기는 안 건드린다 — 회전 키가 도형을 옮기면 그건 다른 기능이다', () => {
    const before = shape(30);
    const after = rotateShapeBy(before, FINE_DEG * RAD);
    expect({ x: after.x, y: after.y, w: after.w, h: after.h }).toEqual({ x: 0, y: 0, w: 100, h: 60 });
  });
});

describe('회전축 — 흘러가는가', () => {
  const stroke: Stroke = {
    id: 'fh_1' as StrokeId,
    points: [
      { x: 100, y: 100 },
      { x: 180, y: 140 },
      { x: 140, y: 220 },
    ],
  };

  it('획은 축을 **래치해야** 한 번에 90° 돌린 것과 같다 — 매번 다시 재면 15px 흘러간다', () => {
    // ⚠️ **360°로 재면 안 된다.** 한 바퀴를 채우면 흘러간 양이 정확히 상쇄되어 차이가 0 이 된다
    //    (실측: 30° 4.3px · 45° 7.2px · 90° 15.3px · 180° 21.6px · 360° 0.000px). 하필 그 각도로
    //    재면 래치를 빼도 초록이라, 이 테스트가 아무것도 안 지키게 된다. 90°로 잰다.
    const c0 = strokeCenter(stroke);
    const STEPS = 18; // 5° × 18 = 90°

    let latched = stroke;
    for (let i = 0; i < STEPS; i++) latched = rotateStrokeAbout(latched, c0, FINE_DEG * RAD);
    // 래치한 결과는 **한 번에 90° 돌린 것과 같아야** 한다 — 이것이 «축이 하나로 고정됐다» 의 뜻이다.
    const once = rotateStrokeAbout(stroke, c0, 90 * RAD);
    for (let i = 0; i < stroke.points.length; i++) {
      expect(Math.hypot(latched.points[i]!.x - once.points[i]!.x, latched.points[i]!.y - once.points[i]!.y)).toBeLessThan(0.001);
    }

    // 대조군 — 매번 다시 잰 축. 이쪽이 어긋난다는 것이 래치의 존재 이유다.
    let drifting = stroke;
    for (let i = 0; i < STEPS; i++) drifting = rotateStrokeAbout(drifting, strokeCenter(drifting), FINE_DEG * RAD);
    const gap = Math.max(
      ...drifting.points.map((p, i) => Math.hypot(p.x - latched.points[i]!.x, p.y - latched.points[i]!.y)),
    );
    expect(gap, '축을 다시 재면 15px 쯤 어긋난다').toBeGreaterThan(10);
  });

  it('선(화살표)은 래치가 필요 없다 — `arrowMid` 는 회전의 **고정점**이다', () => {
    const arrow: Arrow = {
      id: 'ar_1' as ArrowId,
      from: { x: 100, y: 100 },
      ctrl: { x: 160, y: 60 },
      to: { x: 220, y: 140 },
    };
    const m0 = arrowMid(arrow);
    let a = arrow;
    for (let i = 0; i < 72; i++) a = rotateArrowAbout(a, arrowMid(a), FINE_DEG * RAD);
    const m1 = arrowMid(a);
    expect(Math.hypot(m1.x - m0.x, m1.y - m0.y), '매번 다시 재도 같은 자리다').toBeLessThan(0.01);
  });
});
