// 규칙 화면 콘텐츠 — 영어판. `ruleTopics.ts` 의 `TOPICS_KO` 와 **블록 구조가 같아야 한다**
// (같은 순서·같은 장면·같은 슬롯) — 장면 배치·슬롯 개수 불변식이 로케일과 무관하게 성립해야 하고,
// 두 판이 갈라지면 어느 쪽이 정본인지 알 수 없게 된다.
//
// ⚠️ **이 파일은 한국어판의 번역이 아니다.** 정본은 `docs/RULES-FIPFA-2025.en.md` 이고, 그것은
// FIPFA 영어 원문에서 직접 쓴 것이다. 한국어 정본(`RULES-FIPFA-2025.md`)은 같은 원문의 **한국어
// 요약본**이라, 그것을 번역하면 영어 → 한국어 → 영어 되번역이 된다(PLAN-RULES-9CARDS §9.2).
// 그래서 문장이 한국어판과 1:1 로 대응하지 않는 곳이 있다 — 그게 정상이다.
//
// 카드 1·2 의 역사·의의 문장만 예외로 `docs/research/powerchair-football/` 에서 온다(규칙이 아니라
// 배경이라 정본 Laws 에 없다). 그쪽 규율도 같다: 본문을 확보한 출처만 쓴다.
import type { RuleTopic } from './ruleTopics.ts';

