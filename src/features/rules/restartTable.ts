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
