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

// jsdom 은 document.elementFromPoint 를 구현하지 않는다(레이아웃이 없어 답할 수가 없다).
// 없는 채로 두면 "트레이에 놓아 개체 빼기"(useEditorPointer.isOverTray) 경로가 pointerup 마다
// TypeError 를 던지고, 그 예외는 React 이벤트 디스패치에 삼켜져 테스트는 초록불로 지나간다.
// 항상 null(= 아무것도 안 맞음)을 돌려주는 스텁을 깔아 경로가 실제로 실행되게 한다.
// 트레이 판정 자체를 검증하는 테스트는 이 스텁을 자기 값으로 덮어쓴다.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

// 자유 전술판의 세션 캐시(features/board/boardSession.ts)는 **모듈 전역**이다. 앱에는 판이
// 하나뿐이라 그것이 옳은 수명이지만, 한 파일 안에서 BoardScreen 을 여러 번 렌더하는 테스트는
// 앞 테스트가 놓은 배치와 이력을 그대로 이어받아 열게 된다 — 실제로 21개 파일 중 넷이
// 그렇게 빨간불이 났다(2026-08-14).
//
// 파일마다 beforeEach 를 적게 하지 않고 여기서 한 번에 끊는다: 새 테스트 파일이 이 위생 규칙을
// **잊을 수 있는 형태로 두지 않기 위해서**다. 새로고침을 흉내내는 테스트는 여전히 자기 안에서
// 직접 clearBoardSession() 을 불러야 한다(언마운트 하나로는 세션이 안 끊긴다).
import { beforeEach } from 'vitest'
import { clearBoardSession } from '../features/board/boardSession.ts'

beforeEach(() => {
  clearBoardSession()
})
