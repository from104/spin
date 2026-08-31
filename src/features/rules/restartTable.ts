// 재개 비교표 데이터(2026-08-22, 규칙 화면 주제별 재설계 §2) — docs/PLAN-RULES-REDESIGN.md.
//
// 7열(재개 종류) × 5행(비교 항목). 열마다 `sceneId` 를 달아 표와 장면을 정합시킨다 —
// `ruleTopics.test.ts` 가 이 sceneId 전부가 `RULE_SCENE_IDS` 에 실존하는지 대조한다.
//
// **"특이" 행에 투터치를 안 넣는 이유**: 투터치(2회 연속 터치) 금지는 7열 전부에 공통이다
// (2026-08-22 원문 재확인, docs/RULES-FIPFA-2025.md 참고). 열마다 반복하면 정보가 아니라
// 소음이 되므로, 공통 규칙은 표 위 산문(ruleTopics.ts 의 `restarts` 주제 첫 블록)에서 한 번만
// 말하고, "특이" 행은 그 재개만의 진짜 차별점으로 채운다.
import type { RuleSceneId } from './ruleScenes.ts';
import type { Locale } from '../../i18n/locale.ts';

export type RestartKey = 'kickoff' | 'kick-in' | 'corner' | 'goal-kick' | 'dfk' | 'ifk' | 'penalty';

export interface RestartCells {
  when: string;
  ball: string;
  distance: string;
  /** 색만으로 뜻을 전하지 않는다 — `Verdict` 시각 어휘(✓/✕ + 라벨)로 렌더한다. */
  directGoal: { ok: boolean; label: string };
  notes: string;
}

export interface RestartColumn {
  key: RestartKey;
  label: string;
  sceneId: RuleSceneId;
  cells: RestartCells;
}

export const RESTART_ROW_LABELS: readonly [string, string, string, string, string] = ['언제', '볼 위치', '상대 거리', '직접 득점', '특이'];

/** 영어판 행 라벨. 표의 **뼈대**라 셀과 함께 갈아야 반쪽 번역이 안 된다. */
const RESTART_ROW_LABELS_EN: readonly [string, string, string, string, string] = ['When', 'Ball', 'Opponents', 'Direct goal', 'Note'];

export function restartRowLabelsFor(locale: Locale): readonly [string, string, string, string, string] {
  return locale === 'en' ? RESTART_ROW_LABELS_EN : RESTART_ROW_LABELS;
}

export const RESTART_COLUMNS: readonly RestartColumn[] = [
  {
    key: 'kickoff',
    label: '킥오프',
    sceneId: 'kickoff',
    cells: {
      when: '시작·득점 후·후반 시작',
      ball: '센터 마크',
      distance: '5m',
      directGoal: { ok: true, label: '득점 인정' },
      notes: '전원 자기 진영',
    },
  },
  {
    key: 'kick-in',
    label: '킥인',
    sceneId: 'kick-in',
    cells: {
      when: '터치라인 아웃',
      ball: '나간 지점',
      distance: '5m',
      directGoal: { ok: true, label: '득점 인정' },
      notes: '동시 터치는 바깥쪽에',
    },
  },
  {
    key: 'corner',
    label: '코너킥',
    sceneId: 'corner',
    cells: {
      when: '수비가 골라인 아웃',
      ball: '코너 트라이앵글',
      distance: '5m(에어리어 안 1m 마크 뒤)',
      directGoal: { ok: true, label: '득점 인정' },
      notes: 'GK 골라인 뒤 예외',
    },
  },
  {
    key: 'goal-kick',
    label: '골킥',
    sceneId: 'goal-kick',
    cells: {
      when: '공격이 골라인 아웃',
      ball: '에어리어 안 임의 지점',
      distance: '5m',
      directGoal: { ok: false, label: '상대 골만' },
      notes: '에어리어 벗어나야 인플레이',
    },
  },
  {
    key: 'dfk',
    label: '직접FK',
    sceneId: 'dfk',
    cells: {
      when: '직접FK 대상 반칙',
      ball: '반칙 지점',
      distance: '5m',
      directGoal: { ok: true, label: '득점 인정' },
      notes: '자책 직접 → 상대 코너킥',
    },
  },
  {
    key: 'ifk',
    label: '간접FK',
    sceneId: 'ifk',
    cells: {
      when: '간접FK 대상 위반',
      ball: '위반 지점',
      distance: '5m',
      directGoal: { ok: false, label: '경유 필요' },
      notes: '주심 한 팔 시그널',
    },
  },
  {
    key: 'penalty',
    label: '페널티킥',
    sceneId: 'penalty',
    cells: {
      when: '에어리어 안 중대 반칙',
      ball: '페널티 마크(3.5m)',
      distance: '마크 뒤 5m·에어리어 밖',
      directGoal: { ok: true, label: '득점 인정' },
      notes: 'GK 골라인 뒤 정지',
    },
  },
];

/** 영어판 열. 한국어판과 **key·sceneId·순서가 같아야 한다** — 표↔장면 1:1 단언이 로케일과
 *  무관하게 걸린다. 바뀌는 것은 `label` 과 셀 문구뿐이다. 정본은 `docs/RULES-FIPFA-2025.en.md`. */
const RESTART_COLUMNS_EN: readonly RestartColumn[] = [
  { key: 'kickoff', label: 'Kick-off', sceneId: 'kickoff', cells: {
    when: 'Start · after a goal · second half', ball: 'Centre mark', distance: '5m',
    directGoal: { ok: true, label: 'Yes' }, notes: 'Everyone in their own half' } },
  { key: 'kick-in', label: 'Kick-in', sceneId: 'kick-in', cells: {
    when: 'Ball out over a touchline', ball: 'Where it left', distance: '5m',
    directGoal: { ok: true, label: 'Yes' }, notes: 'Simultaneous touch: to the player on the outside' } },
  { key: 'corner', label: 'Corner kick', sceneId: 'corner', cells: {
    when: 'Defender touched it out over the goal line', ball: 'Corner triangle', distance: '5m',
    directGoal: { ok: true, label: 'Yes' }, notes: 'In the goal area: behind the 1m mark' } },
  { key: 'goal-kick', label: 'Goal kick', sceneId: 'goal-kick', cells: {
    when: 'Attacker touched it out over the goal line', ball: 'Anywhere in the goal area', distance: '5m',
    directGoal: { ok: true, label: 'Opponents’ goal only' }, notes: 'In play once it leaves the goal area' } },
  { key: 'dfk', label: 'Direct free kick', sceneId: 'dfk', cells: {
    when: 'Ramming, handball, arms, denying a chance', ball: 'Where the offence was', distance: '5m',
    directGoal: { ok: true, label: 'Yes' }, notes: 'Inside your own goal area it becomes a penalty kick' } },
  { key: 'ifk', label: 'Indirect free kick', sceneId: 'ifk', cells: {
    when: 'Dangerous play, impeding, 2-on-1, 3 in the area', ball: 'Where the offence was', distance: '5m',
    directGoal: { ok: false, label: 'Must touch another player' }, notes: 'Referee holds an arm up until it is touched' } },
  { key: 'penalty', label: 'Penalty kick', sceneId: 'penalty', cells: {
    when: 'Direct-kick offence in your own goal area', ball: 'Penalty mark (3.5m)', distance: '5m, behind the mark',
    directGoal: { ok: true, label: 'Yes' }, notes: 'Goalkeeper still behind the line; kicker has 15 seconds' } },
];

export function restartColumnsFor(locale: Locale): readonly RestartColumn[] {
  return locale === 'en' ? RESTART_COLUMNS_EN : RESTART_COLUMNS;
}
