// §3 seed 드릴 — **심는 장치**의 모델 쪽 절반. 사람이 읽고 고치는 스펙(`seedDrillContent.ts`)을
// 앱이 저장하는 `Drill` 문서로 옮기는 변환만 한다. **내용은 여기 없다**(결정 ⑥ 미승인) —
// 승인된 내용이 오면 그 파일 하나만 갈아끼우면 되도록 둘을 갈라 둔 것이다.
//
// 왜 `Drill` 리터럴을 그냥 적지 않는가: 드릴 문서는 id 8종·pose 맵·cast 참조가 얽혀 있어 손으로
// 적으면 **오탈자가 조용한 데이터 유실이 된다**(cast 에 없는 pose 는 validate 가 말없이 버린다).
// 스펙은 좌표와 문장만 담고 id·cast 연결은 이 파일이 기계적으로 만든다. 좌표는 `[x, y, 각도°]`
// 세 숫자라 표로 읽히고, 슬롯은 `'home-2'` 처럼 사람이 부르는 이름이다.
//
// ── ⚠️ 2026-09-06: 위 문단의 "심는 장치" 지위가 뒤집혔다 ────────────────────────────────
// 기현 지시(2026-09-06): *"첫 실행시 기본 저장되어있는 드릴을 규칙에 있는 드릴로 교체 (앞으로 쭉
// 그 정책 유지"* → 정본 계획서 `docs/PLAN-SEED-FROM-RULES.md`.
//
// **이 파일은 더 이상 시드의 출처가 아니다.** 첫 실행에 심는 드릴은 규칙 화면 장면 22벌이고
// (`features/rules/ruleScenes.ts` 의 `seedRuleDrills`), 손코딩 시드 3벌을 담던
// `seedDrillContent.ts` 와 그 목록 생성기 `buildSeedDrills`·`SEED_STAGGER_MS` 는 함께 폐기됐다.
// 남는 것은 **변환기 `buildSeedDrill` 하나**다 — 규칙 장면 (1) 갈래 3벌이 여전히 이것으로
// 만들어진다(AGENTS.md §9: 호출자가 있는 것은 지우지 않는다). 위 두 문단의 "왜 리터럴을 안
// 적는가" 근거는 그 갈래에서 그대로 살아 있다.
//
// **잃은 것 — 온보딩 내레이션.** 폐기된 시드 3벌은 스텝 메모를 *"① 훈련 내용 ⏎ ② 조작: …"* 두
// 도막으로 적어, 첫 실행에서 시연을 재생하면 앱 조작법이 함께 읽히게 만든 장치였다(그 형식을
// 강제하던 단언이 `seedDrills.test.ts` 에 있었다). 규칙 장면은 설명을 코트 위 쪽지로 하고 스텝
// 메모가 거의 비어 있어 그 장치가 성립하지 않는다. 되살리려면 장면 메모를 **드릴 편집기에서**
// 채워 재임포트한다 — 손코딩 금지(AGENTS.md §5)는 그대로다.
import { newId } from '../core/ids.ts';
import type { BallId, ChairId, ConeId } from '../core/ids.ts';
import type { Vec2 } from '../core/units.ts';
import { createDrill } from './defaults.ts';
import { migrateStepName } from './validate.ts';
import { defaultCtrl } from './arrow.ts';
import type { Arrow, ArrowHead } from './arrow.ts';
import type { CourtMode, CourtSize } from './court.ts';
import type { StoredChairPose } from './chair.ts';
import type { ChairDef, Drill, DrillCast, DrillLevel, DrillSituation, DrillStep, DrillType, NoteLabel, PoseMap, TeamSide } from './drill.ts';

/** `defaultCast()` 가 만드는 8명의 자리 이름. 팀 + 등번호 — 코치가 부르는 말 그대로다. */
export type SeedTeamSlot = `${TeamSide}-${'G' | '2' | '3' | '4'}`;
/** `[x, y, 각도°]`. 각도는 저장형과 같은 단위(0° = 오른쪽, 90° = 아래). */
export type SeedPose = readonly [x: number, y: number, angleDeg: number];
export type SeedPoint = readonly [x: number, y: number];

export interface SeedArrowSpec {
  /** 끝점 화살촉. 생략하면 좁은 화살표(모델 기본값) — 2026-08-16 이전의 그 모양이다. */
  headTo?: ArrowHead;
  from: SeedPoint;
  to: SeedPoint;
  /** 직선 대비 처짐(px). 양수 = 진행방향 우측. 생략하면 곧은 화살표다. */
  bow?: number;
}
export interface SeedNoteSpec {
  at: SeedPoint;
  text: string;
}

