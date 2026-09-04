// 이 판정이 틀리면 **안 띄워야 할 사람에게 안내가 매번 뜬다.** 특히 세 번째 표본(300% 확대한
// 데스크톱)이 이 파일의 존재 이유다 — 확대하면 `screen.width` 가 CSS px 로 줄어 노트북이 폰처럼
// 보고되므로, coarse 가드가 빠지는 순간 저시력 사용자가 앱을 열 때마다 "작은 기기입니다" 를 본다.
// 문안·모달 구조는 안 본다(변경 감지기다). 여기서 재는 것은 **판정 넷**뿐이다.
import { describe, expect, it } from 'vitest';
import { isSmallDevice } from './smallScreen.ts';

describe('작은 기기 판정', () => {
  it('폰은 가로로 눕혀도 같은 답이다 — 짧은 변만 보므로', () => {
    expect(isSmallDevice({ width: 440, height: 956, coarse: true })).toBe(true);
    expect(isSmallDevice({ width: 956, height: 440, coarse: true })).toBe(true);
  });

  // ★ 문턱을 상수에서 import 하지 않고 숫자로 적는다 — 상수를 그대로 쓰면 문턱이 601 로
  // 밀려도 검사표가 같이 밀려 따라가 버려서(자기증명) 경계가 안 잡힌다. 600 은 계획서 §6 이
  // 사용자에게 약속한 "7인치" 그 자체다.
  it('7인치(600×960)는 경계 밖이다 — "7인치 미만" 이므로 600 은 작은 기기가 아니다', () => {
    expect(isSmallDevice({ width: 600, height: 960, coarse: true })).toBe(false);
    expect(isSmallDevice({ width: 599, height: 960, coarse: true })).toBe(true);
  });

  it('확대한 데스크톱은 화면이 작게 보고돼도 안 걸린다 — coarse 가 아니므로', () => {
    expect(isSmallDevice({ width: 427, height: 240, coarse: false })).toBe(false);
  });

  it('큰 태블릿은 손가락으로 써도 안 걸린다', () => {
    expect(isSmallDevice({ width: 768, height: 1024, coarse: true })).toBe(false);
  });
});
