// 코트에서 끌어온 개체를 트레이에 놓으면 빼내는 판정. 드래그 중에는 코트 SVG 가 포인터를
// 캡처하므로 이벤트 대상으로는 판정할 수 없다 — 기하(elementFromPoint)로만 답이 나온다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOverTray } from './useEditorPointer.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** jsdom 은 레이아웃이 없어 elementFromPoint 가 답할 수 없다(setup.ts 가 null 스텁을 깐다).
 *  여기서는 "그 좌표에 이 요소가 있다" 를 직접 세운다. */
function stubHitAt(el: Element | null) {
  vi.spyOn(document, 'elementFromPoint').mockImplementation(() => el);
}

describe('isOverTray', () => {
  it('트레이 안쪽 요소 위면 참 — 자식 깊이와 무관하다', () => {
    document.body.innerHTML = '<nav data-tray><div><button id="deep">공</button></div></nav>';
    stubHitAt(document.getElementById('deep'));
    expect(isOverTray({ x: 10, y: 10 })).toBe(true);
  });

  it('트레이 밖이면 거짓', () => {
    document.body.innerHTML = '<nav data-tray></nav><svg id="court"></svg>';
    stubHitAt(document.getElementById('court'));
    expect(isOverTray({ x: 10, y: 10 })).toBe(false);
  });

  it('좌표가 없으면(pointercancel) 거짓 — 시스템 제스처에 가로채였다고 개체가 사라지면 안 된다', () => {
    document.body.innerHTML = '<nav data-tray></nav>';
    const spy = vi.spyOn(document, 'elementFromPoint');
    expect(isOverTray(null)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('아무 요소도 없으면 거짓', () => {
    stubHitAt(null);
    expect(isOverTray({ x: 0, y: 0 })).toBe(false);
  });
});
