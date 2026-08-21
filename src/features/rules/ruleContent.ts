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
import type { RuleFigureId } from './figures/ids.ts';
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
  /** 조항 도해(있으면) — 코트 위의 사건이 아니라서 보드 장면으로는 못 그리는 것을 한 장의
   *  정지 그림으로 보인다(공의 크기·장비·시간 같은 것). 장면과 **배타가 아니다**: 한 조항이
   *  도해와 장면을 함께 가질 수 있다. 근거는 `RuleFigure.tsx` 머리말. */
  figureId?: RuleFigureId;
  /** 보드 애니메이션 장면(있으면). 한 조항에 장면이 둘 이상 있을 수 있는데(제11조의
   *  2-on-1/골에어리어 3인, 제13조의 직접/간접) 이 필드는 **단일 값**이다 — 대표 장면
   *  하나만 가리키고, 나머지는 `ruleScenes.ts` 의 `buildRuleScene`/`RULE_SCENE_IDS` 로는
   *  여전히 존재하되 이 목록에서 직접 링크되지 않는다. 재생 조립 커밋(§C)에서 "관련 장면"
   *  UI가 생기면 그때 다중화를 고려한다 — 지금은 텍스트 목록 하나당 장면 하나로 충분하다. */
  sceneId?: RuleSceneId;
}

