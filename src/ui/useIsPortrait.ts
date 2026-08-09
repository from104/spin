// §6.4 태블릿 레이아웃 판정. **창**이 세로로 길면 3분할(도구|코트|속성) 대신 세로 배치로
// 바꾼다 — 도구·속성을 아래로 내려 코트가 폭을 다 쓰게 한다.
//
// ⚠️ 이것은 스테이지 회전(CourtStage 의 `rot`)과 **다른 판정**이고, 그래야 맞다:
//   · 레이아웃은 **창** 기준 — 패널을 어디에 둘지는 화면 전체 모양이 정한다.
//   · 스테이지 회전은 **코트 영역** 기준 — 패널이 어디로 갔느냐에 따라 남은 상자가 달라지고,
//     코트는 그 상자에 맞춰 돌아야 한다.
// 둘을 같은 값으로 묶으면, 패널을 아래로 내려 코트가 넓어졌는데도 여전히 "세로"로 판정해
// 돌지 말아야 할 때 돌아버린다.
import { useEffect, useState } from 'react';

const QUERY = '(orientation: portrait)';

function read(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = (): void => setPortrait(mq.matches);
    onChange(); // 마운트 시점의 실제 값으로 맞춘다(SSR·초기 state 와 어긋날 수 있다)
    // Safari 16 이전은 addEventListener 를 지원하지 않는다 — addListener 로 물러난다.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return portrait;
}