export const TOPICS_EN: readonly RuleTopic[] = [
  {
    key: 'intro',
    title: 'What is powerchair football?',
    tagline: 'Football played in a powerchair',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Powerchair football is football played in a powered wheelchair. The rules are close to football. The chair does the kicking instead of a foot.',
          'It is the first competitive team sport designed specifically for people who use a powered wheelchair.',
          'In the United States it is called "power soccer". The two names mean the same game.',
        ],
      },
      {
        kind: 'prose',
        heading: 'What you see on court',
        body: [
          'Four players a side, on an indoor basketball court.',
          'A frontguard is fitted to the front of the chair. That is what kicks the ball. It also protects the player’s feet and the chair.',
          'The player’s skill combines with the speed and power of the chair itself.',
        ],
      },
      {
        kind: 'prose',
        heading: 'The ball and the goals are different',
        body: [
          'The ball is 33cm across — one and a half times the diameter of an adult football (about 22cm).',
          'A smaller ball would wedge under a chair, which is dangerous. That is why it is this big.',
          'The goals have no net and no crossbar — a net would catch the wheels.',
        ],
      },
      {
        kind: 'scene-slot',
        note: [
          'sceneId `intro-tour` (기현님 챕터 1-1) 자리. 한국어판과 같은 자리에 둔다.',
          '장면은 로케일과 무관한 하나뿐이라(좌표 데이터) 영어판도 같은 sceneId 를 쓴다.',
        ],
      },
      {
        kind: 'prose',
        heading: 'Who plays',
        body: [
          'The sport is for people who use a powered wheelchair. A player must be able to control their chair safely.',
          'To play internationally an athlete is classified by how much their impairment affects performance. There are two classes: PF1 and PF2.',
          'PF1 is a player with highly significant physical difficulty. PF2 is moderate to mild.',
          'A team may not field more than two PF2 players in a match. So there are always at least two PF1 players on court.',
          'Classification is not a ranking of ability. Fitness, age, gender and skill are not factors in it.',
          'Players with cerebral palsy, muscular dystrophy, spinal cord injury and many other conditions play together.',
          'There is no gender restriction. Women and men play on the same team.',
        ],
      },
      {
        kind: 'prose',
        heading: 'One set of rules',
        body: [
          'The game began in France in the 1970s, made by teachers for students with severe disabilities.',
          'Around the same time a similar game appeared independently in Canada. Every country had its own rules.',
          'Between 2005 and 2006 the national bodies met and merged them into one set. FIPFA was founded in 2006.',
          'That international set is what this screen covers — the FIPFA Laws of the Game, approved April 2025.',
        ],
      },
      {
        kind: 'prose',
        heading: 'Where the sport stands',
        body: [
          'In principle the World Cup is held every four years. The first was Tokyo 2007; the most recent was Sydney 2023.',
          'More than thirty countries play, Korea among them.',
          'The International Paralympic Committee recognised the sport in 2009. It is still not a Paralympic medal sport.',
        ],
      },
    ],
    tutorialAnchor: undefined,
  },
  {
    key: 'purpose',
    title: 'The object of the game',
    tagline: 'Score more goals',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Move the ball over the opposing team’s goal line, and stop them doing the same. That is the whole of it.',
          'Two halves of 20 minutes. Whoever has scored more at the end wins. Equal scores are a draw.',
          'Half-time is at most 10 minutes.',
          'Time lost to substitutions, injuries and repairs is added back to that half.',
          'The teams change ends at half-time.',
        ],
      },
      {
        kind: 'prose',
        heading: 'A goal has to roll in',
        body: [
          'The whole ball must roll over the goal line between the two posts.',
          'If it is carried in rather than rolling, it is not a goal. Nor is it a goal if the ball is more than 50.8cm off the floor as it crosses.',
          'And not a goal if the scoring team broke a rule first.',
        ],
      },
      {
        kind: 'prose',
        heading: 'The chair moves the ball',
        body: [
          'The chair moves the ball. The frontguard pushes and kicks it.',
          'The ball must not be moved by a hand, a foot or the body. Accidental contact is fine.',
          'Handling the ball deliberately is a foul.',
          'No part of a chair may be built to trap or hold the ball.',
          'The ball is hard to lift, so the game happens on the floor.',
          'There is contact, but this is not a violent game. Movement and positioning decide it.',
        ],
      },
      {
        kind: 'scene-slot',
        note: [
          'sceneId `purpose-goal` (기현님 챕터 1-2) 자리. 한국어판과 같은 자리.',
        ],
      },
      {
        kind: 'prose',
        heading: 'The rules make the space',
        body: [
          'If the ball cannot be lifted, there is no way over a crowd. Space does not open by itself.',
          'When players bunch around the ball the game jams — the ball gets wedged between chairs and nobody can free it.',
          'So the rules spread the players out. Two rules limit where players may be: [Goal area violation] and [2-on-1 violation]. The 2-on-1 rule exists to keep the space around the ball open.',
        ],
      },
      {
        kind: 'prose',
        heading: 'When the ball stops, when a foul happens',
        body: [
          'A stopped ball is not simply kicked again.',
          'How play restarts depends on whether the ball left the field, or stopped for some other reason. Eight ways are gathered in the [Restarts] card.',
          'A foul gives the other team a kick — a direct free kick, an indirect free kick, or a penalty kick. Serious ones bring a yellow or red card.',
          'Which foul brings which kick is in the [Other offenses] card.',
        ],
      },
      {
        kind: 'prose',
        heading: 'What the game leaves behind',
        body: [
          'People with severe disabilities experience loneliness and social isolation at higher rates than others.',
          'This sport gives them a team. Players describe friendships that reach beyond the game itself, and chances to mentor newer players and to speak for the sport.',
          'It is not only physical. Strategy and persistence are part of it.',
          'It may look as though only a joystick moves, but heart rate during play is measurably higher than at rest.',
          'In one study the players’ physical quality-of-life scores were higher than the general population’s. It was a small study of ten players.',
          'The barriers are just as clear: transport, too few teams, equipment, volunteers, and ableist attitudes.',
          'Players also named a shortage of referees and coaches who know the rules.',
        ],
      },
    ],
  },
  {
    key: 'basics',
    title: 'Players, court, ball, equipment',
    tagline: 'A 28×15m court, four a side',
    blocks: [
      {
        kind: 'prose',
        heading: 'The court',
        body: [
          'The standard size is 28×15m — a basketball court. Sanctioned international events are expected to use the maximum, 30×18m.',
          'The floor must be hard, smooth and level. Wood or an artificial surface is recommended; concrete and tarmac are avoided.',
          'Two posts 6m apart at the centre of each goal line make the goal. The 8m wide, 5m deep area in front of it is the goal area. The penalty mark is 3.5m out from the goal line.',
        ],
      },
      { kind: 'figure', figureId: 'court' },
      { kind: 'scene', sceneId: 'field-tour' },
      {
        kind: 'prose',
        heading: 'Players',
        body: [
          'A team has at most four players, one of whom must be the goalkeeper.',
          'With fewer than two, a match cannot start or continue.',
        ],
      },
      { kind: 'scene', sceneId: 'lineup' },
      {
        kind: 'prose',
        heading: 'The ball',
        body: [
          'Inflated so that it does not bounce much, yet a powerchair cannot ride over it. That is all the Laws say about the ball — no size or weight.',
          'A FIPFA-approved ball is 33cm across. That figure comes from FIPFA equipment guidance, not from the Laws themselves.',
        ],
      },
      { kind: 'figure', figureId: 'ball' },
      {
        kind: 'prose',
        heading: 'Equipment',
        body: [
          'A powerchair must have four or more wheels. Top speed during a match is 10 kph, forward and reverse.',
          'A lap seatbelt, a frontguard and lateral supports (armrests) on both sides are required. No part of the chair, or of the player, may overhang the front or rear of the chair base.',
        ],
      },
    ],
    tutorialAnchor: 'rules-card',
  },
  {
    key: 'out-of-play',
    title: 'In, out, and scoring',
    tagline: 'Lines, goals, set ball',
    blocks: [
      {
        kind: 'prose',
        body: [
          'The whole ball must be past the line to be out. If any part of it is still on the line, it is still in.',
          'The same applies on the ground and in the air.',
          'It is also out if it stays wedged between opponents for more than 5 seconds.',
          'And out if it rises more than 50.8cm off the floor and the referee judges that dangerous. If the referee does not, play continues.',
          'When the ball goes out, play restarts with a kick-in, a goal kick or a corner kick — depending on which line it crossed and who touched it last. See the [Restarts] card.',
        ],
      },
      { kind: 'scene', sceneId: 'inout' },
      {
        kind: 'prose',
        heading: 'Scoring',
        body: ['A goal follows the same principle: the whole ball must roll fully over the goal line between the posts.'],
      },
      { kind: 'scene', sceneId: 'scoring' },
      {
        kind: 'prose',
        heading: 'Set ball',
        body: [
          'The restart used when play is stopped for a reason the Laws do not name elsewhere. A ball bursting in play is one example.',
          'The referee places the ball where play stopped. One player from each team takes position within 30cm of it, each the same distance away, both facing the ball. Everyone else stays 3m back.',
          'Play restarts on the referee’s signal.',
        ],
      },
      { kind: 'scene', sceneId: 'set-ball' },
    ],
  },
  {
    key: 'restarts',
    title: 'Restarts',
    tagline: 'All of them in one table',
    blocks: [
      {
        kind: 'prose',
        body: [
          'When the ball stops, there is a set way to start it again. Seven are gathered in the table below — eight, counting the set ball you just saw.',
          'Pick one from the table to see its scene.',
          'One rule is common to all seven. Whoever takes the kick must not touch the ball again before another player does. Breaking it gives the opponents an indirect free kick where the second touch happened. At a penalty kick a second touch with the hands is treated more severely still — a direct free kick.',
        ],
      },
      {
        kind: 'prose',
        heading: 'Distance',
        body: [
          'For most restarts opponents must be 5m clear of the ball. For a set ball it is 3m, and that applies to everyone except the two players facing each other over it.',
          'Not respecting that distance is a cautionable offense.',
        ],
      },
      { kind: 'figure', figureId: 'distance' },
      {
        kind: 'prose',
        heading: 'The goalkeeper is exempt from the 5m',
        body: [
          'At a free kick or corner kick taken by the attacking team, a goalkeeper who is fully behind their own goal line between the posts does not have to keep the 5m.',
          'Pushing back the one player guarding the goal would empty it.',
          'Every other defender still keeps the 5m.',
        ],
      },
      { kind: 'scene', sceneId: 'gk-behind-line' },
      { kind: 'restart-table' },
      {
        kind: 'prose',
        heading: 'Who gets the kick-in when both touched the ball?',
        body: [
          'When the whole ball crosses a touchline it is a kick-in, taken by the opponents of whoever touched it last.',
          'If two opposing players were touching the ball at the same time while driving along the touchline, the kick-in goes to the one on the outside trying to keep it in.',
        ],
      },
      { kind: 'scene', sceneId: 'contested-touch' },
    ],
  },
  {
    key: 'goal-area',
    title: 'Goal area violation',
    tagline: 'Two in the area, not three',
    blocks: [
      {
        kind: 'prose',
        body: [
          'It is a violation to have three players of the same team inside their own goal area at once — but only while the ball is in play in their half.',
          'The goalkeeper counts towards that number. The limit is two, goalkeeper included.',
          'The opponents get an indirect free kick there. If it denied a clear scoring chance, a card can follow.',
        ],
      },
      { kind: 'scene', sceneId: 'three-in-area' },
      {
        kind: 'prose',
        heading: 'Behind the goal counts too',
        body: [
          'This app also counts a teammate who has gone fully over the goal line, behind the goal.',
          'That is not in the Laws. Without it, a goalkeeper could get around the limit simply by backing out behind the goal.',
        ],
      },
      {
        kind: 'prose',
        heading: 'When it becomes a penalty kick',
        body: [
          'A serious foul inside your own goal area — ramming an opponent, handling the ball, and the like — is a penalty kick. Only while the ball is in play.',
        ],
      },
    ],
  },
  {
    key: 'two-on-one',
    title: '2-on-1 violation',
    tagline: 'Two on one within 3m',
    blocks: [
      {
        kind: 'prose',
        body: [
          'While the ball is in play, two teammates and one opponent all within 3m of it makes a 2-on-1.',
          'It is only a violation if all three are actually involved in active play. Simply being within 3m is not yet a violation. The referee judges that.',
          'Involvement is not only touching the ball. Blocking an opponent’s path counts, and so does gaining an advantage from a ball that rebounds off a post or off an opponent.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one' },
      { kind: 'scene', sceneId: 'two-on-one-active' },
      {
        kind: 'prose',
        heading: 'When it is not a 2-on-1',
        body: [
          'Not a 2-on-1 if one of the two teammates is the goalkeeper inside their own goal area.',
          'Touching the goal area line at all counts as being inside it — lines belong to the area they bound. Fully outside, the exemption is gone.',
          'Not a 2-on-1 if there is no opponent within 3m of the ball at all.',
          'This app also excludes a goalkeeper who has gone fully over the goal line behind the goal — that part is the app’s own, not in the Laws.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one-gk' },
      {
        kind: 'prose',
        heading: 'Only the goalkeeper is exempt',
        body: [
          'The goalkeeper being exempt does not make the whole team exempt.',
          'Leave the goalkeeper out, and if two teammates and one opponent are still involved within 3m of the ball, that is a 2-on-1 in its own right.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one-gk-only' },
      { kind: 'scene', sceneId: 'two-on-one-open' },
      {
        kind: 'prose',
        heading: 'Leaving the court to avoid it',
        body: [
          'Driving off the court to avoid a 2-on-1 is allowed, as long as it is for the natural flow of play.',
          'The player must not re-enter until that phase of play has ended, and must come back near where they left. It must not be dangerous, and it must not become a habit.',
          'Otherwise it is unsporting behaviour and a caution.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one-escape' },
      { kind: 'prose', body: ['When it is a violation, the opponents get an indirect free kick at that spot.'] },
    ],
  },
  {
    key: 'fouls',
    title: 'Other offenses',
    tagline: 'Fouls bring free kicks; worse brings cards',
    blocks: [
      {
        kind: 'prose',
        heading: 'Direct free kick offenses',
        body: [
          'Ramming an opponent is an offense when it is careless or reckless, or uses excessive force. Together with holding an opponent with the chair, deliberate handball, using the arms to push, hold or strike (attempts included), spitting, and denying a scoring chance, these six give the opponents a direct free kick.',
          'If any of the six happens inside your own goal area while the ball is in play, it is a penalty kick instead.',
        ],
      },
      {
        kind: 'prose',
        heading: 'Where contact is allowed',
        body: [
          'Tackling and fair charging are allowed — but only frontguard against frontguard.',
          'Contact with any other part of the chairs is an offense.',
          'Ramming is driving deliberately into an opponent, with or without the ball, at speed or with excessive force. It makes no difference whether they were moving or still.',
          'Holding is deliberately restricting the movement of an opponent’s chair.',
          'Clipping is a form of holding: deliberately contacting the side or back of an opponent’s chair to impede them.',
        ],
      },
      { kind: 'scene', sceneId: 'ramming' },
      {
        kind: 'prose',
        heading: 'Indirect free kick offenses',
        body: [
          'A player other than the goalkeeper crossing their own goal line completely (unless pushed by an opponent), a third player entering their own goal area, playing in a dangerous manner, impeding an opponent, deliberately moving or knocking over a goalpost — these give the opponents an indirect free kick.',
          'So does any other offense for which play is stopped to caution or send off a player.',
          'A direct free kick can score straight in. An indirect one must touch another player first.',
        ],
      },
      {
        kind: 'prose',
        heading: 'The spin kick is not banned',
        body: [
          'A spin kick sends the ball farther and faster than driving straight at it. The Laws do not prohibit it.',
          'But for part of the turn the kicker cannot see the ball, or anyone coming towards it. If that happens close to an opponent, it can be judged as playing in a dangerous manner.',
        ],
      },
      { kind: 'scene', sceneId: 'spin-kick' },
      { kind: 'card-list' },
      {
        kind: 'prose',
        body: [
          'Cards are not only for players on court — substitutes and team officials in the technical area receive them too.',
          'If the offender cannot be identified, the senior coach in the technical area takes the sanction.',
          'The referee’s disciplinary authority runs from arriving at the venue until leaving it after the final whistle.',
        ],
      },
    ],
  },
  {
    key: 'rulebook',
    title: 'The official rule book',
    tagline: 'FIPFA, 18 Laws, condensed',
    blocks: [
      {
        kind: 'prose',
        body: [
          'The 18 Laws below are condensed from the international rules.',
          'This is not a full translation. For the exact wording, read the official PDF.',
          'Official PDF: https://fipfa.org/wp-content/uploads/2025/06/FIPFA-Laws-of-the-Game-2025.pdf',
          'Law 18 classification detail is in a separate document, the FIPFA 2025 Classification Rules: https://fipfa.org/wp-content/uploads/2026/04/FIPFA-2025-Classification-Rules.pdf',
        ],
      },
      { kind: 'law-index' },
    ],
    tutorialAnchor: 'rules-appendix',
  },
];
