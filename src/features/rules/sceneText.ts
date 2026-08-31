// 규칙 장면의 **글자**를 로케일별로 덮어쓰는 표 — 좌표는 건드리지 않는다.
//
// 왜 오버레이인가(기현 결정 2026-08-31, "C안"):
// 장면 21개 중 12개는 기현님이 드릴 편집기로 찍은 저작물이고, 그 코트 위 쪽지는 좌표 데이터
// (`scenes/*.scene.ts` 의 `notes[].text`) 안에 들어 있다. 다국어를 데이터 모델에 넣으려면
// 스키마 v10 · 편집기 입력칸 · 저장소 마이그레이션 · `--check` 재작성까지 번진다.
// 대신 **텍스트만 sceneId + 스텝 + 인덱스로 덮어쓴다** — 기현님 데이터는 한 바이트도 안 바뀐다.
//
// ## 안전 규칙 — 개수가 어긋나면 **아무것도 덮지 않는다**
// 기현님이 쪽지를 고쳐 개수가 달라지면, 그 자리는 조용히 원본(한국어)으로 돌아간다.
// 절반만 덮으면 한 장면 안에서 두 언어가 섞이는데 그것이 훨씬 나쁘다. 깨지지 않고 **되돌아가는**
// 것이 이 설계의 요점이고, 그래서 이 표는 **부채**다 — 원본이 바뀌면 여기도 따라 고쳐야 한다.
//
// ## 로케일 확장
// 일본어를 넣으려면 `SCENE_TEXT` 에 `ja:` 키를 더하기만 하면 된다. `hasFullSceneText()` 가
// 21개 장면을 다 덮었는지 **계산**하므로, 덜 채운 채로 넣어도 화면이 스스로 안내를 띄운다
// (2026-08-31 이전에는 `locale === 'ko'` 하드코딩이라 판정이 거짓말을 할 수 있었다).
import type { Locale } from '../../i18n/locale.ts';
import type { RuleSceneId } from './ruleScenes.ts';
import { RULE_SCENE_IDS } from './ruleScenes.ts';

export interface SceneText {
  /** 스텝별 코트 **아래** 노트 띠. 길이는 그 장면의 스텝 수와 같아야 한다. */
  note?: readonly string[];
  /** 스텝별 코트 **위** 라벨. 바깥 배열은 스텝, 안쪽은 그 스텝의 `notes[]` 순서다.
   *  ⚠️ 판 위에 그려지므로 **길이가 곧 레이아웃**이다 — 원문보다 길면 코트 밖으로 삐져나간다.
   *  줄바꿈(`\n`)은 원본의 것을 그대로 유지한다(라벨 상자가 그것으로 줄을 나눈다). */
  labels?: readonly (readonly string[])[];
}

export type SceneTextTable = Partial<Record<RuleSceneId, SceneText>>;

