// §6.10b "같은 것 전부 고르기" — 개체 메뉴가 내는 덩어리 선택.
//
// 이 항목이 **터치에서 유일하게 작동하는 다중 선택**이라(수식키가 없다) 여기 계약이 깨지면
// 손가락으로는 여럿 고를 길이 통째로 없어진다.
import { describe, expect, it } from 'vitest';
import { sameKindGroup, type SameKindScene } from './selectSame.ts';

function scene(over: Partial<SameKindScene> = {}): SameKindScene {
  return {
    chairs: [
      { id: 'ch_h1', team: 'home' },
      { id: 'ch_h2', team: 'home' },
      { id: 'ch_a1', team: 'away' },
    ],
    balls: ['bl_1', 'bl_2'],
    cones: ['cn_1', 'cn_2', 'cn_3'],
    notes: ['nt_1'],
    arrows: ['ar_1', 'ar_2'],
    shapes: ['sh_1', 'sh_2'],
    strokes: ['fh_1', 'fh_2'],
    locked: new Set<string>(),
    ...over,
  };
}

describe('sameKindGroup — 무엇이 "같은 것" 인가', () => {
  it('휠체어는 **같은 팀**끼리다 — 판 위의 모든 칩이 아니다', () => {
    const g = sameKindGroup('ch_h1', scene(), 'ko');
    expect(g?.ids).toEqual(['ch_h1', 'ch_h2']);
    expect(g?.label).toBe('같은 팀 전부 고르기');
  });

  it('상대 팀을 짚으면 상대 팀이 나온다 — 짚은 것이 기준이다', () => {
    // away 는 하나뿐이라 '전부' 라고 부를 것이 없다 → 항목 자체가 안 나온다(아래 계약).
    const g = sameKindGroup('ch_a1', scene({ chairs: [
      { id: 'ch_h1', team: 'home' },
      { id: 'ch_a1', team: 'away' },
      { id: 'ch_a2', team: 'away' },
    ] }), 'ko');
    expect(g?.ids).toEqual(['ch_a1', 'ch_a2']);
  });

  it.each([
    ['bl_1', '공 전부 고르기', 2],
    ['cn_1', '콘 전부 고르기', 3],
    ['ar_1', '화살표 전부 고르기', 2],
    ['sh_1', '도형 전부 고르기', 2],
  ])('%s → %s', (id, label, count) => {
    const g = sameKindGroup(id, scene(), 'ko');
    expect(g?.label).toBe(label);
    expect(g?.ids).toHaveLength(count);
  });

  // 콘은 2색이지만 색으로 안 가른다 — 색의 뜻이 판마다 다르기 때문이다(§6.10b '안 고른 길').
  it('콘은 색을 안 가린다 — 판 위의 콘 전부가 한 덩어리다', () => {
    expect(sameKindGroup('cn_3', scene(), 'ko')?.ids).toEqual(['cn_1', 'cn_2', 'cn_3']);
  });

  it('혼자뿐이면 null — 눌러도 아무 일 없는 항목은 안 낸다', () => {
    expect(sameKindGroup('nt_1', scene(), 'ko')).toBeNull();
  });

  it('판에 없는 id 는 null — 메뉴가 유령 명단을 만들지 않는다', () => {
    expect(sameKindGroup('ch_none', scene(), 'ko')).toBeNull();
    expect(sameKindGroup('zz_1', scene(), 'ko')).toBeNull();
  });

  // ★ 잠긴 개체는 덩어리로 안 집힌다(고무줄·Ctrl+A 와 같은 규칙). 못 움직이는 것이 섞이면
  //   뒤이은 드래그가 통째로 안 먹는데, 터치에는 그 하나를 빼는 손짓이 없다.
  it('잠긴 것은 빠진다', () => {
    const g = sameKindGroup('cn_1', scene({ locked: new Set(['cn_2']) }), 'ko');
    expect(g?.ids).toEqual(['cn_1', 'cn_3']);
  });

  it('잠긴 것을 빼고 나서 혼자 남으면 null 이다', () => {
    expect(sameKindGroup('bl_1', scene({ locked: new Set(['bl_2']) }), 'ko')).toBeNull();
  });

  it('짚은 것 자신이 잠겨 있어도 명단에서 빠진다 — 규칙에 예외를 두지 않는다', () => {
    const g = sameKindGroup('cn_1', scene({ locked: new Set(['cn_1']) }), 'ko');
    expect(g?.ids).toEqual(['cn_2', 'cn_3']);
  });
});
