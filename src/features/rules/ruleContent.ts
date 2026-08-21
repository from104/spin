// 규칙 화면(2026-08-21 신설)의 조항 텍스트 — 단일 출처.
//
// 원문은 docs/RULES-FIPFA-2025.md(FIPFA Laws of the Game, 2025-04 승인판 한국어 요약)다.
// 이 파일은 그 요약을 화면에 뿌릴 수 있는 구조로 접은 것일 뿐, 새 사실을 만들지 않는다 —
// 수치·문구가 어긋나면 rulesDocTruth.test.ts 가 잡는다(§7 계획).
//
// locale 인자는 지금은 안 쓴다: 콘텐츠는 한국어만 준비됐다(2026-08-21 기현님 결정 — "한국어
// 먼저"). en/ja 조항 본문이 생기면 이 함수 안에서 분기하면 되고, 화면 쪽 코드는 바뀌지 않는다
// — 그래서 인자를 미리 받아 둔다(나중에 시그니처를 바꾸면 호출부 전체가 깨진다).
import type { Locale } from '../../i18n/locale.ts';
import type { RuleSceneId } from './ruleScenes.ts';

export type RuleLawGroup = 'basics' | 'play' | 'restarts' | 'officials';

/** 목록 그룹 헤더 라벨. 조항 본문과 같은 이유로 ko 전용이다(2026-08-21 결정) — en/ja 화면
 *  라벨(SCREEN_* in screens.ts)과 달리 이 화면 안쪽 내용은 아직 3언어 대상이 아니다. */
export const RULE_GROUP_ORDER: readonly RuleLawGroup[] = ['basics', 'play', 'restarts', 'officials'];

export const RULE_GROUP_LABELS: Record<RuleLawGroup, string> = {
  basics: '기본',
  play: '경기 진행',
  restarts: '반칙·재시작',
  officials: '심판·분류',
};

export interface RuleLaw {
  /** FIPFA 원문 조항 번호(1~18). */
  law: number;
  /** 딥링크·테스트 식별용 영문 키. URL 은 이 값이 아니라 `law` 숫자를 쓴다(routes.ts) —
   *  키는 코드 안에서만 쓰는 사람이 읽을 이름이다. */
  key: string;
  group: RuleLawGroup;
  title: string;
  /** 요약 불릿. 한 항목이 한 문장(또는 밀접한 두 문장)을 넘지 않게 쓴다 — 화면이 스크롤
   *  목록이라 문단이 길면 훑어보기가 안 된다. */
  summary: string[];
  /** 보드 애니메이션 장면(있으면). 한 조항에 장면이 둘 이상 있을 수 있는데(제11조의
   *  2-on-1/골에어리어 3인, 제13조의 직접/간접) 이 필드는 **단일 값**이다 — 대표 장면
   *  하나만 가리키고, 나머지는 `ruleScenes.ts` 의 `buildRuleScene`/`RULE_SCENE_IDS` 로는
   *  여전히 존재하되 이 목록에서 직접 링크되지 않는다. 재생 조립 커밋(§C)에서 "관련 장면"
   *  UI가 생기면 그때 다중화를 고려한다 — 지금은 텍스트 목록 하나당 장면 하나로 충분하다. */
  sceneId?: RuleSceneId;
}

