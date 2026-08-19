// §6.10c 트레이 드롭 예고 — **놓기 전에 무슨 일이 날지** 말하는가.
//
// > 2026-08-16 기현 지시: *"객체 선택 후 트레이로 끌고가면 빠지거나 지울 수 있는데 시각적
// > 효과를 직관적으로 만들어줘."*
//
// 여기서 재는 것 둘:
//   ① 예고의 **내용**이 치우기의 실제 결과와 같은가(빼기/삭제/섞임) — 다르면 그 예고는
//      거짓말이고, 거짓 예고는 없느니만 못하다.
//   ② 덮개가 **반드시 꺼지는가** — 켜진 채 남으면 트레이가 통째로 가려진다.
import { describe, expect, it, beforeEach } from 'vitest';
import { trayDropHint, trayDropIntent } from './trayDrop.ts';

describe('trayDropIntent — 무엇이 될 것인가', () => {
  // 칩·공·콘은 트레이에 자리가 남아 있어 다시 꺼낼 수 있다(removal.ts). 그것이 '빼기' 다.
  it('전부 돌아갈 자리가 있으면 take', () => {
    expect(trayDropIntent(['ch_1'], 'ko')).toEqual({ kind: 'take', label: '빼기' });
    expect(trayDropIntent(['ch_1', 'bl_1', 'cn_1'], 'ko')).toEqual({ kind: 'take', label: '3개 빼기' });
  });

  it('돌아갈 자리가 없으면 erase', () => {
    expect(trayDropIntent(['nt_1'], 'ko')).toEqual({ kind: 'erase', label: '삭제' });
    expect(trayDropIntent(['ar_1', 'sh_1'], 'ko')).toEqual({ kind: 'erase', label: '2개 삭제' });
  });

  // ★ 고무줄로 칩과 메모를 함께 잡을 수 있으므로(§6.10b) 이 경우는 실제로 생긴다.
  //   한쪽 말로 뭉뚱그리면 둘 중 하나가 거짓이 된다 — 그래서 글자에 양쪽을 다 적는다.
  it('섞였으면 mixed 이고 글자에 양쪽이 다 적힌다', () => {
    expect(trayDropIntent(['ch_1', 'ch_2', 'nt_1'], 'ko')).toEqual({ kind: 'mixed', label: '2개 빼기 · 1개 삭제' });
  });

  it('빈 명단이면 예고할 것이 없다', () => {
    expect(trayDropIntent([], 'ko')).toBeNull();
  });

  // 개체 메뉴의 마지막 항목과 **같은 함수**에서 나온다. 여기서 갈리면 "빼기라고 예고하고
  // 삭제했습니다" 가 난다 — 그 어긋남이 removal.ts 를 한 곳으로 모은 이유다.
  it('글자는 메뉴·토스트와 같은 술어를 쓴다 — 하나일 때는 개수를 안 센다', () => {
    expect(trayDropIntent(['ch_1'], 'ko')!.label).not.toContain('1개');
  });
});

describe('trayDropHint — 덮개를 켜고 끈다', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav data-tray=""><div data-tray-hint=""></div><button>공</button></nav>';
  });

  const tray = () => document.querySelector<HTMLElement>('[data-tray]')!;
  const hint = () => document.querySelector<HTMLElement>('[data-tray-hint]')!;

  it('켜면 종류가 속성으로, 결과가 글자로 나온다', () => {
    trayDropHint.arm(trayDropIntent(['ch_1', 'ch_2'], 'ko'), 'ko');
    expect(tray().getAttribute('data-drop')).toBe('take');
    // "놓으면" 이 빠지면 이미 지워졌다고 읽힌다 — 예고와 결과는 다른 말이어야 한다.
    expect(hint().textContent).toBe('놓으면 2개 빼기');
  });

  it('삭제는 다른 종류로 나온다 — 색이 갈리는 축이다', () => {
    trayDropHint.arm(trayDropIntent(['nt_1'], 'ko'), 'ko');
    expect(tray().getAttribute('data-drop')).toBe('erase');
  });

  // ★ 이것이 깨지면 덮개가 트레이를 영구히 가린다 — 화면이 통째로 죽는 형태의 고장이다.
  it('끄면 속성도 글자도 남지 않는다', () => {
    trayDropHint.arm(trayDropIntent(['ch_1'], 'ko'), 'ko');
    trayDropHint.arm(null, 'ko');
    expect(tray().hasAttribute('data-drop')).toBe(false);
    expect(hint().textContent).toBe('');
  });

  it('트레이가 없는 화면에서는 아무 일도 안 한다 — 던지지 않는다', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => trayDropHint.arm(trayDropIntent(['ch_1'], 'ko'), 'ko')).not.toThrow();
    expect(() => trayDropHint.arm(null, 'ko')).not.toThrow();
  });
});
