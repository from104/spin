import { describe, expect, it } from 'vitest';
import { isEditableTarget, isInteractiveTarget } from './keyboard.ts';

describe('isEditableTarget', () => {
  it('input/textarea/select 는 true, 일반 div 는 false', () => {
    document.body.innerHTML = `
      <input id="i" /><textarea id="t"></textarea><select id="s"></select><div id="d"></div>
    `;
    expect(isEditableTarget(document.getElementById('i'))).toBe(true);
    expect(isEditableTarget(document.getElementById('t'))).toBe(true);
    expect(isEditableTarget(document.getElementById('s'))).toBe(true);
    // jsdom 은 HTMLElement.isContentEditable 을 구현하지 않아 undefined 를 반환하므로
    // (실제 브라우저에서는 항상 boolean) falsy 로만 검증한다.
    expect(isEditableTarget(document.getElementById('d'))).toBeFalsy();
  });

  it('isContentEditable 은 true', () => {
    // jsdom 은 isContentEditable getter 를 구현하지 않아(항상 undefined) 실제 브라우저처럼
    // 프로퍼티를 직접 정의해 시뮬레이션한다.
    const ce = document.createElement('div');
    Object.defineProperty(ce, 'isContentEditable', { value: true });
    expect(isEditableTarget(ce)).toBe(true);
  });

  it('null·비 HTMLElement 는 false', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isInteractiveTarget', () => {
  it('버튼 안 아이콘처럼 인터랙티브 요소 내부에 중첩된 target 도 true (closest)', () => {
    document.body.innerHTML = `<button id="btn"><span id="icon">x</span></button>`;
    expect(isInteractiveTarget(document.getElementById('icon'))).toBe(true);
  });

  it('role="radio" · role="tab" · [contenteditable="true"] 도 인터랙티브로 취급', () => {
    document.body.innerHTML = `
      <div id="r" role="radio"></div>
      <div id="tab" role="tab"></div>
      <div id="ce" contenteditable="true"></div>
      <div id="plain"></div>
    `;
    expect(isInteractiveTarget(document.getElementById('r'))).toBe(true);
    expect(isInteractiveTarget(document.getElementById('tab'))).toBe(true);
    expect(isInteractiveTarget(document.getElementById('ce'))).toBe(true);
    expect(isInteractiveTarget(document.getElementById('plain'))).toBe(false);
  });

  it('a 는 href 가 있을 때만 인터랙티브', () => {
    document.body.innerHTML = `<a id="link" href="/x"></a><a id="nolink"></a>`;
    expect(isInteractiveTarget(document.getElementById('link'))).toBe(true);
    expect(isInteractiveTarget(document.getElementById('nolink'))).toBe(false);
  });
});
