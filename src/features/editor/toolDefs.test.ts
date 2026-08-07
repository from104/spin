import { describe, expect, it } from 'vitest';
import { TOOLS, toolForKey } from './toolDefs.ts';

describe('toolDefs', () => {
  it('§6.10 도구 8종을 레일 순서(포인터→작도→배치→주석→파괴) 그대로 담는다', () => {
    expect(TOOLS.map((t) => t.id)).toEqual(['select', 'route', 'pass', 'ball', 'cone', 'player', 'note', 'erase']);
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
