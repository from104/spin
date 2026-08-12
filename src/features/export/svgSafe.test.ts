// 4.4 — 손으로 문자열을 잇는 SVG 조립부의 안전장치. 여기가 뚫리면 내보낸 그림이 통째로
// 다른 문서가 되거나(색·id 이스케이프), 개체 하나가 소리 없이 사라진다(NaN 좌표).
import { describe, expect, it } from 'vitest';
import { num, safeColor, safeId } from './svgSafe.ts';

describe('safeColor', () => {
  it.each(['#fff', '#ffffff', '#ffffff80', 'rgba(255,255,255,.92)', 'rgb(31, 122, 70)', 'white'])('통과: %s', (c) => {
    expect(safeColor(c, '#000000')).toBe(c);
  });

  it.each(['#fff" onload="x', 'url(javascript:1)', '"><script/>', '', '   ', '#12345g'])('차단: %j', (c) => {
    expect(safeColor(c, '#000000')).toBe('#000000');
  });

  it('undefined 는 기본값이다 (모델에서 색은 optional 이다)', () => {
    expect(safeColor(undefined, '#d93a3a')).toBe('#d93a3a');
  });

  it('던지지 않는다 — 색 하나 때문에 내보내기가 통째로 실패하면 안 된다', () => {
    expect(() => safeColor('<<<', '#000000')).not.toThrow();
  });
});

describe('safeId', () => {
  it('실제 id(§3.1 접두 2자 + _ + base36)는 원형 그대로 남는다', () => {
    expect(safeId('ch_m9x2a01abcd')).toBe('ch_m9x2a01abcd');
    expect(safeId('ar_0000000000z')).toBe('ar_0000000000z');
  });

  it('속성을 깨뜨릴 문자는 잘려 나간다', () => {
    expect(safeId('bl_1"/><g x="')).toBe('bl_1gx');
    expect(safeId('a b\nc')).toBe('abc');
  });
});

describe('num', () => {
  it('소수점 둘째 자리에서 반올림한다 (data URI 길이를 줄인다)', () => {
    expect(num(37.5)).toBe('37.5');
    expect(num(1 / 3)).toBe('0.33');
    expect(num(-7.499)).toBe('-7.5');
  });

  it('NaN·Infinity 는 0 으로 접는다 — 속성이 무효가 되면 그 개체가 통째로 안 보인다', () => {
    expect(num(NaN)).toBe('0');
    expect(num(Infinity)).toBe('0');
    expect(num(-Infinity)).toBe('0');
    // 대조군: 정상 0 과 구분되지는 않지만, "안 보이는 개체" 보다 "원점의 개체" 가 낫다.
    expect(num(0)).toBe('0');
  });
});
