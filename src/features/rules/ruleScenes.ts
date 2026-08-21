// 규칙 화면(2026-08-21 신설)의 보드 애니메이션 장면 데이터 — docs/PLAN-RULES-SCREEN.md §B.
//
// `model/seedDrills.ts` 의 `SeedDrillSpec`/`buildSeedDrill` 변환기를 그대로 쓴다 — 드릴 문서는
// id 8종·pose 맵·cast 참조가 얽혀 있어 손으로 `Drill` 리터럴을 적으면 오탈자가 조용한 데이터
// 유실이 된다(그 파일 머리말의 근거와 동일). 여기서는 좌표와 문장만 적고, id·cast 연결은
// 변환기가 기계적으로 만든다.
//
// 코트는 전부 **28×15m(FIPFA 표준 = 농구 코트, courtMode:'full' + courtSize:'28x15')** 로
// 고정한다 — 근거는 docs/RULES-FIPFA-2025.md 의 "앱 반영 시 참고" 절. PX_PER_M=25 로 계산한
// 좌표 상수는 아래 GEO 에 모아 뒀다(court.ts 의 buildFullCourt 계산을 손으로 재현한 값 —
// ruleScenes.test.ts 가 courtDefFor('full','28x15') 와 대조해 드리프트를 잡는다).
//
// ⚠️ `SeedStepSpec` 에는 `cut` 필드가 없다(seedDrills.ts 는 훈련 드릴만 상대해 왔고 지금까지
// 컷이 필요 없었다). 공용 변환기를 더 건드리지 않기 위해(계획 §B "seedDrills.ts 는 courtSize
// 확장만") **여기서 빌드 후 후처리로** 특정 스텝에 `cut: true` 를 얹는다 — `SCENE_META.cutSteps`
// 가 0-based 스텝 인덱스를 담는다.
//
// ring/defense 도 같은 이유로 후처리다: `SeedDrillSpec` 에는 `BallDef.ring`(공 개체 속성)과
// `Drill.defense`(드릴 진영)를 실을 자리가 없다 — 씨앗 드릴 3종은 둘 다 쓴 적이 없어서 애초에
// 변환기가 모른다. `ring` 은 표시가 아니라 **규칙 선택**이다(model/drill.ts 의 그 근거 — '5m' 은
// "이 공은 세트피스" 라는 약속이라 그 공은 2-on-1 대신 5m 제한으로 판정된다, model/rules.ts
// ruleForRing). 재시작 7종엔 '5m', 2-on-1 엔 '3m' 을 얹어 두면 다음 커밋(보드 조립)이 붙일
// RuleOverlay 가 이미 검증된 위반 판정 로직을 그대로 재사용한다.
import type { CourtSize } from '../../model/court.ts';
import type { Drill, TeamSide } from '../../model/drill.ts';
import { buildSeedDrill } from '../../model/seedDrills.ts';
import type { SeedDrillSpec } from '../../model/seedDrills.ts';

export type RuleSceneId =
  | 'field-tour'
  | 'lineup'
  | 'kickoff'
  | 'inout'
  | 'scoring'
  | 'two-on-one'
  | 'three-in-area'
  | 'ramming'
  | 'dfk'
  | 'ifk'
  | 'penalty'
  | 'kick-in'
  | 'goal-kick'
  | 'corner';

const COURT_SIZE: CourtSize = '28x15';

// ── 28×15 풀 코트 기하 (court.ts buildFullCourt(28,15,...) 를 손으로 재현, PX_PER_M=25) ──────
const GEO = {
  vbW: 775,
  vbH: 450,
  surface: { x0: 37.5, y0: 37.5, x1: 737.5, y1: 412.5 },
  cx: 387.5,
  cy: 225,
  // 골포스트(±3m). 왼쪽 = 홈이 기본으로 지키는 골, 오른쪽 = 어웨이.
  goalLeftX: 37.5,
  goalRightX: 737.5,
  goalTopY: 150,
  goalBottomY: 300,
  // 골에어리어(8×5m).
  areaDepth: 125,
  areaLeft: { x0: 37.5, x1: 162.5, y0: 125, y1: 325 },
  areaRight: { x0: 612.5, x1: 737.5, y0: 125, y1: 325 },
  // 페널티 마크(3.5m).
  penaltyLeft: { x: 125, y: 225 },
  penaltyRight: { x: 650, y: 225 },
  centerMark: { x: 387.5, y: 225 },
} as const;

/** 장면은 저장되지 않으므로(인메모리 전용) 값 자체는 무의미하다 — `buildSeedDrill` 이 요구하는
 *  고정 타임스탬프 하나만 있으면 된다. */
