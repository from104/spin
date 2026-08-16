// 키맵이 **스스로 모순을 못 갖게** 하는 계약. 개편 전에는 정의가 네 파일에 흩어져 있어서
// 같은 키가 두 곳에서 잡히는지를 사람이 눈으로 세야 했다.
//
// 여기서 재는 것은 "무슨 키가 무슨 일을 하는가" 가 아니다 — 그건 각 디스패처의 테스트다.
// 여기서 재는 것은 **표 자체가 성립하는가**: 한 키가 한 층에서 두 뜻을 갖지 않는가,
// 층 사이에서 서로를 삼키지 않는가, 도구 목록과 어긋나지 않는가.
import { describe, it, expect } from 'vitest';
import { KEYMAP, TOOL_KEY_PREFIX, lookupKey, matchesKey, helpRows, toolHelpRow, type KeyScope } from './keymap.ts';

/** 표에 등장하는 모든 code × 수식키 8가지. 이 곱집합이 곧 키보드로 만들 수 있는 사건 전부다
 *  (표에 없는 code 는 어차피 아무 정의도 안 잡으므로 셀 필요가 없다). */
const ALL_EVENTS = (() => {
  const codes = [...new Set(KEYMAP.flatMap((d) => d.codes))].sort();
  const out: Array<{ code: string; ctrlKey: boolean; metaKey: false; altKey: boolean; shiftKey: boolean }> = [];
  for (const code of codes) {
    for (const ctrlKey of [false, true]) {
      for (const altKey of [false, true]) {
        for (const shiftKey of [false, true]) {
          out.push({ code, ctrlKey, metaKey: false, altKey, shiftKey });
        }
      }
    }
  }
  return out;
})();

const describeEvent = (e: (typeof ALL_EVENTS)[number]): string =>
  [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.code].filter(Boolean).join('+');

const idsMatching = (scope: KeyScope, e: (typeof ALL_EVENTS)[number]): string[] => [
  ...new Set(KEYMAP.filter((d) => d.scope === scope && matchesKey(d, e)).map((d) => d.id)),
];

describe('키맵 — 한 층 안에서 한 키는 한 뜻이다', () => {
  for (const scope of ['global', 'object', 'present'] as const) {
    it(`${scope} 층에 겹치는 정의가 없다`, () => {
      const clashes = ALL_EVENTS.map((e) => ({ e, ids: idsMatching(scope, e) }))
        .filter((r) => r.ids.length > 1)
        .map((r) => `${describeEvent(r.e)} → ${r.ids.join(' · ')}`);
      // 같은 id 를 여러 정의가 갖는 것은 **별칭**이라 괜찮다(redo 의 Shift+Z 와 Y).
      // 걸리는 것은 서로 다른 id 가 같은 사건을 물 때뿐이다.
      expect(clashes, '한 키가 두 동작을 켠다').toEqual([]);
    });
  }
});

describe('키맵 — 전역과 개체가 서로를 삼키지 않는다', () => {
  // 개체 키는 EditorStage 가 stopPropagation 으로 먼저 먹는다. 그래서 전역 키와 겹치면
  // **개체를 고른 순간 그 전역 키가 사라진다**. 개편 전 Ctrl+방향키(판 이동)가 딱 그랬고,
  // 그래서 코드에 "수식키를 그냥 흘려보내라" 는 예외 주석이 붙어 있었다.
  // 겹침이 0이면 그 예외 자체가 필요 없어진다 — 여기가 그것을 지킨다.
  it('같은 사건을 전역과 개체가 동시에 물지 않는다', () => {
    const both = ALL_EVENTS.filter(
      (e) => idsMatching('global', e).length > 0 && idsMatching('object', e).length > 0,
    ).map((e) => `${describeEvent(e)} → 전역 ${idsMatching('global', e)} / 개체 ${idsMatching('object', e)}`);
    expect(both, '개체에 포커스가 있으면 이 전역 키가 죽는다').toEqual([]);
  });
});

describe('키맵 — WCAG 2.1.4 층 가르기', () => {
  // DESIGN §7.5f 가 Level A 준수를 못 박았다. 개체 키는 "포커스가 있을 때만" 예외로 사는데,
  // 그 예외는 **전역이 아니라는 사실**에서만 나온다. 개체 키가 하나라도 전역으로 올라가면
  // 문자키 게이트 없이 단일 문자 단축키가 전역에 생기는 것이라 준수가 깨진다.
  it('개체 층 문자키는 letterKey 로 표시하지 않는다 — 게이트 대상이 아니다', () => {
    const flagged = KEYMAP.filter((d) => d.scope === 'object' && d.letterKey).map((d) => d.id);
    expect(flagged).toEqual([]);
  });

  it('수식키 없는 전역 문자키는 전부 letterKey 로 표시돼 있다', () => {
    const missing = KEYMAP.filter(
      (d) =>
        d.scope === 'global' &&
        !d.mod &&
        !d.alt &&
        (d.shift ?? 'no') === 'no' &&
        d.codes.every((c) => /^Key[A-Z]$/.test(c)) &&
        !d.letterKey,
    ).map((d) => d.id);
    expect(missing, '게이트를 안 타는 전역 단일 문자키가 있다').toEqual([]);
  });

  it('개체 조작은 W A S D · Q E · [ ] · Delete 뿐이다 — 이 목록이 곧 포커스 한정 면제 범위다', () => {
    const codes = [...new Set(KEYMAP.filter((d) => d.scope === 'object').flatMap((d) => d.codes))].sort();
    expect(codes).toEqual([
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'Backspace',
      'BracketLeft',
      'BracketRight',
      'Delete',
      'Enter',
      'KeyA',
      'KeyD',
      'KeyE',
      'KeyQ',
      'KeyS',
      'KeyW',
    ]);
  });
});

