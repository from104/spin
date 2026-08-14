// 개체 메뉴를 여는 **손짓** — 오른쪽 클릭 · 긴 터치 (기현 지시 2026-08-14).
//
// 훅으로 뺀 이유: 대상이 여섯 종류이고 두 갈래 경로(개체 레이어 · 도형 레이어)로 들어오는데,
// 두 곳이 각자 타이머를 굴리면 "칩은 길게 눌러 열리는데 도형은 안 열린다" 같은 반쪽이 난다.
//
// ── 긴 터치의 세 가지 함정 ───────────────────────────────────────────────────────────
// ① **끌기와 겹친다.** 개체를 끌려고 손을 얹은 채 잠깐 멈추면 메뉴가 뜬다. 그래서 손가락이
//    `MOVE_CANCEL_PX` 이상 움직이면 타이머를 접는다 — 끌기가 이겼다는 뜻이다.
// ② **마우스에도 걸린다.** 마우스로 누른 채 생각하면 메뉴가 뜬다. 마우스는 오른쪽 클릭이라는
//    정확한 손짓이 이미 있으므로 **터치·펜만** 긴 누름을 받는다.
// ③ **iOS 가 자기 메뉴를 띄운다.** 길게 누르면 브라우저가 선택·복사 메뉴를 올린다. 그것은
//    `touch-action`·`user-select` 로 이미 막혀 있고(STAGE_STYLE), 여기서는 `contextmenu` 의
//    기본 동작만 막는다.
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** 손가락을 얹고 있어야 하는 시간. 짧으면 탭이 메뉴를 열고, 길면 "안 열린다" 가 된다.
 *  500ms 는 iOS·안드로이드 기본 길게누름과 같은 값이라 손에 이미 익어 있다. */
export const LONG_PRESS_MS = 500;
/** 이만큼 움직이면 **끌기**로 본다. 발 마우스·입 젓가락은 미세하게 흔들리므로 0 은 안 된다. */
export const MOVE_CANCEL_PX = 10;

export interface LongPressMenuApi {
  /** 개체의 `onPointerDown` 에 그대로 얹는다. 끌기 배선을 **가로채지 않는다** —
   *  이 훅은 타이머만 걸고 이벤트는 그대로 흘려보낸다. */
  onPointerDown(id: string, e: ReactPointerEvent<Element>): void;
  /** 개체의 `onContextMenu` 에 얹는다. */
  onContextMenu(id: string, e: { preventDefault(): void; clientX: number; clientY: number }): void;
  /** 끌기가 시작됐다는 신호 — 타이머를 접는다. 포인터가 개체 밖으로 나가도 안전하게 접히도록
   *  window pointerup/cancel 에도 걸어 두지만, 명시적으로 부를 수 있는 문을 함께 둔다. */
  cancel(): void;
}

export function useLongPressMenu(open: (id: string, x: number, y: number) => void): LongPressMenuApi {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  // 언마운트에 타이머를 남기면 사라진 화면에 메뉴가 뜬다.
  useEffect(() => cancel, [cancel]);

  // 손을 떼거나 움직이면 접는다. **window** 에서 받는 이유: 손가락이 개체 밖으로 나가면
  // 개체의 pointerup 은 안 오는데, 타이머는 그대로 돌아 엉뚱한 순간에 메뉴가 뜬다.
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const s = startRef.current;
      if (!s) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_CANCEL_PX) cancel();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cancel);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cancel);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [cancel]);

  const onPointerDown = useCallback(
    (id: string, e: ReactPointerEvent<Element>) => {
      cancel();
      // 마우스는 오른쪽 클릭이라는 정확한 손짓이 있다(함정 ②).
      if (e.pointerType === 'mouse') return;
      const x = e.clientX;
      const y = e.clientY;
      startRef.current = { x, y };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        open(id, x, y);
      }, LONG_PRESS_MS);
    },
    [cancel, open],
  );

  const onContextMenu = useCallback(
    (id: string, e: { preventDefault(): void; clientX: number; clientY: number }) => {
      e.preventDefault();
      cancel();
      open(id, e.clientX, e.clientY);
    },
    [cancel, open],
  );

  return { onPointerDown, onContextMenu, cancel };
}
