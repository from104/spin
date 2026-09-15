// 첫 실행에 심는 **따라하기 드릴** 한 벌 (2026-09-16, SPIN 출시 프로젝트 T7).
//
// 첫 실행 온보딩(`ui/onboarding/FirstRunOnboarding.tsx`)이 말로 알려 주는 «놓기 → 남기기 →
// 시연» 을, 열어서 눌러 볼 수 있는 물건으로 한 벌 둔다. 규칙 장면 22벌은 «규칙» 을 보여 주는
// 것이라 «내 훈련을 이렇게 만든다» 의 본보기는 아니었다.
//
// ⚠️ **그림은 이 파일이 안 만든다.** 좌표·타이밍은 기현님이 편집기에서 만들어 내보낸 것을
// `tutorialDrillData.ts` 가 그대로 담고 있고, 이 파일은 **시드가 정해야 하는 값만 덮는다**:
//   · id — 고정. 기계가 새로 뽑으면 실행할 때마다 다른 드릴이 되어 «이미 있는가» 판정이 깨진다.
//   · 시각 — 고정(아래 `at`). 기계 시계를 읽으면 기기마다 값이 달라 동기화 LWW 에서 **안 고친
//     시드가 남의 편집을 이긴다**(`ruleScenes.ts` 의 SEED_EPOCH 근거가 그대로 적용된다).
//   · 제목·팀 이름 — 언어별. 내보낸 판에는 한국어 한 벌뿐이라, 그대로 심으면 영어·일본어
//     사용자의 목록에 한국어 제목이 앉는다. 규칙 장면이 쓰는 것과 **같은 키**를 쓴다.
//
// ⚠️ `level`('초급')은 **안 덮는다.** 그 필드는 원문으로 저장하고 화면에 찍을 때만
// `DRILL_LEVEL_LABELS[locale]` 을 거치는 것이 계약이다(`drill.ts` 의 그 주석) — 여기서 번역해
// 넣으면 비교·필터가 언어마다 갈린다.
import type { DrillId } from '../core/ids.ts';
import type { Drill } from './drill.ts';
import type { Locale } from '../i18n/locale.ts';
import { translate } from '../i18n/useT.ts';
import { TUTORIAL_DRILL_RAW } from './tutorialDrillData.ts';

/** 고정 id. 규칙 장면의 `SEED_DRILL_ID` 와 같은 꼴·같은 이유다(그 표의 머리말). */
export const TUTORIAL_DRILL_ID = 'dr_tutorial_first' as DrillId;

/** 첫 실행에 심을 한 벌을 만든다.
 *
 *  @param at 심을 시각(고정값). 호출부가 규칙 장면의 `SEED_EPOCH` 를 기준으로 준다 — 이 파일이
 *  그 상수를 직접 들고 오지 않는 것은 `model/` 이 `features/` 를 보지 않게 하기 위해서다. */
export function tutorialDrill(locale: Locale, at: number): Drill {
  const d = structuredClone(TUTORIAL_DRILL_RAW);
  return {
    ...d,
    id: TUTORIAL_DRILL_ID,
    title: translate(locale, 'onboarding.drill.title'),
    teams: {
      home: { ...d.teams.home, label: translate(locale, 'team.defaultHomeLabel') },
      away: { ...d.teams.away, label: translate(locale, 'team.defaultAwayLabel') },
    },
    createdAt: at,
    updatedAt: at,
  };
}
