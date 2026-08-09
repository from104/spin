import '@testing-library/jest-dom'
// storage 모듈(§4)의 fake-indexeddb 기반 테스트가 전역에서 idb 를 쓸 수 있게 한다.
import 'fake-indexeddb/auto'

// jsdom 은 Pointer Capture API 를 구현하지 않는다. CourtStage.handlePointerDown 은
// 드래그를 시작하면서 setPointerCapture 를 부르므로, 폴리필이 없으면 거기서 TypeError 가
// 터지고 그 아래(controller.onPointerDown = beginDrag)가 통째로 실행되지 않는다.
// 예외가 React 이벤트 디스패치 안에서 삼켜져 테스트는 초록불로 통과해버리므로,
// 드래그 회귀 가드가 조용히 무력화된다. 실제로 그렇게 죽어 있던 테스트가 있었다.
// (§7.5 접근성 요건인 "키보드로 옮긴 개체를 마우스로 잡기" 경로)
//
// 캡처 대상 재지정(retargeting)까지는 흉내내지 않는다 — 테스트는 후속 pointermove·
// pointerup 을 잡은 엘리먼트에 직접 디스패치해야 한다.
const captured = new WeakMap<Element, Set<number>>()

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function (pointerId: number) {
    let ids = captured.get(this)
    if (!ids) captured.set(this, (ids = new Set()))
    ids.add(pointerId)
  }
  Element.prototype.releasePointerCapture = function (pointerId: number) {
    captured.get(this)?.delete(pointerId)
  }
  Element.prototype.hasPointerCapture = function (pointerId: number) {
    return captured.get(this)?.has(pointerId) ?? false
  }
}
