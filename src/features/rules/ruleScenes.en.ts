// 손코딩 장면 **9개**의 스텝 노트 — 영어판.
//
// ⚠️ 여기 있는 것은 **앱이 쓴 글**이고, 기현님 저작물이 아니다. 그 구분이 이 파일의 존재 이유다:
//  - 손코딩 9개(`field-tour`·`lineup`·`two-on-one-{active,gk,open,escape}`·`ramming`·`spin-kick`·
//    `contested-touch`)의 노트는 Claude 가 정본에서 써 넣은 설명문이라 **번역 대상**이다.
//  - 편집기에서 온 12개(`scenes/*.scene.ts`)의 코트 위 쪽지는 **기현님이 찍은 좌표 데이터 안**에
//    있어 손대지 않는다(PLAN-RULES-9CARDS §9.3-4). 그래서 영어 화면에서도 그 12개는 한국어로 남고,
//    `RuleLanguageNotice` 가 그 사실을 한 줄로 알린다.
//
// 2026-08-31 이전에는 이 둘을 뭉뚱그려 "장면 자막은 전부 기현님 데이터" 로 취급했고, 그 때문에
// 영어 화면에서 **앱이 쓴 설명문까지 한국어로 남아** 있었다. 기현님 지적("도해, 장면은 번역이
// 안 되어있다")으로 갈랐다.
//
// 스텝 인덱스는 한국어 원본과 같아야 한다 — `ruleScenes.test.ts` 의 스텝 수 검사표가 로케일과
// 무관하게 걸린다. 배열 길이가 다르면 그 장면만 조용히 한국어로 남는다.
import type { RuleSceneId } from './ruleScenes.ts';

/** sceneId → 스텝별 노트. 여기 없는 장면은 원본(한국어)을 그대로 쓴다. */
export const SCENE_NOTES_EN: Partial<Record<RuleSceneId, readonly string[]>> = {
  'field-tour': [
    'The court is 28×15m — a basketball court. The goal area is 8×5m, the penalty mark is 3.5m out from the goal line, the posts are 6m apart, and the corner triangle is 1m from each corner.',
  ],
  lineup: [
    'A team has at most four players, one of whom must be the goalkeeper. With fewer than two, a match cannot start or continue.',
  ],
  'two-on-one-active': [
    'One teammate and one opponent within 3m of the ball is not yet a violation. The second teammate is still approaching.',
    'The moment the second teammate comes within 3m and joins active play, it is a violation — indirect free kick to the opponents.',
  ],
  'two-on-one-gk': [
    'A goalkeeper inside their own goal area does not count towards a 2-on-1. Here the goalkeeper, one outfield teammate and one opponent are all within 3m, and it is still not a violation.',
    'If one of the two is the goalkeeper inside their own goal area, there is no 2-on-1 — the exception outranks the head count.',
  ],
  'two-on-one-open': [
    'Two teammates within 3m of the ball is not a 2-on-1 if there is no opponent inside that 3m at all.',
    'Until an opponent (outside the dashed circle) comes within 3m, no number of teammates can make it a violation.',
  ],
  'two-on-one-escape': [
    'A 2-on-1 has formed near the touchline — one teammate prepares to drive out of it.',
    'Leaving the field briefly to avoid it is allowed, as long as it serves the natural flow of play and the player does not re-enter before that phase of play has ended.',
    'Re-entering near where they left, safely, and not as a habit keeps it legal. Breaking those conditions — re-entering early, doing it repeatedly, repositioning for advantage — is unsporting behaviour and a caution.',
  ],
  ramming: [
    'Driving into an opponent, or attempting to, is an offense when it is careless or reckless, or uses excessive force.',
    'When it is called, the opponents get a direct free kick — or a penalty kick if it happened inside the offender’s own goal area.',
  ],
  'spin-kick': [
    'A spin kick sends the ball farther and faster than driving straight at it. The Laws do not prohibit it.',
    'But for part of the turn the kicker cannot see the ball, or an opponent approaching — an opponent coming into that blind arc makes it dangerous.',
    'If the referee judges it playing in a dangerous manner, the opponents get an indirect free kick at that spot.',
  ],
  'contested-touch': [
    'Two opponents are touching the ball at the same time while driving along the touchline. The ball is about to cross it.',
    'Once the whole ball crosses the touchline, the kick-in goes to the player who was on the outside trying to keep it in — here, away.',
  ],
};

/** 손코딩 장면의 **코트 위 라벨**(`step.notes[].text`) — 영어판.
 *  띠 노트(`step.note`)와 갈라 둔 이유: 이쪽은 판 위에 그려지는 짧은 꼬리표라 **길이가 곧 레이아웃**이다.
 *  한국어보다 길어지면 코트 밖으로 삐져나가므로 짧게 유지한다(좌표는 손대지 않는다).
 *  스텝별·라벨별 순서는 원본과 같아야 한다 — 개수가 다르면 그 스텝은 원본을 그대로 쓴다. */
export const SCENE_LABELS_EN: Partial<Record<RuleSceneId, readonly (readonly string[])[]>> = {
  'field-tour': [['Goal area 8×5m', 'Penalty mark (3.5m)', 'Centre mark', 'Goal 6m wide', 'Corner 1m']],
  lineup: [[]],
  'two-on-one-active': [[], ['Indirect free kick']],
  'two-on-one-gk': [[], ['GK exception — no violation']],
  'two-on-one-open': [[], ['No opponent — no violation']],
  'two-on-one-escape': [[], ['Briefly off the field — allowed'], []],
  ramming: [[], ['Direct free kick']],
  'spin-kick': [[], [], ['Dangerous play → indirect FK']],
  'contested-touch': [[], ['Kick-in to the outside player']],
};
