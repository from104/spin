// PLAN-UI-SCALE 결정 1·6 — 「지금 화면에 걸린 배율은 얼마인가」 의 **정본 한 벌**.
//
// 왜 훅이 필요한가: 배율은 두 군데서 필요하다. ① 변환을 거는 이펙트(App.tsx) ② 배율을 모르는
// API 를 환산하는 곳 — `matchMedia` 문턱(`useIsNarrow`)과 `window.innerWidth`(`useStageRot`).
// ②가 여럿이라 「설정값 → 실제 배율」 을 각자 풀면 언젠가 한 곳만 'auto' 를 안 풀게 된다.
//
// `core/uiScale.ts`(순수 산술) 와 `platform/shell.ts`(기기 감지) 를 여기서 **한 번만** 엮는다.
import { useSettingsState } from '../store/settings/SettingsProvider.tsx';
import { resolveUiScale } from '../core/uiScale.ts';
import type { UiScaleStep } from '../core/uiScale.ts';
import { cssPxPerInch } from '../platform/shell.ts';

/** 설정이 'auto' 면 기기를 재서 푼 값, 아니면 고른 값 그대로. */
export function useUiScale(): UiScaleStep {
  const { prefs } = useSettingsState();
  return resolveUiScale(prefs.a11y.uiScale, cssPxPerInch());
}
