import { describe, expect, it } from 'vitest';
import { TOOLS, toolForKey } from './toolDefs.ts';

describe('toolDefs', () => {
  it('§6.10 도구 10종을 레일 순서(포인터→작도→배치→주석→파괴) 그대로 담는다', () => {
    // 2026-08-14 — 작도 도형 3종이 **이동·패스 바로 뒤**에 들어왔다(기현 지시). 자리가 거기인
    // 이유는 서랍 소속이다: ToolRail 의 '작도' 서랍이 그 넷을 거른다.
    // ⚠️ 2026-08-16 — 이동·패스가 **'선' 하나로 합쳐져 11종 → 10종**이 됐다(기현 지시:
    //    *"작도에 패스, 이동이 무의미하다. 선으로 통일"*). 뜻은 도구가 아니라 양 끝 화살촉이
    //    나르므로, 그리기 전에 종류를 고를 이유가 없어졌다.
    expect(TOOLS.map((t) => t.id)).toEqual([
      'select',
      'line',
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
    // ⚠️ 2026-08-16 — **'3' 이 비었다.** 패스가 사라진 자리이고, 남은 도구를 당겨 채우지
    //    않는다: 당기면 옛 손버릇(4=공)이 전부 한 칸씩 엇나간다. 빈 숫자는 아무 도구도 안 연다.
    expect(TOOLS.filter((t) => t.digit).map((t) => t.digit)).toEqual(['1', '2', '4', '5', '6', '7', '8']);
    expect(toolForKey('3'), "'3' 이 다시 도구를 연다 — 옛 손버릇이 엉뚱한 도구를 켠다").toBeUndefined();
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
