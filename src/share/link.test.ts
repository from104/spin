// 링크 파싱의 회귀선. 지우면 새는 것:
//  ① 세 꼴 중 하나라도 못 받으면 사람이 메신저에서 복사한 것을 그대로 붙여넣지 못한다
//     (결정 6 — 어느 부분이 링크인지 사용자가 골라 내게 하지 않는다).
//  ② 잘린 열쇠(42자)를 통과시키면 서버를 부르고, 복호에서 실패하고, 사용자는 "링크 없음" 과
//     "열쇠 안 맞음" 중 엉뚱한 문구를 본다. 길이 판정이 그 갈림의 유일한 근거다.
import { describe, expect, it } from 'vitest';
import { buildShareLink, parseShareLink } from './link.ts';

const KEY = 'A'.repeat(43);
const ID = 'AbC0123xyZ';

describe('link — 만들기', () => {
  it('열쇠는 프래그먼트에 실린다 — `#` 뒤는 서버로 가지 않는다', () => {
    expect(buildShareLink('https://spin.atit.app', ID, KEY)).toBe(`https://spin.atit.app/s/${ID}#${KEY}`);
  });

  it('origin 뒤 슬래시가 `//s/` 를 만들지 않는다', () => {
    expect(buildShareLink('https://spin.atit.app/', ID, KEY)).toBe(`https://spin.atit.app/s/${ID}#${KEY}`);
  });
});

describe('link — 읽기(세 꼴)', () => {
  it('전체 URL·경로만·알맹이만 을 모두 받는다', () => {
    const want = { id: ID, keyB64: KEY };
    expect(parseShareLink(`https://spin.atit.app/s/${ID}#${KEY}`)).toEqual(want);
    expect(parseShareLink(`/s/${ID}#${KEY}`)).toEqual(want);
    expect(parseShareLink(`${ID}#${KEY}`)).toEqual(want);
  });

  it('붙여넣기가 흔히 싣고 오는 것들을 견딘다 — 앞뒤 공백·언어 접두사·추적 쿼리·뒤 슬래시', () => {
    const want = { id: ID, keyB64: KEY };
    expect(parseShareLink(`  https://spin.atit.app/s/${ID}#${KEY}  `)).toEqual(want);
    expect(parseShareLink(`https://spin.atit.app/en/s/${ID}#${KEY}`)).toEqual(want);
    expect(parseShareLink(`https://spin.atit.app/s/${ID}?utm=kakao#${KEY}`)).toEqual(want);
    expect(parseShareLink(`https://spin.atit.app/s/${ID}/#${KEY}`)).toEqual(want);
  });

  it('잘린 열쇠(42자)는 링크가 아니다 — 여기서 끊어야 문구가 갈린다', () => {
    expect(parseShareLink(`https://spin.atit.app/s/${ID}#${'A'.repeat(42)}`)).toBeNull();
    expect(parseShareLink(`https://spin.atit.app/s/${ID}#${'A'.repeat(44)}`)).toBeNull();
    expect(parseShareLink(`https://spin.atit.app/s/${ID}#${'A'.repeat(42)}=`)).toBeNull(); // 패딩은 안 쓴다
  });

  it('열쇠가 없거나 id 꼴이 아니면 null 이다', () => {
    expect(parseShareLink(`https://spin.atit.app/s/${ID}`)).toBeNull();
    expect(parseShareLink(`https://spin.atit.app/s/short#${KEY}`)).toBeNull();
    expect(parseShareLink(`https://spin.atit.app/drills/${ID}#${KEY}`)).toBeNull(); // /s/ 가 아니다
    expect(parseShareLink(`${ID}`)).toBeNull();
  });
});
