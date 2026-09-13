// 이동 앵커가 언제 뜨고 무엇을 옮기는가(§6.10d, 2026-09-13 기현님 지시).
//
// 이 명단이 앵커의 **상자**와 앵커가 미는 **대상**을 한꺼번에 정한다. 지우면 새는 것 셋:
// ① 휠체어 하나에도 앵커가 떠서 물리 드래그(견인·회전·충돌)를 건너뛰는 이동이 생긴다,
// ② 잠근 것을 감싼 앵커가 떠서 눌러도 안 움직이는 버튼이 된다,
// ③ 그리는 쪽과 미는 쪽이 갈려 "감싼 것과 옮겨지는 것이 다른" 화면이 된다.
import { describe, expect, it } from 'vitest';
import { moveAnchorIds } from './moveAnchorIds.ts';

const set = (...ids: string[]) => new Set(ids);

describe('moveAnchorIds', () => {
  it('도형 하나·메모 하나에는 뜬다 — 겹쳐 놓으면 몸통을 못 집는 둘이다', () => {
    expect(moveAnchorIds(set('sh_1'))).toEqual(['sh_1']);
    expect(moveAnchorIds(set('nt_1'))).toEqual(['nt_1']);
  });

  it('휠체어·공·콘·화살표·획 **하나**에는 안 뜬다 — 그쪽은 몸통을 잡으면 제 회로가 열린다', () => {
    for (const id of ['ch_1', 'bl_1', 'cn_1', 'ar_1', 'fh_1']) {
      expect(moveAnchorIds(set(id)), id).toEqual([]);
    }
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
});
