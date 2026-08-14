import { describe, expect, it } from 'vitest';
import { TOOLS, toolForKey } from './toolDefs.ts';

describe('toolDefs', () => {
  it('§6.10 도구 11종을 레일 순서(포인터→작도→배치→주석→파괴) 그대로 담는다', () => {
    // 2026-08-14 — 작도 도형 3종이 **이동·패스 바로 뒤**에 들어왔다(기현 지시). 자리가 거기인
    // 이유는 서랍 소속이다: ToolRail 의 '작도' 서랍이 `route | pass | shape*` 로 거른다.
    expect(TOOLS.map((t) => t.id)).toEqual([
      'select',
      'route',
      'pass',
      'shapeEllipse',
      'shapeTriangle',
      'shapeRect',
      'ball',
      'cone',
      'player',
      'note',
      'erase',
    ]);
  });

  it('도형 3종만 숫자 키가 없다 — §7.5f 의 1–8 계약을 안 늘린다', () => {
    // 숫자를 주면 지우개(8)가 밀리거나 9·10 이 생긴다. 도형은 문자 키만 갖는다(o·y·u).
    const noDigit = TOOLS.filter((t) => !t.digit).map((t) => t.id);
    expect(noDigit).toEqual(['shapeEllipse', 'shapeTriangle', 'shapeRect']);
    expect(TOOLS.filter((t) => t.digit).map((t) => t.digit)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    // 그리고 빈 문자열이 도구를 여는 통로가 되면 안 된다.
    expect(toolForKey('')).toBeUndefined();
  });

  it('문자 키와 숫자 키 양쪽으로 같은 도구를 찾는다(§7.5f "1–8 / V R P B C A T E")', () => {
    expect(toolForKey('v')).toBe('select');
    expect(toolForKey('V')).toBe('select');
    expect(toolForKey('1')).toBe('select');
    expect(toolForKey('c')).toBe('cone');
    expect(toolForKey('5')).toBe('cone');
    expect(toolForKey('e')).toBe('erase');
    expect(toolForKey('8')).toBe('erase');
  });

  it('알 수 없는 키는 undefined 를 돌려준다', () => {
    expect(toolForKey('q')).toBeUndefined();
    expect(toolForKey('9')).toBeUndefined();
  });
});