const RULE_SCENE_CREATED_AT = 1755000000000;

interface RuleSceneMeta {
  /** cast.balls[0] 에 얹을 규칙 링. 생략 = 링 없음. */
  ring?: '3m' | '5m';
  /** Drill.defense 후처리. 생략 = createDrill 기본값(홈, 왼쪽 골) 그대로. */
  defense?: TeamSide;
  /** 0-based 스텝 인덱스 — 이 스텝들에 cut:true 를 얹는다(보간 없이 즉시 컷). */
  cutSteps?: readonly number[];
}

const SCENE_META: Record<RuleSceneId, RuleSceneMeta> = {
  'field-tour': {},
  lineup: {},
  kickoff: { ring: '5m', defense: 'away' },
  inout: { cutSteps: [1] },
  scoring: { cutSteps: [1] },
  'two-on-one': { ring: '3m', defense: 'home', cutSteps: [1, 2] },
  'three-in-area': { defense: 'home', cutSteps: [1] },
  ramming: { cutSteps: [1] },
  dfk: { ring: '5m', defense: 'away' },
  ifk: { ring: '5m', defense: 'away' },
  penalty: { ring: '5m', defense: 'away' },
  'kick-in': { ring: '5m', defense: 'home' },
  'goal-kick': { ring: '5m', defense: 'home', cutSteps: [1] },
  corner: { ring: '5m', defense: 'away' },
};

