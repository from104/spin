// 부록(공식 룰 북) 18개조 — 영어판. `ruleContent.ts` 의 `LAWS_KO` 와 **조항 번호·key·group·
// figureId·sceneId 가 같아야 한다**(도해·장면 연결 단언이 로케일과 무관하게 걸린다).
// 바뀌는 것은 `title` 과 `summary` 뿐이다.
//
// ⚠️ 한국어판의 번역이 아니다 — 정본은 `docs/RULES-FIPFA-2025.en.md`(FIPFA 영어 원문에서 직접
// 쓴 것)이다. 이유는 `ruleTopics.en.ts` 머리말과 PLAN-RULES-9CARDS §9.2 참조.
import type { RuleLaw } from './ruleContent.ts';

export const LAWS_EN: readonly RuleLaw[] = [
  {
    law: 1,
    key: 'field',
    group: 'basics',
    title: 'Law 1 — The Field of Play',
    summary: [
      'Standard 28×15m (a basketball court); up to 30×18m for sanctioned international events.',
      'Goal area 8m wide × 5m deep. Penalty mark 3.5m out. Goalposts 6m apart. Corner triangle 1m.',
    ],
    figureId: 'court',
    sceneId: 'field-tour',
  },
  {
    law: 2,
    key: 'ball',
    group: 'basics',
    title: 'Law 2 — The Ball',
    summary: [
      'Spherical, inflated to minimise bouncing yet stop a powerchair riding over it. The Laws give no size or weight.',
      'A FIPFA-approved ball is 33cm (13in) across — from equipment guidance, not the Laws. An adult football is about 22cm.',
    ],
    figureId: 'ball',
  },
  {
    law: 3,
    key: 'players',
    group: 'basics',
    title: 'Law 3 — The Number of Players',
    summary: [
      'Four players a side, one of them the goalkeeper. Fewer than two and the match cannot start or continue.',
      'Up to four substitutes unless both teams agree otherwise and tell the referee. No goalkeeper substitution for a penalty kick, except injury or equipment failure.',
    ],
    sceneId: 'lineup',
  },
  {
    law: 4,
    key: 'equipment',
    group: 'basics',
    title: 'Law 4 — The Players’ Equipment',
    summary: [
      'Four or more wheels; maximum 10 kph forward and reverse. Lap seatbelt, frontguard and lateral supports on both sides.',
      'Guards must be unbreakable, flat or convex, never angled to lift the ball. Nothing may be built to trap or hold the ball.',
    ],
    figureId: 'equipment',
  },
  {
    law: 5,
    key: 'referee',
    group: 'officials',
    title: 'Law 5 — The Referee',
    summary: ['Full authority to enforce the Laws; acts as timekeeper; decisions on facts connected with play are final.'],
  },
  {
    law: 6,
    key: 'assistants',
    group: 'officials',
    title: 'Law 6 — The Assistant Referees',
    summary: ['Signal the ball out of play, which side restarts, substitutions, goal-area and goal-line offenses, and penalty-kick infringements.'],
  },
  {
    law: 7,
    key: 'duration',
    group: 'play',
    title: 'Law 7 — The Duration of the Match',
    summary: [
      'Two halves of 20 minutes; half-time at most 10 minutes. Both may be changed only by prior agreement.',
      'Time lost to injuries, repairs and time-wasting is added back at the referee’s discretion.',
    ],
  },
  {
    law: 8,
    key: 'kickoff',
    group: 'restarts',
    title: 'Law 8 — The Start and Restart of Play',
    summary: [
      'Kick-off from the centre mark with opponents 5m clear; a goal may be scored directly.',
      'Set ball restarts play after a stoppage the Laws do not name elsewhere: one player from each team within 30cm, everyone else 3m back.',
    ],
    sceneId: 'kickoff',
  },
  {
    law: 9,
    key: 'inout',
    group: 'play',
    title: 'Law 9 — The Ball In and Out of Play',
    summary: [
      'Out when the whole ball crosses a line, when it stays wedged between opponents for over 5 seconds, or when it rises above 50.8cm and the referee judges that dangerous.',
      'The ball may only be played by the chairs — never moved by a hand, foot or the body.',
    ],
    sceneId: 'inout',
  },
  {
    law: 10,
    key: 'scoring',
    group: 'play',
    title: 'Law 10 — The Method of Scoring',
    summary: [
      'The whole ball must roll — not be carried — over the goal line between the posts, with no prior infringement by the scoring team.',
      'No goal if it is above 50.8cm (20in) as it crosses. More goals wins; level is a draw.',
    ],
    sceneId: 'scoring',
  },
  {
    law: 11,
    key: 'position',
    group: 'play',
    title: 'Law 11 — Field Position',
    summary: [
      '2-on-1: two teammates and an opponent within 3m of the ball, all three involved in active play. Indirect free kick.',
      '3 in the goal area: three teammates in their own goal area while the ball is in play in their half. Indirect free kick.',
    ],
    sceneId: 'two-on-one',
  },
  {
    law: 12,
    key: 'fouls',
    group: 'restarts',
    title: 'Law 12 — Fouls and Misconduct',
    summary: [
      'Ramming, handball, use of the arms and the like bring a direct free kick — a penalty kick inside your own goal area. Dangerous play and impeding bring an indirect free kick.',
      'Tackling and charging are allowed frontguard to frontguard only; contact elsewhere is an offense (ramming, holding, clipping).',
      'Seven cautionable offenses (yellow) and eight sending-off offenses (red).',
    ],
    sceneId: 'ramming',
  },
  {
    law: 13,
    key: 'freekick',
    group: 'restarts',
    title: 'Law 13 — Free Kicks',
    summary: [
      'Direct kicks may score straight in; indirect kicks must touch another player first, signalled by a raised arm.',
      'Opponents stay 5m clear. From inside the defending goal area the ball is in play once it leaves that area.',
    ],
    sceneId: 'dfk',
  },
  {
    law: 14,
    key: 'penalty',
    group: 'restarts',
    title: 'Law 14 — The Penalty Kick',
    summary: [
      'Awarded for a direct-free-kick offense inside your own goal area while the ball is in play. A goal may be scored directly.',
      'Ball on the penalty mark, everyone else 5m back and behind it; the goalkeeper stays still behind the goal line. The kicker has 15 seconds.',
    ],
    sceneId: 'penalty',
  },
  {
    law: 15,
    key: 'kickin',
    group: 'restarts',
    title: 'Law 15 — The Kick-In',
    summary: [
      'When the whole ball crosses a touchline, to the opponents of whoever touched it last. A goal may be scored directly.',
      'If two opponents were touching it simultaneously along the touchline, it goes to the one on the outside keeping it in.',
    ],
    sceneId: 'kick-in',
  },
  {
    law: 16,
    key: 'goalkick',
    group: 'restarts',
    title: 'Law 16 — The Goal Kick',
    summary: [
      'When the attacking team last touched a ball that crossed the goal line without a goal. Taken from anywhere in the goal area.',
      'In play once it leaves the goal area directly; a goal may be scored, but only against the opponents.',
    ],
    sceneId: 'goal-kick',
  },
  {
    law: 17,
    key: 'corner',
    group: 'restarts',
    title: 'Law 17 — The Corner Kick',
    summary: [
      'When the defending team last touched a ball that crossed the goal line without a goal. Taken from the corner triangle.',
      'Opponents outside the goal area stay 5m clear; those inside must be behind the 1m encroachment mark. A goal may be scored directly.',
    ],
    sceneId: 'corner',
  },
  {
    law: 18,
    key: 'classification',
    group: 'officials',
    title: 'Law 18 — Classification',
    summary: [
      'Athletes are placed in two sport classes: PF1 (highly significant physical difficulty) and PF2 (moderate to mild).',
      'A team may not field more than two PF2 players in a match. Fitness, age, gender and skill are not factors.',
      'Protest and appeal procedures are in the separate FIPFA 2025 Classification Rules.',
    ],
  },
];
