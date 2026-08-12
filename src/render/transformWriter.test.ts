// §10.7 TransformWriter 검증. §6.2 의 blocker 회귀를 고정한다.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createTransformWriter } from './transformWriter.ts';

function makeG(): SVGGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'g');
}

describe('createTransformWriter', () => {
  it('writeFrame 을 구조분해해 호출해도 크래시하지 않는다(this 바인딩 회귀)', () => {
    const writer = createTransformWriter();
    const { writeFrame } = writer;
    expect(() => writeFrame({ a: { x: 1, y: 2, theta: 0 } })).not.toThrow();
  });

  it('register 가 마지막 프레임을 즉시 기록한다(첫 페인트 플래시 / 영구 고착 회귀)', () => {
    const writer = createTransformWriter();
    writer.write('ch1', 12.5, -3.25, Math.PI / 4);
    const el = makeG();
    writer.register('ch1', el);
    expect(el.getAttribute('transform')).toBe('translate(12.50 -3.25) rotate(45.00)');
  });

  it('writeFrame → register 순서에서도 값이 채워져 있다', () => {
    const writer = createTransformWriter();
    writer.writeFrame({ bl1: { x: 400, y: 250, theta: 0 } });
    const el = makeG();
    writer.register('bl1', el);
    expect(el.getAttribute('transform')).toBe('translate(400.00 250.00) rotate(0.00)');
  });

  it('등번호(counter) 노드에 rotate(-θ) 가 기록된다', () => {
    const writer = createTransformWriter();
    const body = makeG();
    const counter = makeG();
    writer.register('ch1', body);
    writer.registerCounter('ch1', counter);
    writer.write('ch1', 0, 0, Math.PI / 2); // 90°
    expect(body.getAttribute('transform')).toBe('translate(0.00 0.00) rotate(90.00)');
    expect(counter.getAttribute('transform')).toBe('rotate(-90.00)');
  });

  it('counter 를 write 이후에 register 해도 마지막 각도를 즉시 반영한다', () => {
    const writer = createTransformWriter();
    writer.write('ch1', 0, 0, Math.PI);
    const counter = makeG();
    writer.registerCounter('ch1', counter);
    expect(counter.getAttribute('transform')).toBe('rotate(-180.00)');
  });

  it('write 가 0.05px 미만 변화(각도 불변)에서 setAttribute 를 호출하지 않는다', () => {
    const writer = createTransformWriter();
    const el = makeG();
    writer.register('bl1', el);
    writer.write('bl1', 100, 100, 0);
    const spy = vi.spyOn(el, 'setAttribute');
    writer.write('bl1', 100.04, 100, 0); // 0.04px < EPS_PX(0.1)
    expect(spy).not.toHaveBeenCalled();
  });

  it('write 가 0.1px 이상 변화에서는 setAttribute 를 호출한다', () => {
    const writer = createTransformWriter();
    const el = makeG();
    writer.register('bl1', el);
    writer.write('bl1', 100, 100, 0);
    const spy = vi.spyOn(el, 'setAttribute');
    writer.write('bl1', 100.2, 100, 0);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('snapshot 은 write 된 값을 id 별로 복사해 반환한다', () => {
    const writer = createTransformWriter();
    writer.write('a', 1, 2, 0.5);
    writer.write('b', 3, 4, -0.5);
    expect(writer.snapshot()).toEqual({ a: { x: 1, y: 2, theta: 0.5 }, b: { x: 3, y: 4, theta: -0.5 } });
  });

  it('clear 는 등록된 노드·프레임을 모두 비운다', () => {
    const writer = createTransformWriter();
    writer.write('a', 1, 2, 0);
    writer.clear();
    expect(writer.snapshot()).toEqual({});
    const el = makeG();
    writer.register('a', el);
    expect(el.getAttribute('transform')).toBeNull(); // 지워진 프레임에는 아무 값도 없다
  });
});

/** SVG transform 문자열을 2×3 아핀 행렬 [a b c d e f] 로 만든다(이 파일이 쓰는 3종만 다룬다).
 *  jsdom 에는 DOMMatrix 도 getCTM 도 없어서 직접 곱해야 "등번호가 눕지 않는다" 를 증명할 수 있다. */
function parseTransform(s: string): number[] {
  let m = [1, 0, 0, 1, 0, 0];
  const mul = (n: number[]): void => {
    const [a, b, c, d, e, f] = m as [number, number, number, number, number, number];
    const [A, B, C, D, E, F] = n as [number, number, number, number, number, number];
    m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  };
  for (const [, fn, args] of s.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args!.trim().split(/[\s,]+/).map(Number);
    if (fn === 'translate') mul([1, 0, 0, 1, v[0]!, v[1] ?? 0]);
    else if (fn === 'rotate') {
      const r = (v[0]! * Math.PI) / 180;
      mul([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
    } else if (fn === 'scale') mul([v[0]!, 0, 0, v[1] ?? v[0]!, 0, 0]);
    else throw new Error(`모르는 transform 함수: ${fn}`);
  }
  return m;
}

describe('setHeld — §4.3 P1-1 "잡히면 칩이 판에서 뜬다"', () => {
  it('잡으면 chip--held 가 붙고 배율이 얹히며, 놓으면 둘 다 사라진다', () => {
    const writer = createTransformWriter();
    const el = makeG();
    writer.register('ch1', el);
    writer.write('ch1', 100, 50, 0);
    expect(el.getAttribute('transform')).toBe('translate(100.00 50.00) rotate(0.00)');

    writer.setHeld('ch1', true);
    expect(el.classList.contains('chip--held')).toBe(true);
    // 좌표가 한 픽셀도 안 움직였는데도 즉시 반영된다 — 잡자마자 멈춘 칩은 다음 write 가 없다.
    expect(el.getAttribute('transform')).toBe('translate(100.00 50.00) rotate(0.00) scale(1.06)');

    writer.setHeld('ch1', false);
    expect(el.classList.contains('chip--held')).toBe(false);
    expect(el.getAttribute('transform')).toBe('translate(100.00 50.00) rotate(0.00)');
  });

  it('잡고 있는 동안의 write 도 배율을 유지한다(드래그 중 매 프레임)', () => {
    const writer = createTransformWriter();
    const el = makeG();
    writer.register('ch1', el);
    writer.setHeld('ch1', true);
    writer.write('ch1', 10, 20, Math.PI / 2);
    expect(el.getAttribute('transform')).toBe('translate(10.00 20.00) rotate(90.00) scale(1.06)');
  });

  it('scale 1.06 은 등번호를 눕히지 않는다 (지켜야 할 기존 물성 §4.1)', () => {
    // 본체 transform 과 counter transform 을 실제로 곱해 선형부를 본다. 균등 배율은 회전과
    // 교환되므로 R(θ)·S·R(−θ) = S — 남는 것은 1.06 배 확대뿐이고 회전 성분은 0 이어야 한다.
    const writer = createTransformWriter();
    const body = makeG();
    const counter = makeG();
    writer.register('ch1', body);
    writer.registerCounter('ch1', counter);
    writer.setHeld('ch1', true);
    writer.write('ch1', 123, -45, 0.7); // 40.11°

    const m = parseTransform(body.getAttribute('transform')!);
    const c = parseTransform(counter.getAttribute('transform')!);
    // counter 는 본체 <g> 안쪽이므로 화면에서 등번호가 받는 것은 두 행렬의 곱이다.
    const composed = [
      m[0]! * c[0]! + m[2]! * c[1]!,
      m[1]! * c[0]! + m[3]! * c[1]!,
      m[0]! * c[2]! + m[2]! * c[3]!,
      m[1]! * c[2]! + m[3]! * c[3]!,
    ];
    expect(composed[0]).toBeCloseTo(1.06, 9); // a
    expect(composed[3]).toBeCloseTo(1.06, 9); // d
    expect(composed[1]).toBeCloseTo(0, 9); // b — 0 이 아니면 등번호가 기울었다
    expect(composed[2]).toBeCloseTo(0, 9); // c
  });

  it('부속 그룹(follower)도 같은 배율을 받는다 — 존 핸들만 제자리에 남지 않는다', () => {
    const writer = createTransformWriter();
    const body = makeG();
    const follower = makeG();
    writer.register('ch1', body);
    writer.registerFollower('ch1', follower);
    writer.write('ch1', 0, 0, 0);
    writer.setHeld('ch1', true);
    expect(follower.getAttribute('transform')).toBe(body.getAttribute('transform'));
    expect(follower.getAttribute('transform')).toContain('scale(1.06)');
  });

  it('잡힌 채 노드가 다시 마운트돼도 표시가 유지된다', () => {
    // 스텝 점프·재시드로 ObjectLayer 가 갈아엎여도 손은 여전히 칩을 잡고 있다.
    const writer = createTransformWriter();
    const first = makeG();
    writer.register('ch1', first);
    writer.write('ch1', 5, 6, 0);
    writer.setHeld('ch1', true);

    writer.register('ch1', null);
    const second = makeG();
    writer.register('ch1', second);
    expect(second.classList.contains('chip--held')).toBe(true);
    expect(second.getAttribute('transform')).toBe('translate(5.00 6.00) rotate(0.00) scale(1.06)');
  });

  it('같은 상태를 다시 부르면 DOM 을 건드리지 않는다', () => {
    const writer = createTransformWriter();
    const el = makeG();
    writer.register('ch1', el);
    writer.write('ch1', 1, 2, 0);
    writer.setHeld('ch1', true);
    const spy = vi.spyOn(el, 'setAttribute');
    writer.setHeld('ch1', true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('§6.1 규칙 1 — 잡힘 상태를 props 로 내리면 이 단언이 빨간불이 된다', () => {
    // 렌더 컴포넌트(.tsx)가 `chip--held` 라는 문자열을 알고 있다는 것은, 그 클래스가 React
    // 가 그리는 className 에서 나온다는 뜻이다 = selection/잡힘을 props 로 받았다는 뜻이다.
    // 이 클래스의 유일한 출처는 60fps transform 을 쓰는 이 층이어야 한다(a11y.css 는 소비자).
    // 텍스트 계약으로 두는 이유는 appShell.contract.test.ts 와 같다: React 배칭 때문에
    // "드래그 시작 1회 커밋" 은 props 판이든 writer 판이든 렌더 횟수가 같아, 렌더 계수기로는
    // 두 구조를 구별할 수 없다. 구별되는 것은 "누가 그 문자열을 아는가" 뿐이다.
    const files = readdirSync('src', { recursive: true, encoding: 'utf-8' })
      .filter((p) => p.endsWith('.tsx') && !p.endsWith('.test.tsx'));
    expect(files.length, 'src 아래 컴포넌트를 하나도 못 읽었다면 이 단언은 공허하다').toBeGreaterThan(20);
    const offenders = files.filter((p) => readFileSync(`src/${p}`, 'utf-8').includes('chip--held'));
    expect(offenders, '렌더 컴포넌트가 chip--held 를 직접 그리고 있다').toEqual([]);
  });

  it('clear 는 잡힘 상태도 비운다', () => {
    const writer = createTransformWriter();
    const first = makeG();
    writer.register('ch1', first);
    writer.write('ch1', 1, 2, 0);
    writer.setHeld('ch1', true);
    writer.clear();
    const second = makeG();
    writer.register('ch1', second);
    expect(second.classList.contains('chip--held')).toBe(false);
  });
});
