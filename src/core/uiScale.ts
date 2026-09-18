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

/** 손끝 표적의 기준선(mm). ISO 9241-9 의 손끝 권고에서 왔고 Material 의 48dp(≈7.6mm)보다 보수적이다.
 *  **여기를 낮추면 자동이 더 작은 배율을 고른다** — 보드는 커지고 버튼은 누르기 어려워진다. */
export const TARGET_MIN_MM = 9;

/** 자동이 기준 삼는 표적의 CSS px 크기. `--hit` 의 기본값과 같은 수다(tokens.css).
 *
 *  토큰을 읽지 않고 리터럴로 두는 이유: 이 값은 «사람 손가락이 닿아야 하는 것» 의 눈금이지
 *  «지금 --hit 이 얼마인가» 가 아니다. 큰 표적 모드(56)를 켠 사람에게 자동이 더 작은 배율을 주면
 *  두 설정이 서로를 상쇄해 아무 일도 일어나지 않는다. 마찬가지로 2026-09-18 에 헤더 오른쪽
 *  조작부를 29 로 내린 것(`--hit-slim`)도 여기에 반영하지 않는다 — 그건 그 자리의 예외다. */
export const AUTO_TARGET_CSS_PX = 44;

const MM_PER_INCH = 25.4;

/** 그 배율에서 44px 표적이 몇 mm 인가. 자동의 판정식 전부가 이 한 줄이다.
 *  `pxPerInch` 는 «CSS px 한 개가 1인치에 몇 개 들어가는가» — 안드로이드 160(1dp=1/160in),
 *  데스크톱 96(CSS 규격). 감지는 `platform/shell.ts` 의 `cssPxPerInch()` 가 한다. */
export function targetMmAt(scale: number, pxPerInch: number): number {
  return (AUTO_TARGET_CSS_PX * scale * MM_PER_INCH) / pxPerInch;
}

/** 「자동」의 답 — 표적이 기준선 이상이 되는 **가장 작은** 눈금.
 *
 *  가장 작은 쪽인 이유: 크롬(레일·헤더·바)은 CSS px 로 고정이라 배율이 작을수록 화면에서
 *  차지하는 물리 비중이 줄고 그만큼 보드가 커진다("보드가 최대로 커지는 쪽" — 기현 지시).
 *  즉 이 함수는 **누를 수 있는 한 가장 작게** 를 고른다.
 *
 *  어느 눈금도 기준선을 못 넘으면 가장 큰 눈금을 준다 — 못 누르는 화면을 주느니 큰 쪽이 낫다. */
export function autoUiScale(pxPerInch: number): UiScaleStep {
  for (const s of UI_SCALE_STEPS) {
    if (targetMmAt(s, pxPerInch) >= TARGET_MIN_MM) return s;
  }
  return UI_SCALE_STEPS[UI_SCALE_STEPS.length - 1]!;
}

/** 설정값 → 실제로 화면에 거는 배율. 화면·이펙트는 **이 함수만** 부른다. */
export function resolveUiScale(setting: UiScaleSetting, pxPerInch: number): UiScaleStep {
  return setting === 'auto' ? autoUiScale(pxPerInch) : setting;
}

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
