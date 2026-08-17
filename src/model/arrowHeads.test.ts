// 선 하나 + 양 끝 화살촉 (기현 지시 2026-08-16).
//
// *"작도에 패스, 이동이 무의미하다. 선으로 통일하고 양 끝 앵커를 반복 클릭하면
//  [화살표 없음, 폭이 좁은 화살표, 폭이 넓은 화살표] 순차로 변하게."*
//
// 여기서 재는 것은 **순환의 계약**이다: 세 번 누르면 제자리로 오는가, 기본값이 옛 모양인가,
// 두 끝이 서로를 안 건드리는가. 화면(마커 id)은 objects.test 가, 포인터 배선은
// arrowPointer.test 가 각각 잰다.
import { describe, expect, it } from 'vitest';
import { ARROW_COLOR_CYCLE, ARROW_HEAD_CYCLE, ARROW_STYLE, arrowColor, cycleHead, headFromOf, headToOf, nudgeArrow } from './arrow.ts';
import type { Arrow, ArrowHead } from './arrow.ts';
import { ARROW_COLOR } from '../core/colors.ts';
import type { ArrowId } from '../core/ids.ts';

const A = (over: Partial<Arrow> = {}): Arrow => ({
  id: 'ar_1' as ArrowId,
  from: { x: 0, y: 0 },
  ctrl: { x: 50, y: 0 },
  to: { x: 100, y: 0 },
  ...over,
});

describe('화살촉 순환 — 없음 → 좁은 → 넓은 → 없음', () => {
  it('★ 세 번 누르면 제자리다', () => {
    let h: ArrowHead = 'none';
    h = cycleHead(h);
    expect(h).toBe('thin');
    h = cycleHead(h);
    expect(h).toBe('wide');
    h = cycleHead(h);
    expect(h, '세 번째에 처음으로 안 돌아왔다 — 끄는 길이 없어진다').toBe('none');
  });

  it('순환 목록의 **첫 값이 없음**이다 — 그래야 세 번에 끌 수 있다', () => {
    expect(ARROW_HEAD_CYCLE[0]).toBe('none');
    expect([...ARROW_HEAD_CYCLE].sort()).toEqual(['none', 'thin', 'wide']);
  });
});

describe('기본값 — 옛 화살표가 그대로 보인다', () => {
  it('★ 값이 없으면 시작점 없음 · 끝점 좁은 화살표다', () => {
    // 2026-08-16 이전의 화살표는 **전부** 이 모양이었다. 마이그레이션이 값을 안 찍어도
    // 옛 드릴이 그대로 보이는 근거가 이 두 줄이다.
    const a = A();
    expect(headFromOf(a)).toBe('none');
    expect(headToOf(a)).toBe('thin');
  });

  it('명시한 값이 기본값을 이긴다', () => {
    expect(headFromOf(A({ headFrom: 'wide' }))).toBe('wide');
    expect(headToOf(A({ headTo: 'none' }))).toBe('none');
  });

  it('두 끝은 서로를 안 건드린다 — 한쪽을 돌려도 다른 쪽은 그대로다', () => {
    const a = A({ headFrom: 'wide', headTo: 'none' });
    const next: Arrow = { ...a, headTo: cycleHead(headToOf(a)) };
    expect(next.headTo).toBe('thin');
    expect(next.headFrom, '반대쪽이 함께 움직였다').toBe('wide');
  });
});

describe('선 하나 — 종류가 사라졌다', () => {
  it('색은 한 값이고, 개별 색이 그것을 덮는다', () => {
    expect(arrowColor(A())).toBe(ARROW_STYLE.color);
    expect(arrowColor(A({ color: '#abcdef' }))).toBe('#abcdef');
  });

  it('★ 썸네일의 색이 모델의 색과 같다 — 갈라지면 목록 카드만 다른 색이 된다', () => {
    // 2026-08-17 이전에는 값이 core·model 두 곳에 **리터럴로** 적혀 있었고(core 는 model 을
    // import 하지 않는다 — 의존 방향 §9), 이 단언이 그 둘을 대조하는 자리였다. 색이 3단으로
    // 늘면서 리터럴을 core 한 곳으로 모았으므로 이제는 **파생이 끊기지 않았는지**를 잰다.
    expect(ARROW_COLOR).toBe(ARROW_STYLE.color);
    expect(ARROW_COLOR).toBe(ARROW_COLOR_CYCLE[0]);
  });

  it('통째로 밀면 화살촉은 안 바뀐다 — 옮기는 것이지 모양을 바꾸는 것이 아니다', () => {
    const a = A({ headFrom: 'wide', headTo: 'none' });
    const m = nudgeArrow(a, 'whole', { x: 7, y: -3 });
    expect(m.headFrom).toBe('wide');
    expect(m.headTo).toBe('none');
    expect(m.from).toEqual({ x: 7, y: -3 });
    expect(m.to).toEqual({ x: 107, y: -3 });
    expect(m.ctrl).toEqual({ x: 57, y: -3 });
  });
});
