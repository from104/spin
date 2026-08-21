// 규칙 화면 주제별 재설계(2026-08-22)의 콘텐츠 모델 — docs/PLAN-RULES-REDESIGN.md §1.
//
// 18개조 사전식 구조("제13조가 뭐지")를 주제별 학습 구조("킥인이랑 코너킥이 뭐가 다르지")로
// 재편한다. `ruleContent.ts`(18개조 원문 압축판, 부록 전용)는 그대로 남지만 화면의 주 진입점은
// 이 파일이 된다 — `RuleTopic.blocks` 하나가 산문·도해·장면·표·카드 목록·부록을 순서대로
// 엮는다.
//
// `ruleContentFor(locale)` 와 같은 패턴: 지금은 모든 로케일이 ko 배열을 반환한다. 규칙 콘텐츠는
// ko 전용(2026-08-21 결정), UI 라벨만 en/ja 타입이 강제된다.
import type { Locale } from '../../i18n/locale.ts';
import type { RuleFigureId } from './figures/ids.ts';
import type { RuleSceneId } from './ruleScenes.ts';

export type RuleTopicKey = 'basics' | 'restarts' | 'out-of-play' | 'goal-area' | 'two-on-one' | 'fouls' | 'contested' | 'rulebook';

export const RULE_TOPIC_KEYS: readonly RuleTopicKey[] = ['basics', 'restarts', 'out-of-play', 'goal-area', 'two-on-one', 'fouls', 'contested', 'rulebook'];

export type RuleBlock =
  | { kind: 'prose'; heading?: string; body: readonly string[] }
  | { kind: 'figure'; figureId: RuleFigureId }
  | { kind: 'scene'; sceneId: RuleSceneId }
  /** 재개 7종 비교표 — 데이터는 `restartTable.ts` 단일 출처, 주제당 최대 1개. */
  | { kind: 'restart-table' }
  /** 경고 7종·퇴장 8종 — 데이터는 이 파일의 `MISCONDUCT_CARDS`, 주제당 최대 1개. */
  | { kind: 'card-list' }
  /** 부록: 18개조 압축표 — 데이터는 `ruleContentFor(locale)`, 주제당 최대 1개. */
  | { kind: 'law-index' };

export interface RuleTopic {
  key: RuleTopicKey;
  title: string;
  tagline: string;
  blocks: readonly RuleBlock[];
}

export interface MisconductCard {
  kind: 'caution' | 'sendingOff';
  text: string;
}

/** 제12조 경고(옐로카드) 7종 + 퇴장(레드카드) 8종 — 도해 없이 사유 요약만(2026-08-22 결정). */
export const MISCONDUCT_CARDS: readonly MisconductCard[] = [
  { kind: 'caution', text: '비신사적 행위' },
  { kind: 'caution', text: '말이나 행동으로 항의' },
  { kind: 'caution', text: '지속적으로 규칙 위반' },
  { kind: 'caution', text: '재개를 지연시킴' },
  { kind: 'caution', text: '코너킥·킥인·프리킥·골킥·세트볼 재개 거리 미준수' },
  { kind: 'caution', text: '주심 허락 없이 경기장에 들어오거나 재입장' },
  { kind: 'caution', text: '주심 허락 없이 고의로 경기장을 벗어남' },
  { kind: 'sendingOff', text: '심각한 반칙 플레이' },
  { kind: 'sendingOff', text: '폭력적 행위' },
  { kind: 'sendingOff', text: '상대나 다른 사람에게 침을 뱉음' },
  { kind: 'sendingOff', text: '고의 핸드볼로 득점(또는 명백한 기회)을 저지' },
  { kind: 'sendingOff', text: '명백한 득점 기회를 프리킥·페널티킥 대상 반칙으로 저지' },
  { kind: 'sendingOff', text: '골라인을 완전히 넘어가서(GK 제외) 상대의 득점을 막음' },
  { kind: 'sendingOff', text: '모욕적·경멸적·욕설성 언행이나 제스처' },
  { kind: 'sendingOff', text: '한 경기에서 두 번째 경고를 받음' },
];

