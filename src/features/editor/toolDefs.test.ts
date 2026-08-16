import { describe, expect, it } from 'vitest';
import { TOOLS, toolForAction } from './toolDefs.ts';

describe('toolDefs', () => {
  it('§6.10 도구 9종을 레일 순서(포인터→작도→배치→주석) 그대로 담는다', () => {
    // 2026-08-14 — 작도 도형 3종이 **이동·패스 바로 뒤**에 들어왔다(기현 지시). 자리가 거기인
    // 이유는 서랍 소속이다: ToolRail 의 '작도' 서랍이 그 넷을 거른다.
    // ⚠️ 2026-08-16 — 이동·패스가 **'선' 하나로 합쳐져 11종 → 10종**이 됐다(기현 지시:
    //    *"작도에 패스, 이동이 무의미하다. 선으로 통일"*). 뜻은 도구가 아니라 양 끝 화살촉이
    //    나르므로, 그리기 전에 종류를 고를 이유가 없어졌다.
    // ⚠️ 2026-08-16(2차) — **지우개가 사라져 10종 → 9종**이다. 레일 끝의 '파괴' 구간이
    //    통째로 없어졌고, 삭제는 선택 후 Delete 하나로 모였다(기현 지시).
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
    ]);
  });

  it('단축키 글자는 keymap 에서 온다 — 이 파일은 키를 정하지 않는다', () => {
    // 2026-08-16 전면 개편. 영어 머릿글자가 원칙이고, 막힌 둘만 예외다:
    //   · 선택 → V (select 의 s·e 는 개체 조작이, l·c·t 는 다른 도구가 씀. 피그마 관습)
    //   · 원   → O (circle 의 c 를 콘에 내주고 oval 로 봄)
    expect(TOOLS.map((t) => [t.id, t.key])).toEqual([
      ['select', 'V'],
      ['line', 'L'],
      ['shapeEllipse', 'O'],
      ['shapeTriangle', 'T'],
      ['shapeRect', 'R'],
      ['ball', 'B'],
      ['cone', 'C'],
      ['player', 'P'],
      ['note', 'N'],
    ]);
  });

  it('W A S D · Q E 를 쓰는 도구가 없다 — 그 여섯은 개체 조작 자리다', () => {
    const reserved = new Set(['W', 'A', 'S', 'D', 'Q', 'E']);
    expect(TOOLS.filter((t) => reserved.has(t.key)).map((t) => t.id)).toEqual([]);
  });

  it('숫자 키로는 도구를 못 연다 — 숫자 체계를 폐지했다', () => {
    // 개편 전에는 1–8 이 있었고 도형 3종만 숫자가 없는 반쪽짜리였다. 문자 하나로 통일했다.
    for (const d of ['1', '2', '3', '8', 'Digit1', 'Digit8']) {
      expect(toolForAction(`tool:${d}`), `${d} 가 도구를 연다`).toBeUndefined();
    }
  });

  it('toolForAction 은 도구 동작만 되짚는다', () => {
    expect(toolForAction('tool:cone')).toBe('cone');
    expect(toolForAction('tool:select')).toBe('select');
    // 표에 없는 도구 id 는 안 받는다 — 오타가 조용히 도구를 여는 통로가 되면 안 된다.
    expect(toolForAction('tool:nope')).toBeUndefined();
    // 도구가 아닌 동작은 통과시키지 않는다.
    expect(toolForAction('view.grid')).toBeUndefined();
    expect(toolForAction('play.toggle')).toBeUndefined();
    expect(toolForAction('')).toBeUndefined();
  });
});
