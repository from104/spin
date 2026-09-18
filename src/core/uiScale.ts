// PLAN-UI-SCALE 결정 2·3 — UI 크기 배율의 **값 집합**과 「자동」의 산술.
//
// 왜 `core` 인가: `storage/prefs.ts` 가 이 타입을 필드로 들어야 하는데 storage 는 core·model·i18n
// 만 import 한다(파일 머리 import 목록). 그리고 DESIGN §0 규칙 1 — 숫자는 core 가 소유한다.
//
// 왜 순수 함수인가: 「자동」은 기기를 재서 답을 내는 계산이고, 그 계산은 화면 없이 테스트로 닫을 수
// 있어야 한다. 이펙트나 화면에 섞어 두면 «이 기기에서 왜 150% 가 나왔나» 를 물어볼 곳이 없어진다
// — 그 질문에 답하는 것이 이 파일의 존재 이유다. 그래서 플랫폼 판정(`cssPxPerInch`)은 여기 두지
// 않고 **인자로 받는다**: core 는 아무것도 감지하지 않는다(감지는 `platform/shell.ts`).

/** 고정 배율 눈금(기현 지시 2026-09-18). `'auto'` 는 `resolveUiScale` 이 이 중 하나로 푼다.
 *  **오름차순이어야 한다** — `autoUiScale` 이 앞에서부터 훑어 "가장 작은" 답을 찾는다. */
export const UI_SCALE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type UiScaleStep = (typeof UI_SCALE_STEPS)[number];
export type UiScaleSetting = 'auto' | UiScaleStep;

export const UI_SCALE_VALUES: readonly UiScaleSetting[] = ['auto', ...UI_SCALE_STEPS];

export function isUiScaleSetting(v: unknown): v is UiScaleSetting {
  return v === 'auto' || (typeof v === 'number' && (UI_SCALE_STEPS as readonly number[]).includes(v));
}

// ⚠️ 2026-09-19 — 옛 「자동」 기준(표적 44px 의 물리 크기 9mm, `targetMmAt`/`autoUiScale`/
// `resolveUiScale`)이 **여기서 통째로 빠졌다.** 기현님이 기준을 «보드 화면에서 레일·트레이가
// 최대 크기이면서 둘 다 스크롤 안 됨» 으로 재정의했고, 그 계산은 레일·트레이의 치수를 알아야
// 하므로 core 가 답할 수 있는 질문이 아니다 → `app/autoUiScale.ts` 로 옮겼다.
//
// 근거를 지우지 않고 남긴다(AGENTS §2): 옛 기준은 «누를 수 있는 가장 작은 배율» 을 골랐는데,
// 안드로이드에서 44 CSS px = 7.0mm 라 어떤 가이드라인에도 미달이어서 자동이 100% 아래로 내려갈
// 수 없었다 — 지시문의 «보드가 최대로 커지는 쪽» 과 늘 반대로 움직였다. 기준이 틀린 것이 아니라
// **이 앱에 맞지 않았다.**

/** 옛 3단(100/115/130%, 루트 font-size 시절)을 새 눈금으로 옮긴다 — PLAN-UI-SCALE 결정 2.
 *
 *  1.15 → 1.25, 1.3 → 1.5. **반올림이 아니라 기구가 바뀐 것**이라 체감이 다르다: 옛 115% 는
 *  «글자만 1.15배», 새 125% 는 «화면 전체 1.25배» 다. 그래서 1.15 라는 눈금을 새로 만들어
 *  숫자를 보존하지 않는다 — 없는 눈금을 남겨 두면 옛 기구의 유령이 설정에 남는다.
 *
 *  ⚠️ 이 함수는 **마이그레이션의 역사**다. 나중에 눈금이 바뀌어도 여기 적힌 매핑은 그대로 둔다
 *  (`model/migrate.ts` 의 PREFS_MIGRATIONS 머리말과 같은 이유). */
export function migrateLegacyUiScale(v: unknown): UiScaleSetting {
  if (v === 1.15) return 1.25;
  if (v === 1.3) return 1.5;
  return isUiScaleSetting(v) ? v : 'auto';
}
