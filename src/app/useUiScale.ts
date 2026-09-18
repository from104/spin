// PLAN-UI-SCALE 결정 1·3·6 — 「지금 화면에 걸린 배율은 얼마인가」 의 **정본 한 벌**.
//
// 왜 훅이 필요한가: 배율은 두 군데서 필요하다. ① 변환을 거는 이펙트(App.tsx) ② 배율을 모르는
// API 를 환산하는 곳 — `matchMedia` 문턱(`useIsNarrow`)과 `window.innerWidth`(`useStageRot`).
// ②가 여럿이라 「설정값 → 실제 배율」 을 각자 풀면 언젠가 한 곳만 'auto' 를 안 풀게 된다.
import { useEffect, useState } from 'react';
import { useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { resolveUiScale } from './autoUiScale.ts';
import type { UiScaleStep } from '../core/uiScale.ts';
import { INTERACT } from '../core/constants.ts';
import { useIsPortrait } from '../ui/useIsPortrait.ts';
import { showDesktopDownload } from './download/desktopDownload.ts';

interface Avail {
  w: number;
  h: number;
}

/** 배율 래퍼가 실제로 받는 상자 — `#root` 의 **내용** 상자다.
 *
 *  `innerWidth/Height` 가 아닌 이유: `#root` 는 safe-area(노치·홈 인디케이터) 여백을 지고, 그
 *  여백은 물리적 자리라 배율을 안 탄다. 자동이 그 여백을 앱 공간으로 착각하면 실기에서만
 *  한 눈금 낙관적이 된다(에뮬레이터에서 상하 합 68px).
 *
 *  ⚠️ 이 값은 **배율과 무관해야 한다.** 래퍼(`.spin-scale`)가 아니라 그 **부모**를 재는 이유가
 *  그것이다 — 래퍼를 재면 배율이 배율의 입력이 되어 되먹임 고리가 닫힌다. */
function readAvail(): Avail {
  if (typeof document === 'undefined') return { w: 0, h: 0 };
  const root = document.getElementById('spin-scale')?.parentElement;
  if (!root) return { w: typeof window === 'undefined' ? 0 : window.innerWidth, h: typeof window === 'undefined' ? 0 : window.innerHeight };
  // ⚠️ `clientWidth/Height` 는 **패딩을 포함한다.** 그대로 쓰면 safe-area 여백(에뮬레이터 실측
  //    상하 합 68px)을 앱이 쓸 수 있는 공간으로 착각해 자동이 한 눈금 낙관적이 된다 — 2026-09-19
  //    에 실제로 그렇게 짰다가 실측에서 744(패딩 포함) vs 676(내용)로 갈라지는 것을 봤다.
  const cs = getComputedStyle(root);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  return {
    w: root.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
    h: root.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom),
  };
}

/** 설정이 'auto' 면 화면을 재서 푼 값, 아니면 고른 값 그대로. */
export function useUiScale(): UiScaleStep {
  const { prefs } = useSettingsState();
  const portrait = useIsPortrait();
  const [avail, setAvail] = useState<Avail>(readAvail);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // ⚠️ 여기서는 `resize` 리스너를 쓴다 — `useIsNarrow`·`useStageRot` 이 그것을 피한 이유
    //    (*"resize 마다 setState 하면 리렌더가 수십 번 돌고, 그 리렌더가 코트 렌더 루프와 같은
    //    프레임을 나눠 쓴다"*)가 여기에는 **안 걸린다**: 아래 setState 는 값이 실제로 달라질
    //    때만 상태를 바꾸고(같으면 prev 를 그대로 돌려준다), 배율은 눈금이 일곱뿐이라 창을 끄는
    //    동안 바뀌는 횟수가 한 자리다. matchMedia 로 옮기려면 «답이 안 바뀌는 창 크기 상자» 를
    //    미리 계산해야 하는데, 그 상자의 문턱이 레일·트레이 치수에서 나와 코트 rot 의 상자처럼
    //    기울어진 경계가 아니라 축 정렬이라 이득이 적다.
    const onResize = (): void =>
      setAvail((prev) => {
        const next = readAvail();
        return prev.w === next.w && prev.h === next.h ? prev : next;
      });
    onResize(); // 마운트 시점에 #root 가 이미 있으므로 초기값을 실제 값으로 맞춘다
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const hitPx = prefs.a11y.largeTargets ? INTERACT.hitTargetLargeCssPx : INTERACT.hitTargetCssPx;
  return resolveUiScale(prefs.a11y.uiScale, {
    availW: avail.w,
    availH: avail.h,
    landscape: !portrait,
    hitPx,
    // 네이티브 셸에는 [데스크톱 앱 받기] 칸이 없다 — 있으면 레일이 44 더 길다.
    railDownloadBtn: showDesktopDownload(),
  });
}
