// §5.6 — **계약 테스트의 도구 자체를 시험한다.**
// 이 저장소가 겪은 헛통과 4형태 중 "성질이 함수 뒤에 숨는다" 를 여기서 막는다: 파서가 조용히
// 망가지면(예: 짝 안 맞는 `}` 를 만나 파일 끝까지 반환) contrast.test.ts 의 `toContain` 단언이
// **전부 통과**한다. 그래서 파서에 직접 단언을 건다.
import { describe, expect, it } from 'vitest';
import { blockOf, blocksOf, declarations, declarationsOf, stripCssComments } from './cssContract.ts';

describe('stripCssComments', () => {
  it('규칙을 인용한 주석이 블록으로 잡히지 않는다', () => {
    // 주석 안에서 규칙을 **인용**하는 형태(이 저장소의 주석은 거의 다 이렇다).
    const css = '/* 옛 값은 이랬다; .a { color: red } 였다 */ .a { color: blue }';
    expect(blockOf(stripCssComments(css), '.a')).toBe(' color: blue ');
    // 대조군: 주석을 안 걷어내면 주석 안의 가짜 규칙이 먼저 걸린다(print.test.ts 가 실제로 겪었다).
    expect(blockOf(css, '.a')).toBe(' color: red ');
  });
});

describe('blocksOf — 중괄호를 세어 자른다', () => {
  it('중첩 블록을 통째로 돌려준다(첫 닫는 괄호에서 안 잘린다)', () => {
    const css = '@media print { @page { margin: 1cm } .a { color: red } } .b { color: blue }';
    const body = blockOf(css, '@media print');
    expect(body).toContain('@page');
    expect(body).toContain('.a');
    expect(body).not.toContain('.b'); // 대조군: 블록 밖까지 삼키지 않는다
  });

  it('같은 head 가 여러 번이면 등장 순서대로 전부 돌려준다', () => {
    const css = ':root { --a: 1 } .x { } :root { --b: 2 }';
    expect(blocksOf(css, ':root')).toHaveLength(2);
  });

  it('접두가 같은 다른 셀렉터에 걸리지 않는다', () => {
    const css = '.rule-zone-x { a: 1 } .rule-zone { b: 2 }';
    expect(declarations(blockOf(css, '.rule-zone')!)).toEqual({ b: '2' });
  });

  it(':root 로 :root[data-theme="light"] 를 낚지 않는다', () => {
    const css = ':root[data-theme="light"] { --a: 1 }';
    expect(blocksOf(css, ':root')).toEqual([]);
  });

  it('없는 head 는 null / 빈 배열이다 (조용히 빈 문자열을 돌려주지 않는다)', () => {
    expect(blockOf('.a { }', '@media (forced-colors: active)')).toBeNull();
    expect(blocksOf('.a { }', '.zzz')).toEqual([]);
  });

  it('⚠️ 짝이 안 맞으면 파일 끝까지 반환하지 않는다 — 그 고장이 모든 toContain 을 통과시킨다', () => {
    expect(blockOf('.a { color: red', '.a')).toBeNull();
  });
});

describe('declarations', () => {
  it('마지막 선언이 이긴다 (CSS 캐스케이드)', () => {
    expect(declarations('color: red; color: blue')).toEqual({ color: 'blue' });
  });

  it('중첩 규칙 본문은 건너뛴다 — @media 본문을 넘겨도 바깥 선언만 남는다', () => {
    expect(declarations('outline-width: 3px; .a { color: red } ')).toEqual({ 'outline-width': '3px' });
  });

  it('declarationsOf 는 흩어진 같은 head 블록을 합친다(뒤가 이긴다)', () => {
    const css = ':root { --a: 1; --b: 9 } :root { --b: 2 }';
    expect(declarationsOf(css, ':root')).toEqual({ '--a': '1', '--b': '2' });
  });

  it('값이 비면 버린다(빈 표가 아니라 항목 자체가 없다)', () => {
    expect(declarations('color:;')).toEqual({});
  });
});