export interface SeedStepSpec {
  name: string;
  /** 스텝 메모. ⚠️ 2026-09-06 — 옛 주석은 *"① 훈련 내용 ⏎ ② `조작: ` 조작 설명. 형식은
   *  seedDrillContent.ts 머리말 참고"* 였다. 그 파일과 형식이 함께 폐기됐다(머리말) — 지금
   *  유일한 (1) 갈래 사용자인 규칙 장면은 그냥 한 문단을 적는다. */
  note: string;
  /** 이 스텝만의 재생 간격(ms). 없으면 드릴 기본값을 따른다. */
  durationMs?: number;
  chairs?: Partial<Record<SeedTeamSlot, SeedPose>>;
  /** i 번째 공의 자리. 배열 길이가 곧 그 스텝에 놓인 공의 수다. */
  balls?: readonly SeedPoint[];
  /** i 번째 콘의 자리. 색은 드릴 쪽 `cones` 배열의 같은 자리에서 온다. */
  cones?: readonly SeedPoint[];
  arrows?: readonly SeedArrowSpec[];
  notes?: readonly SeedNoteSpec[];
}

export interface SeedDrillSpec {
  title: string;
  /** v8 분류 유형(닫힌 목록). 옛 category(열린 string)는 스키마와 함께 은퇴했다. */
  drillType: DrillType;
  /** v8 경기 상황(선택). */
  situation?: DrillSituation;
  level: DrillLevel;
  courtMode: CourtMode;
  /** §5.1 코트 크기 3단. 생략하면 `createDrill` 기본값(30×18)을 따른다 — 이 필드는
   *  2026-08-21 규칙 화면 장면(28×15 고정)을 위해 추가됐다. 기존 씨앗 드릴 3종은 안 쓴다. */
  courtSize?: CourtSize;
  durationMin: number;
  tags?: readonly string[];
  description?: string;
  variation?: string;
  // §3.2 교육 필드 (결정 ⑦ = (B) 중간). 0 = 미지정. (훈련량은 v8 폐기)
  objective?: string;
  coachingPoints?: readonly string[];
  playersNeeded?: number;
  equipment?: string;
  /** §3.4 선수 실명. 안 적은 자리는 등번호로만 불린다. */
  players?: Partial<Record<SeedTeamSlot, string>>;
  /** 콘 **색** 목록(0 = 주황, 1 = 파랑). 스텝의 `cones[i]` 가 이 배열 i 번째 콘의 자리다. */
  cones?: readonly (0 | 1)[];
  steps: readonly SeedStepSpec[];
}

const slotOf = (c: ChairDef): SeedTeamSlot => `${c.team}-${c.number}` as SeedTeamSlot;

/** 공 개수는 **스텝에서 파생한다** — 별도 필드로 두면 스텝에 공을 하나 더 놓고 개수 올리는 것을
 *  잊었을 때 그 공이 cast 에 없어 validate 가 조용히 버린다. 반대로 cast 에만 있고 어느 스텝에도
 *  없는 공은 `defaults.ts` 가 경고한 '놓지도 못하는 유령'이다. 둘 다 파생으로 막는다. */
function ballCountOf(spec: SeedDrillSpec): number {
  let n = 0;
  for (const s of spec.steps) n = Math.max(n, s.balls?.length ?? 0);
  return n;
}

function buildStep(
  s: SeedStepSpec,
  cast: DrillCast,
  chairIdBySlot: ReadonlyMap<SeedTeamSlot, ChairId>,
): DrillStep {
  const chairs: PoseMap<ChairId, StoredChairPose> = {};
  for (const [slot, pose] of Object.entries(s.chairs ?? {}) as [SeedTeamSlot, SeedPose | undefined][]) {
    const id = chairIdBySlot.get(slot);
    if (!id || !pose) continue;
    chairs[id] = { x: pose[0], y: pose[1], angleDeg: pose[2] };
  }

  const balls: PoseMap<BallId, Vec2> = {};
  (s.balls ?? []).forEach((p, i) => {
    const def = cast.balls[i];
    if (def) balls[def.id] = { x: p[0], y: p[1] };
  });

  const cones: PoseMap<ConeId, Vec2> = {};
  (s.cones ?? []).forEach((p, i) => {
    const def = cast.cones[i];
    if (def) cones[def.id] = { x: p[0], y: p[1] };
  });

  const arrows: Arrow[] = (s.arrows ?? []).map((a) => {
    const from: Vec2 = { x: a.from[0], y: a.from[1] };
    const to: Vec2 = { x: a.to[0], y: a.to[1] };
    return { id: newId('ar'), from, ctrl: defaultCtrl(from, to, a.bow ?? 0), to, ...(a.headTo ? { headTo: a.headTo } : {}) };
  });

  const notes: NoteLabel[] = (s.notes ?? []).map((n) => ({ id: newId('nt'), x: n.at[0], y: n.at[1], text: n.text }));

  // 과제⑦(기현님 확정 2026-08-17): 스텝 이름 필드는 UI 에서 폐기됐다 — 저장되는 DrillStep 은
  // 항상 name:''이어야 한다(§스텝 카드). 씨앗 스펙은 여전히 name/note 를 따로 적는다(제목 한
  // 줄 + 본문이 대본을 쓰기 편해서 — ⚠️ 2026-09-06 그 저작 형식의 주인이던 seedDrillContent.ts
  // 는 폐기됐고, 지금은 ruleScenes.ts 의 (1) 갈래 3벌만 이 필드를 쓴다)
  // — 여기서 validate.ts 와 **동일한 규칙**(migrateStepName)으로
  // 미리 병합한다. 정화기가 나중에 또 훑어도(로드 시 validateDrill) 이미 이관된 모양이라
  // 아무것도 바뀌지 않는다 — seedDrills.test.ts 의 "저장 왕복에서 한 글자도 안 바뀐다"
  // 불변식이 이 사전 이관 덕에 성립한다(그 반대로, 여기서 s.name 을 그대로 실었다면 seed
  // 드릴을 처음 여는 순간 정화기가 이관 repair 를 내고 보정 토스트가 뜬다 — 심자마자 "고쳐진"
  // 드릴이 되는 건 온보딩 경험으로 맞지 않는다).
  const nameMig = migrateStepName(s.name, s.note);
  const note = nameMig.kind === 'merged' ? nameMig.note : s.note;

  return {
    id: newId('st'),
    name: '',
    note,
    ...(s.durationMs !== undefined ? { durationMs: s.durationMs } : {}),
    chairs,
    balls,
    cones,
    arrows,
    notes,
    // 씨앗 드릴에는 도형이 없다 — 콘텐츠는 아직 기현님 몫이다(⑥).
    shapes: [],
  };
}

