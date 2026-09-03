import { describe, expect, it } from 'vitest';
import { TOOLS, toolForAction } from './toolDefs.ts';

describe('toolDefs', () => {
  it('§6.10 도구 10종을 레일 순서(포인터→작도→배치→주석→파괴) 그대로 담는다', () => {
    // 2026-08-14 — 작도 도형 3종이 **이동·패스 바로 뒤**에 들어왔다(기현 지시). 자리가 거기인
    // 이유는 서랍 소속이다: ToolRail 의 '작도' 서랍이 그 넷을 거른다.
    // ⚠️ 2026-08-16 — 이동·패스가 **'선' 하나로 합쳐져 11종 → 10종**이 됐다(기현 지시:
    //    *"작도에 패스, 이동이 무의미하다. 선으로 통일"*). 뜻은 도구가 아니라 양 끝 화살촉이
    //    나르므로, 그리기 전에 종류를 고를 이유가 없어졌다.
    // ⚠️ 2026-08-16(2차) — **지우개가 사라져 10종 → 9종**이다. 레일 끝의 '파괴' 구간이
    //    통째로 없어졌고, 삭제는 선택 후 Delete 하나로 모였다(기현 지시).
    // 🔁 2026-09-03 — **지우기가 돌아와 다시 10종**이고, 레일 끝의 '파괴' 구간도 돌아왔다
    //    (이 파일 머리말의 순서 문구가 다시 참이 된다). 옛것과 같은 이름이지만 같은 물건이
    //    아니다 — 뒤집기 근거는 toolDefs.ts 의 그 문단이 쥔다. 목록은 파생식으로 바꾸지 않고
    //    **새 값을 그대로 적는다**: 코드에서 계산해 만든 목록으로 코드를 검사하면 무엇을
    //    넣든 초록이라, 이 it 이 잡아야 하는 사고(순서가 조용히 바뀜)를 못 잡는다.
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
      'eraser',
    ]);
  });

  it('단축키 글자는 keymap 에서 온다 — 이 파일은 키를 정하지 않는다', () => {
    // 2026-08-16 전면 개편. 영어 머릿글자가 원칙이고, 막힌 둘만 예외다:
    //   · 선택 → V (select 의 s·e 는 개체 조작이, l·c·t 는 다른 도구가 씀. 피그마 관습)
    //   · 원   → O (circle 의 c 를 콘에 내주고 oval 로 봄)
    // 🔁 2026-09-03 — 셋째 예외가 생겼다:
    //   · 지우기 → X (erase 의 e·r·a·s 가 전부 막혀 **머릿글자를 아예 놓았다**. 근거는
    //     화면의 그림이다 — 커서가 붉은 X 이고 버튼 아이콘도 X 다. keymap.ts 의 그 줄)
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
      ['eraser', 'X'],
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