const EN: SceneTextTable = {
  // ── 앱이 쓴 장면 9개 ──────────────────────────────────────────────────────
  'field-tour': {
    note: [
      'The court is 28×15m — a basketball court. The goal area is 8×5m, the penalty mark is 3.5m out from the goal line, the posts are 6m apart, and the corner triangle is 1m from each corner.',
    ],
    labels: [['Goal area 8×5m', 'Penalty mark (3.5m)', 'Centre mark', 'Goal 6m wide', 'Corner 1m']],
  },
  lineup: {
    note: ['A team has at most four players, one of whom must be the goalkeeper. With fewer than two, a match cannot start or continue.'],
    labels: [[]],
  },
  'two-on-one-active': {
    note: [
      'One teammate and one opponent within 3m of the ball is not yet a violation. The second teammate is still approaching.',
      'The moment the second teammate comes within 3m and joins active play, it is a violation — indirect free kick to the opponents.',
    ],
    labels: [[], ['Indirect free kick']],
  },
  'two-on-one-gk': {
    note: [
      'A goalkeeper inside their own goal area does not count towards a 2-on-1. Here the goalkeeper, one outfield teammate and one opponent are all within 3m, and it is still not a violation.',
      'If one of the two is the goalkeeper inside their own goal area, there is no 2-on-1 — the exception outranks the head count.',
    ],
    labels: [[], ['GK exception — no violation']],
  },
  'two-on-one-open': {
    note: [
      'Two teammates within 3m of the ball is not a 2-on-1 if there is no opponent inside that 3m at all.',
      'Until an opponent (outside the dashed circle) comes within 3m, no number of teammates can make it a violation.',
    ],
    labels: [[], ['No opponent — no violation']],
  },
  'two-on-one-escape': {
    note: [
      'A 2-on-1 has formed near the touchline — one teammate prepares to drive out of it.',
      'Leaving the field briefly to avoid it is allowed, as long as it serves the natural flow of play and the player does not re-enter before that phase of play has ended.',
      'Re-entering near where they left, safely, and not as a habit keeps it legal. Breaking those conditions — re-entering early, doing it repeatedly, repositioning for advantage — is unsporting behaviour and a caution.',
    ],
    labels: [[], ['Briefly off the field — allowed'], []],
  },
  ramming: {
    note: [
      'Driving into an opponent, or attempting to, is an offense when it is careless or reckless, or uses excessive force.',
      'When it is called, the opponents get a direct free kick — or a penalty kick if it happened inside the offender’s own goal area.',
    ],
    labels: [[], ['Direct free kick']],
  },
  'spin-kick': {
    note: [
      'A spin kick sends the ball farther and faster than driving straight at it. The Laws do not prohibit it.',
      'But for part of the turn the kicker cannot see the ball, or an opponent approaching — an opponent coming into that blind arc makes it dangerous.',
      'If the referee judges it playing in a dangerous manner, the opponents get an indirect free kick at that spot.',
    ],
    labels: [[], [], ['Dangerous play → indirect FK']],
  },
  'contested-touch': {
    note: [
      'Two opponents are touching the ball at the same time while driving along the touchline. The ball is about to cross it.',
      'Once the whole ball crosses the touchline, the kick-in goes to the player who was on the outside trying to keep it in — here, away.',
    ],
    labels: [[], ['Kick-in to the outside player']],
  },

  // ── 기현님이 편집기로 만든 12개 — **좌표는 그대로, 글자만 덮는다** ────────────
  // 기현님의 연출 문법을 그대로 옮긴다: 노랑 쪽지는 조건, 빨강은 판정. 특히 인·아웃과 득점의
  // "아직 → 아직도 → 아직도! → 이제" 점층은 그 리듬이 설명이므로 영어에서도 리듬을 살린다.
  kickoff: {
    labels: [
      ['Opponents must be 5m from the ball', 'Everyone in their own half.'],
      ['Opponents must be 5m from the ball', 'Everyone in their own half.'],
    ],
  },
  inout: {
    labels: [
      [],
      ['Not out yet'],
      ['Still not out'],
      ['Still not out!'],
      ['Now it is out.', 'The whole circumference of the ball must be fully past the outer edge of the touchline, or of the goal line outside the posts, to be out.'],
    ],
  },
  scoring: {
    labels: [
      [],
      [],
      ['Not a goal yet.'],
      ['Still not a goal.'],
      ['Still not a goal!'],
      ['Now it is a goal.', 'The whole circumference of the ball must pass fully beyond the outer edge of the goal line between the posts.'],
    ],
  },
  'two-on-one': {
    labels: [
      ['Two players closing on one within 3m of the ball — blocking, impeding or trying to win it — is a violation by the team of two. Indirect free kick to the opponents.'],
    ],
  },
  'three-in-area': {
    labels: [
      ['Not a goal area violation yet. Defender 3 is at risk.'],
      [
        'Defender 3’s frontguard has crossed into the goal area while defending.',
        'That is a goal area violation by the defending team. A chair counts as inside if any part of it — wheels or guard — is over the line.',
      ],
    ],
  },
  dfk: {
    labels: [
      ['Opponents must be 5m away'],
      ['5m away', 'It can go straight in without touching anyone.'],
    ],
  },
  ifk: {
    labels: [
      ['Opponents must be 5m away'],
      ['5m away'],
      ['5m away', 'It must touch another player — either team — to count', 'Straight in, or in off a post or a referee, does not count (goal kick to the opponents).'],
    ],
  },
  penalty: {
    labels: [
      ['Everyone but the kicker and the goalkeeper stays 5m away and behind the goal area. ', 'The goalkeeper stays behind the goal line and must not move until the kick is taken.'],
      ['Everyone but the kicker and the goalkeeper stays 5m away and behind the goal area. ', 'The goalkeeper stays behind the goal line and must not move until the kick is taken.'],
    ],
  },
  'kick-in': {
    labels: [[], [], ['Opponents 5m away'], ['Opponents 5m away']],
  },
  'goal-kick': {
    labels: [
      ['A ball last touched by the attack\nfully crossing the goal line = goal kick'],
      ['A ball last touched by the attack\nfully crossing the goal line = goal kick'],
      ['In play the moment it leaves\nthe goal area completely'],
      ['In play the moment it leaves\nthe goal area completely'],
    ],
  },
  corner: {
    labels: [
      [],
      [],
      [],
      [],
      [
        'Place it anywhere in the corner triangle',
        'The goalkeeper must be fully behind the goal line between the posts',
        'Defenders inside the goal must be past the 1m mark inside the post.',
        'Defenders outside the goal must be 5m or more away.',
      ],
    ],
  },
  'set-ball': {
    labels: [
      ['Restart facing each other, parallel to the touchline, within 30cm of the ball. ', 'Everyone else must be 3m or more from the ball.'],
    ],
  },
};

/** 로케일 → 장면 글자 표. 없는 로케일은 원본(한국어)을 그대로 쓴다. */
export const SCENE_TEXT: Partial<Record<Locale, SceneTextTable>> = { en: EN };

export function sceneTextFor(locale: Locale): SceneTextTable | undefined {
  return SCENE_TEXT[locale];
}

/** 이 로케일이 **21개 장면 전부**의 글자를 갖는가.
 *
 *  화면 안내(`RuleLanguageNotice`)가 이 값으로 갈린다. 하드코딩이 아니라 **계산**인 이유:
 *  표를 덜 채운 채 로케일을 추가하면 안내가 거짓말을 하게 된다. ko 는 원본이므로 언제나 참이다.
 *  ⚠️ 여기서는 **키가 있는지만** 본다 — 스텝 수까지 맞는지는 `buildRuleScene` 이 장면마다 보고,
 *  어긋나면 그 장면만 원본으로 되돌린다(`ruleScenes.test.ts` 가 그 정합을 지킨다). */
export function hasFullSceneText(locale: Locale): boolean {
  if (locale === 'ko') return true;
  const table = SCENE_TEXT[locale];
  return table !== undefined && RULE_SCENE_IDS.every((id) => table[id] !== undefined);
}
