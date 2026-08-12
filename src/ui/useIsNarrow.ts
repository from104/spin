// §5.1 기기 대응 분기 — **boolean 은 둘뿐이다**: `useIsPortrait()`(창이 세로로 긴가) 와 이것.
//
// 좁으면 크롬(판이 아닌 것)을 걷어낸다. 무엇을 얼마나 걷는지는 `app/chromeBudget.ts` 가 갖고,
// 여기서는 **언제**만 답한다. 등급·모드·기기 판별을 늘리지 않는 것이 요점이다 — 조합이 늘면
// "이 기기에서 왜 이렇게 보이는가" 를 아무도 재현하지 못한다(§8 '모드 스위치' 항목과 같은 이유).
//
// ⚠️ `useIsPortrait` 과 마찬가지로 **창** 기준이다. 인스펙터 핀 문턱(`INSPECTOR_PIN_MIN_PX`)은
// 같은 1100 이지만 **편집기 컨테이너** 기준이라 다른 판정이다 — 한 값으로 묶으면 세로 배치에서
// 패널을 아래로 내려 컨테이너가 넓어진 순간에도 창은 여전히 좁아 두 판정이 어긋난다.
//
// matchMedia 를 쓰는 이유(resize 리스너가 아니라): 문턱을 **넘을 때만** 발화한다. resize 마다
// setState 하면 창을 끄는 동안 리렌더가 수십 번 돌고, 그 리렌더가 코트 렌더 루프와 같은 프레임을
// 나눠 쓴다(§6.1 규칙 1 — React 는 프레임 단위 움직임을 구동하지 않는다).
import { useEffect, useState } from 'react';

/** 이 폭 **미만**이 좁은 것이다. 1100 은 '312 인스펙터를 떼어 주고도 코트가 남는 최소 폭'
 *  (§5.2·§5.3 실측)에서 왔다. */
export const NARROW_MAX_PX = 1100;

/** CSS `max-width` 는 경계값을 **포함**하므로 1100 을 그대로 쓰면 1100px 창까지 좁은 것이 된다.
 *  0.02 를 빼서 "1100 미만" 을 만든다(0.5 배율 화면에서도 안전한 관례적 간격이다). */
export const NARROW_QUERY = `(max-width: ${NARROW_MAX_PX - 0.02}px)`;

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (): void => setNarrow(mq.matches);
    onChange(); // 마운트 시점의 실제 값으로 맞춘다(SSR·초기 state 와 어긋날 수 있다)
    // Safari 16 이전은 addEventListener 를 지원하지 않는다 — addListener 로 물러난다.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return narrow;
}
