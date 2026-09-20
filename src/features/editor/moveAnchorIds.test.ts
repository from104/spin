// 이동 앵커가 언제 뜨고 무엇을 옮기는가(§6.10d, 2026-09-13 기현님 지시).
//
// 이 명단이 앵커의 **상자**와 앵커가 미는 **대상**을 한꺼번에 정한다. 지우면 새는 것 셋:
// ① 휠체어 하나에도 앵커가 떠서 물리 드래그(견인·회전·충돌)를 건너뛰는 이동이 생긴다,
// ② 잠근 것을 감싼 앵커가 떠서 눌러도 안 움직이는 버튼이 된다,
// ③ 그리는 쪽과 미는 쪽이 갈려 "감싼 것과 옮겨지는 것이 다른" 화면이 된다.
import { describe, expect, it } from 'vitest';
import { moveAnchorGuide, moveAnchorIds } from './moveAnchorIds.ts';

const set = (...ids: string[]) => new Set(ids);

describe('moveAnchorIds', () => {
  it('도형 하나·메모 하나에는 뜬다 — 겹쳐 놓으면 몸통을 못 집는 둘이다', () => {
    expect(moveAnchorIds(set('sh_1'))).toEqual(['sh_1']);
    expect(moveAnchorIds(set('nt_1'))).toEqual(['nt_1']);
  });

  // ⚠️ 2026-09-14 — 옛 단언은 화살표·획도 «안 뜬다» 였다(기현님 지시로 뒤집힘: *"선, 자유선에도
  //    적용"*). 옛 줄을 고쳐 쓰지 않고 둘로 가르는 이유는, 무엇이 뒤집혔는지가 파일에 남아야
  //    다음 사람이 «둘 다 원래 그랬나» 를 되묻지 않기 때문이다.
  it('휠체어·공·콘 **하나**에는 안 뜬다 — 그 셋은 몸통을 잡으면 물리 드래그가 열린다', () => {
    for (const id of ['ch_1', 'bl_1', 'cn_1']) {
      expect(moveAnchorIds(set(id)), id).toEqual([]);
    }
  });

  it('선(화살표)·자유선(획) 하나에도 뜬다 — 가는 선은 겹치면 오히려 더 집기 어렵다', () => {
    expect(moveAnchorIds(set('ar_1'))).toEqual(['ar_1']);
    expect(moveAnchorIds(set('fh_1'))).toEqual(['fh_1']);
  });

  it('여럿이면 종류를 가리지 않는다 — 휠체어와 메모를 같이 골라도 통째로 옮긴다', () => {
    expect(moveAnchorIds(set('ch_1', 'nt_1')).sort()).toEqual(['ch_1', 'nt_1']);
  });

  it('잠긴 것·무시된 것은 빠진다 — 눌러도 안 움직이는 것을 감싸면 고장 난 버튼이다', () => {
    expect(moveAnchorIds(set('sh_1', 'sh_2'), set('sh_2'))).toEqual(['sh_1']);
    expect(moveAnchorIds(set('sh_1', 'sh_2'), undefined, set('sh_1'))).toEqual(['sh_2']);
    expect(moveAnchorIds(set('sh_1'), set('sh_1')), '전부 잠겼으면 앵커 자체가 없다').toEqual([]);
  });

  it('걸러서 휠체어 하나만 남으면 안 뜬다 — 거른 **뒤**의 명단으로 판정한다', () => {
    expect(moveAnchorIds(set('ch_1', 'sh_1'), set('sh_1'))).toEqual([]);
  });

  it('빈 선택은 빈 명단', () => {
    expect(moveAnchorIds(set())).toEqual([]);
  });

  // 가이드 사각형의 조건 — 「상자가 몸통과 다를 때만」. 이것이 틀리면 판 위에 사각형이 하나 더
  // 늘거나(도형·메모), 여럿을 고른 사람이 앵커가 왜 거기 있는지 영영 모른다(원래 지적).
  it('가이드 사각형은 여럿·선·자유선에만 — 도형 하나·메모 하나에는 안 그린다', () => {
    expect(moveAnchorGuide(['sh_1', 'nt_1']), '여럿').toBe(true);
    expect(moveAnchorGuide(['ar_1']), '선 하나').toBe(true);
    expect(moveAnchorGuide(['fh_1']), '자유선 하나').toBe(true);
    expect(moveAnchorGuide(['sh_1']), '도형은 손잡이가 상자를 말한다').toBe(false);
    expect(moveAnchorGuide(['nt_1']), '메모는 선택 링이 칩을 감싼다').toBe(false);
    expect(moveAnchorGuide([]), '빈 선택').toBe(false);
  });
});
