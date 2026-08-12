// 편집기 **컨테이너**의 실측 폭. [고정] 핀 노출 판정(≥1100, inspectorLayout.ts)에만 쓴다.
//
// 창(window)이 아니라 컨테이너를 재는 이유: 레일·헤더가 이미 먹고 남은 폭이 판이 실제로 쓰는
// 폭이고, 붙박이 인스펙터가 313 을 떼어 갈 수 있는지는 그 남은 폭이 정한다. 창 기준 판정
// (2.3 의 useIsNarrow)과는 대상이 다르므로 묶지 않는다 — useIsPortrait 주석이 기록해 둔
// "레이아웃은 창, 스테이지 회전은 코트 영역" 과 같은 종류의 분리다.
//
// ⚠️ 재는 대상은 **편집기 전체 상자(`<main>`)** 여야 한다. 코트 상자를 재면 붙박이 인스펙터가
// 서는 순간 코트가 줄고 → 관측이 다시 돌고 → … 로 ResizeObserver 루프가 열린다(CourtStage.tsx
// 181-183 이 같은 사고를 기록해 뒀다). main 의 폭은 인스펙터가 어느 모드든 바뀌지 않는다.
//
// ⚠️ TransportBar.tsx 의 useTrackWidth 와 형태가 같다. 하나로 합치지 않은 것은 그쪽이 스텝 칩
// 히트 폭 계산용이라 2.10 에서 통째로 다시 쓰이기 때문이다 — 그때 남는 쪽으로 합친다.
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useContainerWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    // jsdom 에는 ResizeObserver 가 없다 — window resize 로 물러난다.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