const SPECS: Record<RuleSceneId, SeedDrillSpec> = {
  // ── Law 1 — 필드 규격: 정지 도해, 선수·공 전부 미배치 ─────────────────────────────────────
  'field-tour': {
    title: '제1조 — 필드 규격',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '코트 규격은 28×15m(농구 코트 표준)입니다. 골에어리어는 8×5m, 페널티 마크는 골라인에서 3.5m, 골대 간격은 6m, 코너 트라이앵글은 각 코너에서 1m입니다.',
        notes: [
          { at: [100, 100], text: '골에어리어 8×5m' },
          { at: [125, 260], text: '페널티 마크(3.5m)' },
          { at: [387.5, 250], text: '센터 마크' },
          { at: [37.5, 120], text: '골대 폭 6m' },
          { at: [70, 60], text: '코너 1m' },
        ],
        arrows: [
          { from: [185, 125], to: [185, 325] },
          { from: [37.5, 100], to: [162.5, 100] },
          { from: [20, 150], to: [20, 300] },
        ],
      },
    ],
  },

  // ── Law 3 — 선수 인원: 4v4 기본 대형 ────────────────────────────────────────────────────
  lineup: {
    title: '제3조 — 선수 인원',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '한 팀은 최대 4명(그중 1명은 반드시 골키퍼)으로 구성됩니다. 2명 미만이 되면 경기를 시작하거나 계속할 수 없습니다.',
        chairs: {
          'home-G': [75, 225, 0],
          'home-2': [250, 150, 0],
          'home-3': [250, 300, 0],
          'home-4': [300, 225, 0],
          'away-G': [700, 225, 180],
          'away-2': [525, 300, 180],
          'away-3': [525, 150, 180],
          'away-4': [475, 225, 180],
        },
      },
    ],
  },

  // ── Law 8 — 킥오프 ──────────────────────────────────────────────────────────────────────
  kickoff: {
    title: '제8조 — 시작과 재개: 킥오프',
    drillType: 'set-piece',
    situation: 'kick-off',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '경기 시작·득점 후·후반 시작마다 킥오프로 재개합니다. 전원 자기 진영에 있어야 하고, 상대 팀은 공에서 최소 5m 떨어져야 하며, 공은 센터마크에 정지해 있어야 합니다.',
        chairs: {
          'home-G': [75, 225, 0],
          'home-2': [300, 170, 0],
          'home-3': [355, 225, 0],
          'home-4': [300, 280, 0],
          'away-G': [700, 225, 180],
          'away-2': [525, 165, 180],
          'away-3': [525, 285, 180],
          'away-4': [560, 225, 180],
        },
        balls: [[387.5, 225]],
      },
      {
        name: '',
        note: '주심 신호 후 공을 차서 움직이면 인플레이입니다. 킥커는 공이 다른 선수에 닿기 전 두 번째로 만지면 안 됩니다 — 어기면 상대에게 간접프리킥이 주어집니다.',
        chairs: {
          'home-G': [75, 225, 0],
          'home-2': [300, 170, 0],
          'home-3': [370, 235, 0],
          'home-4': [330, 255, 0],
          'away-G': [700, 225, 180],
          'away-2': [525, 165, 180],
          'away-3': [525, 285, 180],
          'away-4': [560, 225, 180],
        },
        balls: [[330, 255]],
        arrows: [{ from: [387.5, 225], to: [330, 255] }],
      },
    ],
  },

  // ── Law 9 — 인/아웃 플레이 ──────────────────────────────────────────────────────────────
  inout: {
    title: '제9조 — 인/아웃 플레이',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공은 지면이든 공중이든 라인을 완전히 벗어나야 아웃오브플레이입니다. 공이 라인에 걸쳐 있으면 아직 인플레이입니다.',
        chairs: { 'home-4': [400, 90, 270] },
        balls: [[400, 37.5]],
      },
      {
        name: '',
        note: '공 전체가 터치라인을 완전히 넘으면 그 순간 아웃오브플레이가 되고, 마지막으로 공을 건드린 팀의 상대에게 킥인이 주어집니다(제15조).',
        chairs: { 'home-4': [400, 90, 270] },
        balls: [[400, 15]],
      },
    ],
  },

  // ── Law 10 — 득점 방법 ──────────────────────────────────────────────────────────────────
  scoring: {
    title: '제10조 — 득점 방법',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공 전체가 골포스트 사이 골라인을 굴러서 완전히 통과하면 득점입니다. 들리거나 실려서 넘어가면 안 됩니다.',
        chairs: { 'home-4': [700, 225, 0] },
        balls: [[750, 225]],
      },
      {
        name: '',
        note: '공이 골라인에 못 미치면(또는 바닥에서 50.8cm 이상 떠서 넘으면) 득점으로 인정되지 않습니다.',
        chairs: { 'home-4': [700, 225, 0] },
        balls: [[725, 225]],
      },
    ],
  },

  // ── Law 11 — 필드 포지션: 2-on-1 ────────────────────────────────────────────────────────
  'two-on-one': {
    title: '제11조 — 필드 포지션: 2-on-1',
    drillType: 'tactical',
    situation: '2-on-1-spacing',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '인플레이 공 3m 안에 같은 팀 2명과 상대 1명이 있고, 둘 다 액티브 플레이(패스·방해·이득)에 관여하면 2-on-1 위반입니다.',
        chairs: {
          'home-2': [370, 210, 20],
          'home-3': [420, 240, 200],
          'away-2': [400, 260, 270],
          'home-4': [200, 350, 0],
          'away-3': [600, 150, 180],
        },
        balls: [[400, 225]],
        arrows: [{ from: [370, 210], to: [420, 240] }],
      },
      {
        name: '',
        note: '위반이 인정되면 주심은 위반이 일어난 지점에서 상대 팀에게 간접프리킥을 줍니다.',
        chairs: {
          'home-2': [370, 210, 20],
          'home-3': [420, 240, 200],
          'away-2': [400, 260, 270],
          'home-4': [200, 350, 0],
          'away-3': [600, 150, 180],
        },
        balls: [[400, 225]],
        notes: [{ at: [400, 190], text: '간접 프리킥' }],
      },
      {
        name: '',
        note: '팀원 하나가 공에서 3m 밖으로 빠지면 더 이상 2-on-1이 아닙니다 — 남은 팀원과 상대 각 1명은 위반이 아닙니다.',
        chairs: {
          'home-2': [370, 210, 20],
          'home-3': [500, 320, 200],
          'away-2': [400, 260, 270],
          'home-4': [200, 350, 0],
          'away-3': [600, 150, 180],
        },
        balls: [[400, 225]],
      },
    ],
  },

  // ── Law 11 — 필드 포지션: 골에어리어 3인 ────────────────────────────────────────────────
  'three-in-area': {
    title: '제11조 — 필드 포지션: 골에어리어 3인',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공이 자기 진영에서 인플레이인 동안 같은 팀 3명 이상이 동시에 자기 골에어리어 안에 있으면 위반입니다.',
        chairs: {
          'home-G': [75, 225, 0],
          'home-2': [110, 160, 90],
          'home-3': [110, 290, 270],
          'home-4': [280, 225, 0],
        },
        balls: [[300, 225]],
      },
      {
        name: '',
        note: '위반이 인정되면 상대 팀에게 위반 지점에서 간접프리킥이 주어집니다. 득점 기회를 저지했다면 제12조(카드)까지 적용될 수 있습니다.',
        chairs: {
          'home-G': [75, 225, 0],
          'home-2': [110, 160, 90],
          'home-3': [110, 290, 270],
          'home-4': [280, 225, 0],
        },
        balls: [[300, 225]],
        notes: [{ at: [110, 225], text: '간접 프리킥' }],
      },
    ],
  },

  // ── Law 12 — 반칙과 비신사적 행위: 램핑 ──────────────────────────────────────────────────
  ramming: {
    title: '제12조 — 반칙과 비신사적 행위: 램핑',
    drillType: 'tactical',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '부주의하거나 무모하거나 과도한 힘으로 상대를 들이받거나 시도하면 반칙입니다.',
        chairs: { 'home-3': [340, 225, 0], 'away-3': [460, 225, 180] },
        arrows: [
          { from: [340, 225], to: [400, 225] },
          { from: [460, 225], to: [410, 225] },
        ],
      },
      {
        name: '',
        note: '충돌이 인정되면 상대 팀에게 직접프리킥이 주어집니다. 자기 골에어리어 안이었다면 페널티킥입니다.',
        chairs: { 'home-3': [398, 225, 0], 'away-3': [412, 225, 180] },
        notes: [{ at: [405, 190], text: '직접 프리킥' }],
      },
    ],
  },

  // ── Law 13 — 프리킥: 직접 ───────────────────────────────────────────────────────────────
  dfk: {
    title: '제13조 — 프리킥: 직접프리킥',
    drillType: 'set-piece',
    situation: 'direct-fk',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '반칙이 일어난 지점에서 직접프리킥을 찹니다. 상대는 공에서 최소 5m 떨어져야 하고, 공은 정지 상태여야 합니다.',
        chairs: { 'home-3': [280, 225, 0], 'away-3': [450, 225, 180], 'away-G': [700, 225, 180] },
        balls: [[300, 225]],
      },
      {
        name: '',
        note: '직접프리킥이 상대 골로 직접 들어가면 득점이 인정됩니다.',
        chairs: { 'home-3': [280, 225, 0], 'away-3': [450, 225, 180], 'away-G': [700, 225, 180] },
        balls: [[690, 220]],
        arrows: [{ from: [300, 225], to: [690, 220] }],
        notes: [{ at: [500, 190], text: '직접 득점 인정' }],
      },
    ],
  },

  // ── Law 13 — 프리킥: 간접 ───────────────────────────────────────────────────────────────
  ifk: {
    title: '제13조 — 프리킥: 간접프리킥',
    drillType: 'set-piece',
    situation: 'indirect-fk',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '간접프리킥은 주심이 한 팔을 머리 위로 곧게 들어 표시합니다. 다른 선수를 거쳐야만 득점이 인정됩니다.',
        chairs: { 'home-3': [280, 225, 0], 'home-4': [400, 260, 0], 'away-3': [450, 225, 180], 'away-G': [700, 225, 180] },
        balls: [[300, 225]],
        notes: [{ at: [280, 190], text: '간접 — 주심이 팔을 든다' }],
      },
      {
        name: '',
        note: '홈이 짧게 내주고 받은 선수가 슈팅합니다 — 다른 선수를 거쳤으므로 득점이 인정됩니다.',
        chairs: { 'home-3': [280, 225, 0], 'home-4': [400, 260, 0], 'away-3': [450, 225, 180], 'away-G': [700, 225, 180] },
        balls: [[690, 220]],
        arrows: [
          { from: [300, 225], to: [400, 260] },
          { from: [400, 260], to: [690, 220] },
        ],
      },
    ],
  },

  // ── Law 14 — 페널티킥 ───────────────────────────────────────────────────────────────────
  penalty: {
    title: '제14조 — 페널티킥',
    drillType: 'set-piece',
    situation: 'penalty',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공은 페널티 마크(골라인에서 3.5m)에 정지합니다. 수비 골키퍼는 킥 전까지 체어 전체가 골라인 뒤에 정지해 있어야 합니다. 그 외 선수는 필드 안·골에어리어 밖·마크 뒤·마크에서 5m 이상 떨어져 있어야 합니다.',
        chairs: {
          'away-G': [735, 225, 180],
          'home-3': [630, 225, 0],
          'home-2': [500, 150, 0],
          'home-4': [500, 300, 0],
          'away-2': [500, 190, 180],
          'away-3': [500, 260, 180],
        },
        balls: [[650, 225]],
      },
      {
        name: '',
        note: '킥커가 페널티킥을 찹니다. 직접 득점이 인정됩니다.',
        chairs: {
          'away-G': [735, 225, 180],
          'home-3': [630, 225, 0],
          'home-2': [500, 150, 0],
          'home-4': [500, 300, 0],
          'away-2': [500, 190, 180],
          'away-3': [500, 260, 180],
        },
        balls: [[730, 220]],
        arrows: [{ from: [650, 225], to: [730, 220] }],
      },
    ],
  },

  // ── Law 15 — 킥인 ───────────────────────────────────────────────────────────────────────
  'kick-in': {
    title: '제15조 — 킥인',
    drillType: 'set-piece',
    situation: 'kick-in',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공 전체가 터치라인을 넘으면 마지막으로 건드린 팀의 상대가 그 지점에서 킥인을 합니다. 상대는 공이 인플레이 될 때까지 5m 이상 떨어져야 합니다.',
        chairs: { 'away-3': [300, 45, 90], 'home-2': [300, 170, 90], 'home-3': [420, 100, 180] },
        balls: [[300, 37.5]],
      },
      {
        name: '',
        note: '공을 차서 움직이면 인플레이입니다. 킥인에서도 직접 득점이 인정됩니다.',
        chairs: { 'away-3': [300, 45, 90], 'home-2': [300, 170, 90], 'home-3': [420, 100, 180] },
        balls: [[320, 90]],
        arrows: [{ from: [300, 37.5], to: [320, 90] }],
      },
    ],
  },

  // ── Law 16 — 골킥 ───────────────────────────────────────────────────────────────────────
  'goal-kick': {
    title: '제16조 — 골킥',
    drillType: 'set-piece',
    situation: 'goal-kick',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '공격 팀이 마지막으로 건드린 공이 골라인을 넘으면 골킥으로 재개합니다. 수비 팀 선수가 골에어리어 안 임의 지점에서 차고, 상대는 5m 이상 떨어져야 합니다.',
        chairs: { 'home-2': [100, 225, 0], 'away-3': [280, 225, 180] },
        balls: [[100, 225]],
      },
      {
        name: '',
        note: '공이 골에어리어를 직접 벗어나야 인플레이입니다 — 벗어나지 못하면 재킥입니다.',
        chairs: { 'home-2': [100, 225, 0], 'away-3': [280, 225, 180] },
        balls: [[220, 225]],
        arrows: [{ from: [100, 225], to: [220, 225] }],
      },
    ],
  },

  // ── Law 17 — 코너킥 ─────────────────────────────────────────────────────────────────────
  corner: {
    title: '제17조 — 코너킥',
    drillType: 'set-piece',
    situation: 'corner',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '수비 팀이 마지막으로 건드린 공이 골라인을 넘으면 코너킥입니다. 공은 코너 트라이앵글 안에 두고, 에어리어 밖 상대는 5m, 에어리어 안 상대는 1m 침범 마크 뒤(또는 골라인 위 골키퍼)에 있어야 합니다.',
        chairs: {
          'home-3': [700, 380, 315],
          'away-G': [735, 225, 180],
          'away-4': [650, 220, 180],
          'away-3': [550, 300, 180],
        },
        balls: [[715, 395]],
      },
      {
        name: '',
        note: '직접 득점이 인정됩니다 — 골 앞으로 크로스합니다.',
        chairs: {
          'home-3': [700, 380, 315],
          'away-G': [735, 225, 180],
          'away-4': [650, 220, 180],
          'away-3': [550, 300, 180],
        },
        balls: [[680, 240]],
        arrows: [{ from: [715, 395], to: [680, 240] }],
      },
    ],
  },
};

