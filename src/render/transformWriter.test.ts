// §10.7 TransformWriter 검증. §6.2 의 blocker 회귀를 고정한다.
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