const TOPICS_KO: readonly RuleTopic[] = [
  {
    key: 'basics',
    title: '기본 규칙',
    tagline: '코트·선수·공·장비',
    blocks: [
      {
        kind: 'prose',
        heading: '코트',
        body: [
          '기본 규격은 28×15m(농구 코트 표준)입니다. 국제대회 규정 범위는 길이 25~30m·너비 14~18m이고, 국제 공인 대회는 최대 규격(30×18)을 권장합니다.',
          '라인 폭은 최소 5cm이고, 표면은 단단하고 평탄한 목재·인조 재질을 권장하며 콘크리트·아스팔트는 지양합니다.',
        ],
      },
      { kind: 'figure', figureId: 'court' },
      { kind: 'scene', sceneId: 'field-tour' },
      {
        kind: 'prose',
        heading: '선수',
        body: [
          '한 팀은 최대 4명(그중 1명은 반드시 골키퍼)입니다. 어느 팀이든 2명 미만이 되면 경기를 시작하거나 계속할 수 없습니다.',
          '선수는 자기 체어를 충분히 통제할 수 있어야 하며, 통제력이 부족하면 주심이 출전을 제지할 수 있습니다.',
        ],
      },
      { kind: 'scene', sceneId: 'lineup' },
      {
        kind: 'prose',
        heading: '공',
        body: [
          '공은 구형이고, 지나치게 튀지 않으면서 파워체어가 타고 넘지 못할 정도의 공기압을 씁니다. FIPFA 승인 공의 실물 지름은 33cm(13인치)로, 축구공 5호(약 22cm)의 1.5배입니다.',
          '경기 중 공이 파열되면 손상 지점에서 세트볼로 재개하고, 재개 절차가 진행되는 동안(아직 인플레이 전) 파열되면 그 재개를 그대로 다시 합니다. 공은 주심의 승인 없이는 교체할 수 없습니다.',
        ],
      },
      { kind: 'figure', figureId: 'ball' },
      {
        kind: 'prose',
        heading: '장비',
        body: [
          '전동휠체어는 바퀴 4개 이상이어야 하고, 경기 중 최고 속도는 전진·후진 공통 10km/h(6.2mph)로 제한됩니다.',
          '랩 시트벨트·프런트가드·좌우 측면지지대가 기본 필수 장비이고, 체어·시트·선수 신체 어느 부분도 밑판 앞뒤 경계를 넘으면 안 됩니다.',
        ],
      },
      { kind: 'figure', figureId: 'equipment' },
    ],
  },
  {
    key: 'restarts',
    title: '경기 재개 한눈에',
    tagline: '7가지 재개를 표 하나로',
    blocks: [
      {
        kind: 'prose',
        body: [
          '정지된 공이 다시 살아나는 방법은 7가지입니다. 아래 표에서 재개 하나를 골라 보드로 확인해 보세요.',
          '7가지 전부에 공통된 규칙이 하나 있습니다 — 킥커는 공이 다른 선수에게 닿기 전 두 번째로 공을 만지면 안 됩니다(페널티킥만 손을 쓴 경우 예외). 어기면 위반 지점에서 상대 팀에 간접프리킥이 주어집니다.',
        ],
      },
      { kind: 'restart-table' },
    ],
  },
  {
    key: 'out-of-play',
    title: '아웃 오브 플레이',
    tagline: '라인·5m·세트볼·투터치',
    blocks: [
      {
        kind: 'prose',
        heading: '인/아웃',
        body: ['공은 지면이든 공중이든 전체가 라인을 완전히 벗어나야 아웃오브플레이입니다. 라인에 걸쳐 있으면 아직 인플레이입니다.'],
      },
      { kind: 'scene', sceneId: 'inout' },
      {
        kind: 'prose',
        heading: '득점',
        body: ['득점도 같은 원칙입니다 — 공 전체가 굴러서(들리거나 실려서가 아니라) 골라인을 완전히 통과해야 합니다. 바닥에서 50.8cm(20in) 이상 떠서 넘으면 무효입니다.'],
      },
      { kind: 'scene', sceneId: 'scoring' },
      {
        kind: 'prose',
        heading: '거리 — 5m와 3m',
        body: [
          '대부분의 재개는 상대가 공에서 5m 이상 떨어져야 합니다. 예외가 세트볼인데, 세트볼은 참여하지 않는 선수 전원이 3m 밖에 있으면 됩니다 — 대신 참여 2명은 공에서 30cm 이내로 붙습니다.',
        ],
      },
      { kind: 'figure', figureId: 'distance' },
      {
        kind: 'prose',
        heading: '세트볼(Set Ball)',
        body: [
          '세트볼은 인플레이 중 이 문서 다른 곳에 명시되지 않은 사유로 경기를 멈춰야 할 때 쓰는 재개입니다 — 공 파열은 그 사례 중 하나일 뿐입니다.',
          '주심이 경기가 멈춘 지점에 공을 놓으면, 각 팀 1명씩 공에서 30cm 이내에 같은 거리로 서서 터치라인과 평행하게 공을 바라보며 대기합니다. 그 외 전원은 3m 밖에 있어야 합니다.',
          '신호 후 공이 닿기 전 참여 선수가 체어를 돌리면 상대 팀에 그 지점에서 간접프리킥이 주어집니다. 중단 지점이 골에어리어 안이면 골에어리어 라인 위 최근접점에 놓습니다.',
        ],
      },
      { kind: 'scene', sceneId: 'set-ball' },
      {
        kind: 'prose',
        heading: '직접 vs 간접',
        body: [
          '직접프리킥은 상대 골로 직접 들어가면 득점입니다. 간접프리킥은 주심이 한 팔을 머리 위로 곧게 들어 표시하며, 다른 선수를 거쳐야만 득점이 인정됩니다.',
        ],
      },
      { kind: 'scene', sceneId: 'dfk' },
      { kind: 'scene', sceneId: 'ifk' },
    ],
  },
  {
    key: 'goal-area',
    title: '골에어리어 반칙',
    tagline: '3인 진입·PK 조건·GK',
    blocks: [
      {
        kind: 'prose',
        heading: '골에어리어 3인',
        body: [
          '공이 자기 진영에서 인플레이인 동안 같은 팀 선수 3명 이상이 동시에 자기 골에어리어 안에 있으면 위반입니다. 상대 팀에 위반 지점에서 간접프리킥이 주어지고, 명백한 득점 기회를 저지했다면 카드까지 적용될 수 있습니다.',
        ],
      },
      { kind: 'scene', sceneId: 'three-in-area' },
      {
        kind: 'prose',
        heading: '자기 에어리어 안 중대 반칙 → 페널티킥',
        body: ['자기 팀 골에어리어 안에서(공이 인플레이인 동안) 직접프리킥 대상 반칙을 저지르면 페널티킥이 주어집니다.'],
      },
      { kind: 'scene', sceneId: 'penalty' },
      {
        kind: 'prose',
        heading: 'GK 아닌 선수의 골라인 통과',
        body: ['골키퍼가 아닌 선수가 경기 중 자기 골라인(골포스트 사이)을 완전히 넘어가면(상대에게 밀려서가 아닐 때) 간접프리킥입니다. 이걸로 상대의 득점을 막으면 퇴장입니다.'],
      },
      {
        kind: 'prose',
        heading: '골에어리어 안 프리킥 특칙',
        body: [
          '수비 팀의 프리킥은 코트 안 어디서나 찰 수 있고, 상대는 5m 이상 + 공이 인플레이 될 때까지 골에어리어 밖에 있어야 하며, 공이 골에어리어를 직접 벗어나야 인플레이입니다. 공격 팀의 간접프리킥은 별도 위치 규정을 따릅니다.',
        ],
      },
    ],
  },
  {
    key: 'two-on-one',
    title: '2-on-1',
    tagline: '3m 안 2대1, 예외까지',
    blocks: [
      {
        kind: 'prose',
        heading: '정의',
        body: [
          '공이 인플레이인 동안, 같은 팀 선수 2명과 상대 선수 1명이 공에서 3m 이내에 함께 있으면 2-on-1입니다.',
          '다만 셋 모두가 액티브 플레이(패스·터치된 공을 만짐 / 상대 방해 / 그 위치에 있음으로써 이득)에 관여해야만 위반이 성립합니다 — 그냥 3m 안에 모여 있는 것만으로는 아직 반칙이 아닙니다.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one-active' },
      { kind: 'scene', sceneId: 'two-on-one' },
      {
        kind: 'prose',
        heading: '예외 둘',
        body: ['둘 중 한 명이 자기 골에어리어 안의 골키퍼면 2-on-1이 아닙니다. 공 3m 안에 상대가 아예 없어도 2-on-1이 아닙니다.'],
      },
      { kind: 'scene', sceneId: 'two-on-one-gk' },
      { kind: 'scene', sceneId: 'two-on-one-open' },
      {
        kind: 'prose',
        heading: '회피 이탈',
        body: [
          '회피 목적으로 필드(터치라인)를 벗어나는 것은 ①플레이의 자연스러운 흐름이고 ②그 페이즈가 바뀌기 전에 재진입하지 않고 ③원래 나간 지점 근처로 재진입하며 ④안전을 해치지 않고 ⑤상습적이지 않으면 허용됩니다. 어기면 비신사적 행위로 경고입니다.',
        ],
      },
      { kind: 'scene', sceneId: 'two-on-one-escape' },
      {
        kind: 'prose',
        heading: '위반 시',
        body: ['위반이 인정되면 상대 팀에게 위반 지점에서 간접프리킥이 주어집니다.'],
      },
    ],
  },
  {
    key: 'fouls',
    title: '그 외의 반칙',
    tagline: '램핑·회전킥·카드',
    blocks: [
      {
        kind: 'prose',
        heading: '직접프리킥 대상',
        body: [
          '부주의하거나 무모하거나 과도한 힘으로 상대를 들이받거나 시도(램핑), 체어로 상대를 붙듦, 고의 핸드볼, 팔로 밀거나 붙잡거나 때림, 침 뱉기, 득점 기회 저지 — 이 여섯 중 하나면 상대 팀에 직접프리킥이고, 자기 골에어리어 안이면 페널티킥입니다.',
        ],
      },
      { kind: 'scene', sceneId: 'ramming' },
      {
        kind: 'prose',
        heading: '회전킥에 관하여',
        body: [
          '회전킥은 금지되지 않습니다 — 공을 정면으로 차는 것보다 더 멀리, 더 빠르게 보내는 기술입니다.',
          '다만 회전하는 동안은 일부 구간에서 공이나 다가오는 상대가 안 보일 수 있어, 그 상황이 위험한 방법으로 플레이한 것으로 판정되면 간접프리킥 대상이 됩니다.',
        ],
      },
      { kind: 'scene', sceneId: 'spin-kick' },
      {
        kind: 'prose',
        heading: '간접프리킥 대상',
        body: [
          '골키퍼가 아닌 선수의 자기 골라인 통과, 골에어리어 3인째 진입, 위험한 방법으로 플레이함, 상대의 진행 방해, 고의로 골대(파일런/콘)를 옮기거나 넘어뜨림 — 이 다섯이 간접프리킥 대상입니다.',
        ],
      },
      { kind: 'card-list' },
      {
        kind: 'prose',
        heading: '징계 절차',
        body: ['반칙자를 특정할 수 없으면 기술 구역의 선임 코치가 제재를 승계합니다. 주심의 징계 권한은 경기장 도착 순간부터 최종 휘슬 후 퇴장할 때까지 유효합니다.'],
      },
    ],
  },
  {
    key: 'contested',
    title: '경합: 누구 터치아웃?',
    tagline: '동시 터치 판정',
    blocks: [
      {
        kind: 'prose',
        body: ['공 전체가 터치라인을 넘으면 마지막으로 건드린 팀의 상대에게 킥인이 주어지는 것이 기본입니다.'],
      },
      { kind: 'scene', sceneId: 'contested-touch' },
      {
        kind: 'prose',
        heading: '판정',
        body: ['터치라인을 따라 달리며 상대 둘이 동시에 공을 건드리고 있었다면, 바깥쪽에서 공을 라인 안에 묶어두려던 선수 쪽에 킥인이 주어집니다.'],
      },
    ],
  },
  {
    key: 'rulebook',
    title: '공식 룰 북',
    tagline: 'FIPFA 18개조 압축 참조',
    blocks: [
      {
        kind: 'prose',
        body: [
          'FIPFA(Fédération Internationale de Powerchair Football Association) Laws of the Game, 2025년 4월 승인판을 한국어로 요약·재서술한 것입니다. 전문 번역이 아니며, 조항 전문 대조가 필요하면 원문 PDF를 확인하세요.',
        ],
      },
      { kind: 'law-index' },
    ],
  },
];

export function ruleTopicsFor(_locale: Locale): readonly RuleTopic[] {
  return TOPICS_KO;
}