describe('키맵 — code 를 쓴다(key 가 아니다)', () => {
  // 한글 입력 상태에서 문자 단축키가 통째로 죽던 원인이 `e.key` 였다. 표에 'v' 같은 **문자**가
  // 들어오면 그 순간 다시 입력기에 의존하게 된다 — code 는 언제나 'KeyV' 꼴이다.
  it('모든 code 가 KeyboardEvent.code 표기법이다', () => {
    const bad = KEYMAP.flatMap((d) => d.codes).filter((c) => !/^([A-Z][A-Za-z0-9]*)$/.test(c) || c.length === 1);
    expect(bad, 'code 가 아니라 key 문자가 섞였다').toEqual([]);
  });
});

describe('키맵 — 도구', () => {
  it('도구 9종이 전부 자기 키를 갖는다', () => {
    const tools = KEYMAP.filter((d) => d.id.startsWith(TOOL_KEY_PREFIX)).map((d) => d.id.slice(TOOL_KEY_PREFIX.length));
    expect(tools).toEqual([
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

  it('지우개에는 키가 없다 — Delete 로 일원화했다', () => {
    expect(KEYMAP.some((d) => d.id === `${TOOL_KEY_PREFIX}erase`)).toBe(false);
  });

  it('숫자키로 도구를 고르지 않는다', () => {
    const digits = KEYMAP.filter((d) => d.id.startsWith(TOOL_KEY_PREFIX)).flatMap((d) => d.codes).filter((c) => c.startsWith('Digit'));
    expect(digits).toEqual([]);
  });
});

describe('lookupKey', () => {
  it('층이 다르면 안 잡힌다', () => {
    const space = { code: 'Space', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
    expect(lookupKey('global', space)).toBe('play.toggle');
    expect(lookupKey('object', space)).toBeUndefined();
  });

  it('Shift 가 정도만 바꾸는 키는 Shift 유무 둘 다 같은 동작이다', () => {
    const w = (shiftKey: boolean) => ({ code: 'KeyW', ctrlKey: false, metaKey: false, altKey: false, shiftKey });
    expect(lookupKey('object', w(false))).toBe('obj.move');
    expect(lookupKey('object', w(true))).toBe('obj.move');
  });

  it('지정하지 않은 수식키가 눌리면 안 잡힌다 — Ctrl+S 가 개체를 내리지 않는다', () => {
    const ctrlS = { code: 'KeyS', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
    expect(lookupKey('object', ctrlS)).toBeUndefined();
    expect(lookupKey('global', ctrlS)).toBe('edit.save');
  });

  it('⌘ 도 Ctrl 과 같게 잡힌다', () => {
    const cmdZ = { code: 'KeyZ', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false };
    expect(lookupKey('global', cmdZ)).toBe('edit.undo');
  });
});

describe('도움말은 표에서 나온다', () => {
  it('스텝이 없는 화면에서는 스텝 키가 빠진다', () => {
    const withSteps = helpRows('global', { steps: true }).map(([, d]) => d);
    const without = helpRows('global', { steps: false }).map(([, d]) => d);
    expect(withSteps).toContain('다음 스텝');
    expect(without).not.toContain('다음 스텝');
    // 전술판은 1장짜리라 재생할 구간도 복제할 스텝도 없다.
    expect(without).not.toContain('재생 / 일시정지');
    expect(without).not.toContain('현재 스텝 복제');
  });

  it('도구 9종은 표에 흩어지지 않고 한 줄로 접힌다', () => {
    expect(helpRows('global', { steps: true }).some(([k]) => k === 'V')).toBe(false);
    expect(toolHelpRow()).toEqual(['V L O T R B C P N', '도구 선택']);
  });

  it('같은 동작의 별칭은 한 줄로만 나온다', () => {
    const redo = helpRows('global', { steps: true }).filter(([, d]) => d === '다시 실행');
    // Shift+Z 와 Ctrl+Y 는 표기가 다르니 두 줄이 맞다 — 완전히 같은 줄만 접힌다.
    expect(redo.length).toBe(2);
    expect(new Set(redo.map(([k]) => k)).size).toBe(2);
  });
});