// 2026-08-22 주제별 재설계(docs/PLAN-RULES-REDESIGN.md) — 이 조항 텍스트의 역할이 "화면의
// 주 콘텐츠"에서 "부록(공식 룰 북)의 압축 참조"로 바뀌었다. 상세 설명은 이제 주제별 산문
// (ruleTopics.ts)이 맡으므로, 여기 summary 는 조항당 2~3줄로 줄인다 — 부록은 "제13조가 뭐였지"
// 를 빠르게 훑는 자리지, 다시 정독하는 자리가 아니다. CORE_FACTS(rulesDocTruth.test.ts)가
// 요구하는 12개 수치는 전부 어딘가의 조항에 보존돼 있다.
const KO_RULE_LAWS: readonly RuleLaw[] = [
  {
    law: 1,
    key: 'field',
    group: 'basics',
    title: '제1조 — 필드',
    summary: [
      '기본 규격 28m×15m(농구 코트), 국제 규정 범위는 25~30m×14~18m.',
      '골에어리어 8m×5m·페널티 마크 3.5m·골대 간격 6m·코너 트라이앵글 1m.',
    ],
    figureId: 'court',
    sceneId: 'field-tour',
  },
  {
    law: 2,
    key: 'ball',
    group: 'basics',
    title: '제2조 — 공',
    summary: [
      '지름 33cm(13인치, 축구공 5호 22cm의 1.5배)의 구형 공 — 저반발·중량형이라 파워체어가 타고 넘지 못한다.',
      '경기 중 파열되면 세트볼로, 재개 절차 중 파열되면 그 재개를 다시 한다.',
    ],
    figureId: 'ball',
  },
  {
    law: 3,
    key: 'players',
    group: 'basics',
    title: '제3조 — 선수 인원',
    summary: ['한 팀 최대 4명(1명은 반드시 골키퍼), 2명 미만이면 경기 불가.', '공식 대회는 선수 4명 + 교체 최대 4명.'],
    sceneId: 'lineup',
  },
  {
    law: 4,
    key: 'equipment',
    group: 'basics',
    title: '제4조 — 선수 장비',
    summary: [
      '전동휠체어 4바퀴 이상, 경기 중 최고 속도는 전진·후진 동일 10km/h.',
      '랩 시트벨트·프런트가드·좌우 측면지지대 필수, 체어 밑판 앞뒤 경계를 넘는 부분 금지.',
    ],
    figureId: 'equipment',
  },
  {
    law: 5,
    key: 'referee',
    group: 'officials',
    title: '제5조 — 주심',
    summary: ['경기의 규칙 적용을 책임진다. 징계 권한은 경기장 도착부터 퇴장 시까지 유효.'],
  },
  {
    law: 6,
    key: 'assistants',
    group: 'officials',
    title: '제6조 — 부심',
    summary: ['주심을 보조하는 부심을 둘 수 있다.'],
  },
  {
    law: 7,
    key: 'duration',
    group: 'play',
    title: '제7조 — 경기 시간',
    summary: ['전·후반 각 20분, 하프타임 최대 10분.'],
  },
  {
    law: 8,
    key: 'kickoff',
    group: 'play',
    title: '제8조 — 시작과 재개',
    summary: [
      '킥오프로 재개(경기 시작·득점 후·후반·연장 시작). 직접 득점 인정.',
      '전원 자기 진영, 상대는 5m 밖, 공은 센터마크에 정지.',
    ],
    sceneId: 'kickoff',
  },
  {
    law: 9,
    key: 'inout',
    group: 'play',
    title: '제9조 — 인/아웃 플레이',
    summary: ['공 전체가 라인을 완전히 벗어나야 아웃오브플레이.'],
    sceneId: 'inout',
  },
  {
    law: 10,
    key: 'scoring',
    group: 'play',
    title: '제10조 — 득점 방법',
    summary: ['공 전체가 굴러서 골라인을 완전히 통과해야 득점. 바닥에서 50.8cm 이상 떠서 넘으면 무효.'],
    sceneId: 'scoring',
  },
  {
    law: 11,
    key: 'position',
    group: 'play',
    title: '제11조 — 필드 포지션(2-on-1·골에어리어 3인)',
    summary: [
      '2-on-1: 공 3m 안 같은 팀 2명+상대 1명 모두가 액티브 플레이에 관여하면 위반(골키퍼 예외·상대 없음 예외 있음).',
      '골에어리어 3인 진입도 위반 — 둘 다 상대에게 간접프리킥.',
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
      '램핑·핸드볼·팔 사용 등은 직접프리킥(자기 에어리어 안이면 페널티킥), 위험한 플레이 등은 간접프리킥.',
      '경고(옐로카드) 7종·퇴장(레드카드) 8종.',
    ],
    sceneId: 'ramming',
  },
  {
    law: 13,
    key: 'freekicks',
    group: 'restarts',
    title: '제13조 — 프리킥',
    summary: [
      '직접프리킥은 상대 골로 직접 들어가면 득점, 간접프리킥은 다른 선수를 거쳐야 득점.',
      '상대는 5m 밖, 킥커는 두 번째로 공을 만지면 안 된다.',
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
    summary: ['자기 에어리어 안 중대 반칙 시 페널티킥. 공은 페널티 마크(3.5m)에, 직접 득점 인정.'],
    sceneId: 'penalty',
  },
  {
    law: 15,
    key: 'kickin',
    group: 'restarts',
    title: '제15조 — 킥인',
    summary: ['공이 터치라인을 넘으면 마지막 터치의 상대 팀에 킥인, 직접 득점 인정. 상대는 5m 밖.'],
    sceneId: 'kick-in',
  },
  {
    law: 16,
    key: 'goalkick',
    group: 'restarts',
    title: '제16조 — 골킥',
    summary: ['공격 팀 마지막 터치로 골라인 아웃 시 골킥. 에어리어를 직접 벗어나야 인플레이.'],
    sceneId: 'goal-kick',
  },
  {
    law: 17,
    key: 'corner',
    group: 'restarts',
    title: '제17조 — 코너킥',
    summary: ['수비 팀 마지막 터치로 골라인 아웃 시 코너킥. 직접 득점 인정.'],
    sceneId: 'corner',
  },
  {
    law: 18,
    key: 'classification',
    group: 'officials',
    title: '제18조 — 선수 분류',
    summary: ['장애 유형·정도에 따른 분류 제도. 세부 기준은 별도 문서(FIPFA 2025 Classification Rules) 참조.'],
  },
];

export function ruleContentFor(_locale: Locale): readonly RuleLaw[] {
  return KO_RULE_LAWS;
}