const KO_RULE_LAWS: readonly RuleLaw[] = [
  {
    law: 1,
    key: 'field',
    group: 'basics',
    title: '제1조 — 필드',
    summary: [
      '기본 규격 28m×15m(농구 코트). 길이 25~30m·너비 14~18m 범위에서 국제 대회는 최대 규격을 쓴다.',
      '표면은 단단하고 평탄해야 한다 — 목재·인조 재질 권장, 콘크리트·아스팔트는 지양.',
      '골에어리어는 폭 8m×깊이 5m, 페널티 마크는 골라인에서 3.5m, 골대 간격은 6m다.',
      '코너 트라이앵글은 각 코너에서 1m, 코너킥 침범 마크는 골포스트 안쪽 1m 지점에 둔다.',
    ],
    sceneId: 'field-tour',
  },
  {
    law: 2,
    key: 'ball',
    group: 'basics',
    title: '제2조 — 공',
    summary: [
      '구형이며, 지나치게 튀지 않되 체어 바퀴가 타고 넘지 못할 압력을 쓴다.',
      '경기 중 공이 파열·손상되면 경기를 멈추고, 손상된 지점에서 세트볼로 재개한다.',
    ],
  },
  {
    law: 3,
    key: 'players',
    group: 'basics',
    title: '제3조 — 선수 인원',
    summary: [
      '한 팀 최대 4명(그중 1명은 반드시 골키퍼). 2명 미만이면 경기를 시작·속행할 수 없다.',
      '체어를 충분히 통제하지 못하는 선수는 주심이 출전을 제지할 수 있다.',
      '공식 대회는 선수 4명 + 교체 최대 4명. 팀시트에 없는 선수는 참가할 수 없다.',
    ],
    sceneId: 'lineup',
  },
  {
    law: 4,
    key: 'equipment',
    group: 'basics',
    title: '제4조 — 선수 장비',
    summary: [
      '기본 장비: 팀 통일 저지·하의, 전동휠체어, 랩 시트벨트, 프런트가드, 앞뒤 등번호.',
      '전동휠체어는 4바퀴 이상이어야 하며(3·4륜 스쿠터 불가), 경기 중 최고 속도는 전후진 공통 10km/h로 제한된다.',
      '배낭 등 부착 금지(의료 필수 장비는 예외), 다른 체어와 얽힐 날카로운 돌출부 금지.',
      '체어 어느 부분도 공을 가두거나 붙잡도록 만들면 안 되고, 오히려 바퀴가 공을 타넘지 못하게 막는 부착물을 권장한다.',
    ],
  },
  {
    law: 5,
    key: 'referee',
    group: 'officials',
    title: '제5조 — 주심',
    summary: [
      '경기의 규칙 적용을 책임진다. 세부 판정·신호 절차는 원문을 따른다.',
      '징계 권한은 경기장에 들어온 순간부터 최종 휘슬 후 퇴장할 때까지 유효하다.',
    ],
  },
  {
    law: 6,
    key: 'assistants',
    group: 'officials',
    title: '제6조 — 부심',
    summary: ['주심을 보조하는 부심을 둘 수 있다. 구체적 임무·신호 체계는 원문을 따른다.'],
  },
  {
    law: 7,
    key: 'duration',
    group: 'play',
    title: '제7조 — 경기 시간',
    summary: [
      '전·후반 각 20분(사전 합의로 변경 가능, 대회 규정 범위 안에서만).',
      '하프타임 휴식은 최대 10분. 지연된 시간은 각 피리어드에 보상한다.',
    ],
  },
  {
    law: 8,
    key: 'kickoff',
    group: 'play',
    title: '제8조 — 시작과 재개',
    summary: [
      '경기 시작·득점 후·후반 시작·연장 시작마다 킥오프로 재개한다. 킥오프에서 직접 득점이 인정된다.',
      '전원 자기 진영에, 상대는 공에서 5m 이상, 공은 센터마크에 정지한 상태로 시작한다.',
      '킥커는 공이 다른 선수에 닿기 전 두 번째로 만지면 안 된다(위반 시 상대에게 간접프리킥).',
    ],
    sceneId: 'kickoff',
  },
  {
    law: 9,
    key: 'inout',
    group: 'play',
    title: '제9조 — 인/아웃 플레이',
    summary: ['공 전체가 라인을 완전히 벗어나야(지면이든 공중이든) 아웃오브플레이다. 그 외 모든 순간은 인플레이.'],
    sceneId: 'inout',
  },
  {
    law: 10,
    key: 'scoring',
    group: 'play',
    title: '제10조 — 득점 방법',
    summary: [
      '공 전체가 굴러서(들리거나 실려서가 아니라) 골포스트 사이 골라인을 완전히 통과해야 득점이다.',
      '공이 바닥에서 50.8cm 이상 떠서 골라인을 넘으면 득점이 무효가 된다.',
      '더 많은 골을 넣은 팀이 승리, 동수면 무승부.',
    ],
    sceneId: 'scoring',
  },
  {
    law: 11,
    key: 'position',
    group: 'play',
    title: '제11조 — 필드 포지션(2-on-1·골에어리어 3인)',
    summary: [
      '2-on-1: 인플레이 공 3m 안에 같은 팀 2명+상대 1명이 있고, 그 셋 모두가 액티브 플레이에 관여하면 반칙 — 상대에게 간접프리킥.',
      '골키퍼가 자기 골에어리어 안에 있거나 3m 안에 상대가 아예 없으면 2-on-1이 아니다.',
      '회피 목적의 필드 이탈은 조건(자연스러운 흐름·즉시 재진입 금지·같은 자리 복귀·안전·비상습)을 모두 지키면 허용된다.',
      '골에어리어 3인: 자기 진영 인플레이 중 같은 팀 3명 이상이 자기 골에어리어에 있으면 반칙 — 상대에게 간접프리킥.',
    ],
    // 이 조항은 장면이 둘(two-on-one · three-in-area)이지만 RuleLaw.sceneId 는 하나뿐이다
    // (인터페이스 주석 참고) — 더 자주 언급되고 파워체어풋볼 고유 규칙인 2-on-1 을 대표로
    // 삼는다. 골에어리어 3인 장면은 buildRuleScene('three-in-area') 로 여전히 만들 수 있다.
    sceneId: 'two-on-one',
  },
  {
    law: 12,
    key: 'fouls',
    group: 'restarts',
    title: '제12조 — 반칙과 비신사적 행위',
    summary: [
      '직접프리킥 대상: 부주의·무모·과도한 힘의 램핑, 체어로 붙듦, 고의 핸드볼, 팔로 밀거나 때림, 침 뱉기, 득점 기회 저지.',
      '자기 골에어리어 안에서 위 반칙을 저지르면 페널티킥.',
      '간접프리킥 대상: 골키퍼 아닌 선수의 자기 골라인 통과, 세 번째 선수의 골에어리어 진입, 위험한 플레이, 진로 방해, 골대 이동.',
      '경고(옐로카드) 7종 — 비신사적 행위·항의·지속적 위반·재개 지연·거리 미준수·무단 입퇴장·무단 이탈.',
      '퇴장(레드카드) 8종 — 심각한 반칙·폭력·침 뱉기·고의 핸드볼로 득점 저지·득점 기회 저지·골라인 통과로 득점 저지·모욕적 언행·두 번째 경고.',
    ],
    sceneId: 'ramming',
  },
  {
    law: 13,
    key: 'freekicks',
    group: 'restarts',
    title: '제13조 — 프리킥',
    summary: [
      '직접프리킥이 상대 골로 직접 들어가면 득점, 자기 골로 들어가면 상대에게 코너킥.',
      '간접프리킥은 주심이 한 팔을 수직으로 든 신호로 표시하며, 다른 선수를 거쳐야 득점이 인정된다.',
      '상대는 공에서 최소 5m 떨어져야 한다. 킥커는 두 번째로 공을 만지면 안 된다.',
    ],
    // 제11조와 같은 사정 — 직접(dfk)·간접(ifk) 두 장면 중 더 자주 쓰이는 직접프리킥을
    // 대표로 삼는다. 간접프리킥 장면은 buildRuleScene('ifk') 로 여전히 만들 수 있다.
    sceneId: 'dfk',
  },
  {
    law: 14,
    key: 'penalty',
    group: 'restarts',
    title: '제14조 — 페널티킥',
    summary: [
      '자기 골에어리어 안에서 직접프리킥 대상 반칙을 저지르면 페널티킥. 직접 득점이 인정된다.',
      '공은 페널티 마크(3.5m)에, 골키퍼는 킥 전까지 체어 전체가 골라인 뒤에서 정지해 있어야 한다.',
      '그 외 선수는 필드 안·골에어리어 밖·마크 뒤·마크에서 5m 이상 떨어진 곳에 있어야 한다.',
    ],
    sceneId: 'penalty',
  },
  {
    law: 15,
    key: 'kickin',
    group: 'restarts',
    title: '제15조 — 킥인',
    summary: [
      '공 전체가 터치라인을 넘으면 마지막으로 건드린 팀의 상대에게 킥인이 주어진다. 직접 득점이 인정된다.',
      '공이 나간 지점의 터치라인에서 차며, 상대는 5m 이상 떨어져야 한다.',
    ],
    sceneId: 'kick-in',
  },
  {
    law: 16,
    key: 'goalkick',
    group: 'restarts',
    title: '제16조 — 골킥',
    summary: [
      '공격 팀이 마지막으로 건드린 공이 골라인을 넘으면(득점이 아닐 때) 골킥으로 재개한다.',
      '골에어리어 안 임의 지점에서 차고, 공이 에어리어를 직접 벗어나야 인플레이다(아니면 재킥).',
      '직접 득점은 상대 골에만 인정된다.',
    ],
    sceneId: 'goal-kick',
  },
  {
    law: 17,
    key: 'corner',
    group: 'restarts',
    title: '제17조 — 코너킥',
    summary: [
      '수비 팀이 마지막으로 건드린 공이 골라인을 넘으면(득점이 아닐 때) 코너킥으로 재개한다.',
      '코너 트라이앵글 안에 공을 두고 차며, 에어리어 밖 상대는 5m, 에어리어 안 상대는 1m 침범 마크 뒤에 있어야 한다.',
      '직접 득점이 인정된다.',
    ],
    sceneId: 'corner',
  },
  {
    law: 18,
    key: 'classification',
    group: 'officials',
    title: '제18조 — 선수 분류',
    summary: [
      '장애 유형·정도에 따른 선수 분류(classification) 제도로 팀 구성의 공정성을 관리한다.',
      '세부 기준·점수 체계는 별도 문서 FIPFA 2025 Classification Rules(2026-01-01 발효)를 따른다 — 이 화면은 개요만 다룬다.',
    ],
  },
];

export function ruleContentFor(_locale: Locale): readonly RuleLaw[] {
  return KO_RULE_LAWS;
}