/** 스펙 하나 → 드릴 하나. `createDrill({ empty: true })` 를 뼈대로 쓰는 이유는 스키마 버전·교육
 *  필드 기본값·팀 색·8명 명단이 **한 곳에서만** 정해지게 하기 위해서다 — 여기서 다시 적으면
 *  새 필드가 생길 때마다 두 곳을 고쳐야 하고, 한쪽을 잊으면 seed 드릴만 옛 모양이 된다. */
export function buildSeedDrill(spec: SeedDrillSpec, createdAt: number): Drill {
  const base = createDrill({
    title: spec.title,
    courtMode: spec.courtMode,
    ...(spec.courtSize !== undefined ? { courtSize: spec.courtSize } : {}),
    drillType: spec.drillType,
    level: spec.level,
    durationMin: spec.durationMin,
    empty: true,
  });

  const cast: DrillCast = {
    chairs: base.cast.chairs.map((c) => {
      const name = spec.players?.[slotOf(c)];
      return name ? { ...c, name } : c;
    }),
    balls: Array.from({ length: ballCountOf(spec) }, () => ({ id: newId('bl') })),
    cones: (spec.cones ?? []).map((colorIndex) => ({ id: newId('cn'), colorIndex })),
  };

  const chairIdBySlot = new Map<SeedTeamSlot, ChairId>();
  for (const c of cast.chairs) chairIdBySlot.set(slotOf(c), c.id);

  return {
    ...base,
    tags: [...(spec.tags ?? [])],
    ...(spec.situation !== undefined ? { situation: spec.situation } : {}),
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.variation !== undefined ? { variation: spec.variation } : {}),
    objective: spec.objective ?? '',
    coachingPoints: [...(spec.coachingPoints ?? [])],
    playersNeeded: spec.playersNeeded ?? 0,
    equipment: spec.equipment ?? '',
    cast,
    steps: spec.steps.map((s) => buildStep(s, cast, chairIdBySlot)),
    createdAt,
    updatedAt: createdAt,
  };
}

// 🪦 `SEED_STAGGER_MS`(1000) · `buildSeedDrills(specs, now)` 폐기 — 2026-09-06, 위 머리말의
// 정책 전환. 둘은 "스펙 목록 전량을 지금 시각부터 1초씩 밀어 심는다" 는 **시드 목록**의 규칙이라
// 시드가 규칙 화면으로 옮겨 가면서 갈 곳이 없다. 두 값이 지키려던 것은 각각 이렇게 이어졌다:
//   - 시각을 밀어 목록 정렬을 만든다 → `ruleScenes.ts` 의 `SEED_EPOCH − i·SEED_STEP_BACK_MS`.
//     간격이 1초에서 1분으로 늘고, 기준이 `Date.now()` 에서 **고정 과거 시각**으로 바뀌었다
//     (동기화 LWW 에서 시드가 편집을 이기지 않게 하려면 기계 시계를 읽으면 안 된다).
//   - 부를 때마다 새 id → **뒤집혔다.** 이제 id 는 고정이다(같은 이유: 기기마다 새 id 면
//     동기화 뒤 기기 수만큼 사본이 생긴다). 두 번 심는 것을 막는 책임은 그대로
//     `storage/seed.ts` 의 자물쇠에 있고, 그 자물쇠도 제목 대신 id 를 본다.