/** 스펙 하나 → 장면 드릴 하나. `ring`/`defense`/`cut` 은 `SeedDrillSpec` 표현력 밖이라
 *  변환 후 후처리한다(파일 머리말 근거). */
export function buildRuleScene(id: RuleSceneId): Drill {
  const drill = buildSeedDrill(SPECS[id], RULE_SCENE_CREATED_AT);
  const meta = SCENE_META[id];

  const cast =
    meta.ring !== undefined && drill.cast.balls[0]
      ? { ...drill.cast, balls: drill.cast.balls.map((b, i) => (i === 0 ? { ...b, ring: meta.ring } : b)) }
      : drill.cast;

  const cutSet = new Set(meta.cutSteps ?? []);
  const steps = cutSet.size === 0 ? drill.steps : drill.steps.map((step, i) => (cutSet.has(i) ? { ...step, cut: true as const } : step));

  return {
    ...drill,
    cast,
    steps,
    ...(meta.defense !== undefined ? { defense: meta.defense } : {}),
  };
}

export const RULE_SCENE_IDS: readonly RuleSceneId[] = [
  'field-tour',
  'lineup',
  'kickoff',
  'inout',
  'scoring',
  'two-on-one',
  'three-in-area',
  'ramming',
  'dfk',
  'ifk',
  'penalty',
  'kick-in',
  'goal-kick',
  'corner',
];

// GEO 는 테스트가 courtDefFor('full','28x15') 와 대조하는 데도 쓴다.
export { GEO as RULE_SCENE_GEO };
