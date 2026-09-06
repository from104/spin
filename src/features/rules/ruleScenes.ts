// 규칙 화면(2026-08-21 신설)의 보드 애니메이션 장면 데이터 — docs/PLAN-RULES-SCREEN.md §B.
//
// **장면 소스는 두 갈래다**(2026-08-31 유니온 개방, docs/PLAN-RULES-9CARDS.md §4):
//
//  (1) `SeedDrillSpec` — 이 파일에 손으로 적는 장면. `model/seedDrills.ts` 의 `buildSeedDrill`
//      변환기를 그대로 쓴다 — 드릴 문서는 id 8종·pose 맵·cast 참조가 얽혀 있어 손으로 `Drill`
//      리터럴을 적으면 오탈자가 조용한 데이터 유실이 된다(그 파일 머리말의 근거와 동일).
//      여기서는 좌표와 문장만 적고, id·cast 연결은 변환기가 기계적으로 만든다.
//  (2) raw `Drill` — 드릴 편집기로 만들어 `scripts/import-rule-scene.mjs` 로 떨군 장면.
//      **역변환(Drill → SeedDrillSpec)은 하지 않는다**: shapes·ballOwner·화살표 색·자유 ctrl·
//      메모 스타일이 `SeedDrillSpec` 표현력 밖이라 되돌리는 순간 구조적으로 유실된다. 대신
//      `SPECS` 의 값 타입을 유니온으로 열고 `'schemaVersion' in src` 로 갈래를 나눈다. 남은
//      손코딩 장면을 하나씩 옮길 수 있고, 마지막 `SeedDrillSpec` 이 사라지는 날 유니온은 저절로
//      접힌다.
//
// (1) 갈래의 코트는 전부 **28×15m(FIPFA 표준 = 농구 코트, courtMode:'full' + courtSize:'28x15')**
// 로 고정한다 — 근거는 docs/RULES-FIPFA-2025.md 의 "앱 반영 시 참고" 절. PX_PER_M=25 로 계산한
// 좌표 상수는 아래 GEO 에 모아 뒀다(court.ts 의 buildFullCourt 계산을 손으로 재현한 값).
// (2) 갈래는 코트 모드·크기를 데이터가 들고 온다 — 이 파일이 정하지 않는다.
//
// 2026-08-31 (2) 갈래에 **12벌이 들어왔다**(계획 §4.2 매핑): kickoff·kick-in·goal-kick·corner·
// dfk·ifk·penalty·inout·scoring·set-ball·three-in-area·two-on-one. 나머지 9개는 손코딩 그대로다.
// 그 뒤 gk-behind-line·two-on-one-gk·two-on-one-gk-only·contested-touch(2026-09-01~03)에 이어
// 2026-09-04 two-on-one-active·two-on-one-escape·spin-kick 이 들어와 (2) 갈래 19벌, 손코딩은
// 3개로 줄었다(field-tour·lineup·two-on-one-open) — 같은 날 ramming 은 카드 8 에서 아예
// 지워졌다(scene 자체가 없다, 위 경위 참조). 전체 장면 수는 23 → 22. 아래 "12벌"·"9개"
// 는 그날의 수다.
//
// ⚠️ 아래 `SEED_SCENE_META`(ring/defense/cutSteps 후처리)와 `RULE_SCENE_CREATED_AT` 은 **(1) 갈래
// 전용**이다. (2) 갈래는 그 값들을 이미 JSON 안에 들고 있고 **그것이 교체의 요점이다** — 여기서
// 덮으면 편집기에서 찍은 것이 이 파일의 표에 지워진다.
//
// **2026-08-31 — 옛 `SCENE_META` 를 둘로 쪼갰다**(계획 §6.1 이 "개명하라"고 남긴 인계의 이행).
// 한 표가 **입력**이면서 동시에 **기대값**이면 어느 쪽인지 아무도 구분할 수 없다: (1) 갈래에서는
// 표를 고치면 장면이 따라 바뀌고(테스트는 계속 초록), (2) 갈래에서는 표를 고치면 테스트가 빨개진다.
// 같은 이름의 같은 칸이 정반대로 행동하는 표는 다음 사람을 반드시 속인다.
//  - `SEED_SCENE_META` — **입력**. (1) 갈래 9개만 담는다. (2) 갈래 12개를 남겨 두면 아무도 읽지
//    않는 값이 살아 있는 것처럼 보인다(옛 표의 12칸이 정확히 그 상태였다).
//  - `RULE_SCENE_EXPECT` — **검사표**. 21개 전부를 담고 **이 파일은 읽지 않는다**
//    (`ruleScenes.test.ts` 전용). 표를 버리면 링·컷 불변식이 **JSON 자기증명**이 되어 조용히
//    무장해제된다. ⚠️ 둘이 (1) 갈래 9개에서 겹쳐 보인다고 **합치지 마라** — 합치는 순간 그 9개의
//    검사가 "내가 넣은 값이 나온다" 는 동어반복이 된다. 겹침은 낭비가 아니라 이중 기장이다.
//
// ⚠️ 옛 표의 값은 **그대로 검사표가 되지 못했다**(2026-08-31 실측). 교체된 12개에서 `ring` 은
// 12/12 일치했지만 `defense` 8개·`cutSteps` 7개(합쳐 장면 9개)가 어긋났다. 어긋난 쪽은
// **데이터가 옳다**: 옛 표는 손코딩 장면을 보고 적은 값이고, 편집기 데이터는 기현님이 판을 보며
// 찍은 값이다(goal-kick 이 옛 표의 defense:'home' 때문에 킥커를 5m 위반으로 칠하던 버그가
// 데이터의 away 로 낫는 것이 §4.1 근거 3 이다). 그래서 검사표는 옛 표를 베끼지 않고 **계획 §4.2
// 표와 docs/RULES-FIPFA-2025.md 의 거리 규정**에서 다시 떴다(표 머리의 「출처」 참조).
//   defense: kickoff away→home · two-on-one·three-in-area·kick-in·goal-kick home→away ·
//            inout·scoring·set-ball 없음(기본 home)→away
//   cutSteps: inout·scoring·three-in-area [1]→없음 · two-on-one [1,2]→없음 ·
//            goal-kick [1]→[2] · kick-in 없음→[2] · corner 없음→[4]
//
// ⚠️ `SeedStepSpec` 에는 `cut` 필드가 없다(seedDrills.ts 는 훈련 드릴만 상대해 왔고 지금까지
// 컷이 필요 없었다). 공용 변환기를 더 건드리지 않기 위해(계획 §B "seedDrills.ts 는 courtSize
// 확장만") **여기서 빌드 후 후처리로** 특정 스텝에 `cut: true` 를 얹는다 —
// `SEED_SCENE_META.cutSteps` 가 0-based 스텝 인덱스를 담는다.
//
// ring/defense 도 같은 이유로 후처리다: `SeedDrillSpec` 에는 `BallDef.ring`(공 개체 속성)과
// `Drill.defense`(드릴 진영)를 실을 자리가 없다 — 씨앗 드릴 3종은 둘 다 쓴 적이 없어서 애초에
// 변환기가 모른다. `ring` 은 표시가 아니라 **규칙 선택**이다(model/drill.ts 의 그 근거 — '5m' 은
// "이 공은 세트피스" 라는 약속이라 그 공은 2-on-1 대신 5m 제한으로 판정된다, model/rules.ts
// ruleForRing). 재시작에 '5m', 2-on-1 에 '3m' 을 얹어 두면 보드가 붙일 RuleOverlay 가 이미
// 검증된 위반 판정 로직을 그대로 재사용한다 — (2) 갈래 12벌도 편집기에서 같은 규칙으로 찍혀 있다.
import type { CourtMode, CourtSize } from '../../model/court.ts';
import type { Drill, StoredBallRing, TeamSide } from '../../model/drill.ts';
import { DEFAULT_TEAMS } from '../../model/defaults.ts';
import { buildSeedDrill } from '../../model/seedDrills.ts';
import type { SeedDrillSpec } from '../../model/seedDrills.ts';

// (2) 갈래 — 편집기가 만든 raw Drill. **파일당 한 장면이다**: 12벌을 이 모듈에 몰면 이 파일이
// 100KB를 넘어(2026-08-31 실측) 손코딩 장면이 그 안에 묻힌다(계획 §4.3).
// ⚠️ 합계 바이트수는 여기 적지 않는다 — 장면이 하나 늘 때마다 낡는 숫자다. 재려면
// `stat -c %s src/features/rules/scenes/*.scene.ts`(`du` 는 압축된 디스크 사용량이라 더 작게 나온다).
// 각 파일은 스크립트가 찍은 것이고
// 머리말에 재실행·드리프트 검사 명령이 박혀 있다.
// ⚠️ 그 명령이 가리키는 봉투(`SPIN_backup_20260831.spin.backup.json`)는 **저장소에 없다** —
// `.gitignore:37` 이 `*.spin.backup.json` 을 막는다(백업엔 기기 데이터가 통째로 들어 있다).
// 드리프트 검사를 돌리려면 그 백업이 손에 있어야 한다. 없으면 이 12벌이 정본이다.
import { drill as kickoffScene } from './scenes/kickoff.scene.ts';
import { drill as inoutScene } from './scenes/inout.scene.ts';
import { drill as scoringScene } from './scenes/scoring.scene.ts';
import { drill as twoOnOneScene } from './scenes/two-on-one.scene.ts';
import { drill as threeInAreaScene } from './scenes/three-in-area.scene.ts';
import { drill as dfkScene } from './scenes/dfk.scene.ts';
import { drill as ifkScene } from './scenes/ifk.scene.ts';
import { drill as penaltyScene } from './scenes/penalty.scene.ts';
import { drill as kickInScene } from './scenes/kick-in.scene.ts';
import { drill as goalKickScene } from './scenes/goal-kick.scene.ts';
import { drill as cornerScene } from './scenes/corner.scene.ts';
import { drill as setBallScene } from './scenes/set-ball.scene.ts';
import { drill as twoOnOneGkOnly } from './scenes/two-on-one-gk-only.scene.ts';
import { drill as gkBehindLine } from './scenes/gk-behind-line.scene.ts';
import { drill as twoOnOneGkDrill } from './scenes/two-on-one-gk.scene.ts';
import { drill as contestedTouchDrill } from './scenes/contested-touch.scene.ts';
import { drill as twoOnOneActiveScene } from './scenes/two-on-one-active.scene.ts';
import { drill as twoOnOneEscapeScene } from './scenes/two-on-one-escape.scene.ts';
import { drill as spinKickScene } from './scenes/spin-kick.scene.ts';
import { sceneTextFor } from './sceneText.ts';
import { translate } from '../../i18n/useT.ts';
import type { Locale } from '../../i18n/locale.ts';
// 아래 둘은 **첫 실행 시드의 순서**를 파생시키는 데만 쓴다(파일 끝 `seedRuleDrills` 절).
// 값 순환은 없다 — 두 모듈이 이 파일에서 가져가는 것은 `RuleSceneId` **타입뿐**이다(erase 된다).
import { RESTART_COLUMNS } from './restartTable.ts';
import { ruleTopicsFor } from './ruleTopics.ts';
import type { DrillId } from '../../core/ids.ts';

export type RuleSceneId =
  | 'field-tour'
  | 'lineup'
  | 'kickoff'
  | 'inout'
  | 'scoring'
  | 'two-on-one'
  | 'two-on-one-active'
  | 'two-on-one-gk'
  | 'two-on-one-gk-only'
  | 'two-on-one-open'
  | 'two-on-one-escape'
  | 'three-in-area'
  | 'spin-kick'
  | 'dfk'
  | 'ifk'
  | 'penalty'
  | 'kick-in'
  | 'goal-kick'
  | 'corner'
  | 'set-ball'
  | 'contested-touch'
  | 'gk-behind-line';

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
 *  고정 타임스탬프 하나만 있으면 된다. (1) 갈래 전용: raw `Drill` 은 자기 것을 들고 온다.
 *
 *  ⚠️ 2026-09-06 — *"장면은 저장되지 않는다"* 는 전제가 죽었다(`seedRuleDrills`, 파일 끝).
 *  그래도 이 상수는 그대로다: 시드로 나가는 값은 이 시각이 아니라 `SEED_EPOCH − i·1분` 으로
 *  **덮어씌워지기 때문**이다. 여기 값은 여전히 화면에만 쓰이는 자리표시자다. */
const RULE_SCENE_CREATED_AT = 1755000000000;

interface RuleSceneMeta {
  /** 첫 공에 얹을 규칙 링 — **그 공이 놓인 모든 스텝에** 같은 값으로 깐다(공이 없는 스텝은
   *  건너뛴다 — 아래 `fromSpec` 의 가드). 생략 = 링 없음.
   *
   *  v9(2026-08-27)에 링이 cast 에서 스텝으로 내려갔지만 여기 표현은 그대로 뒀다: 남은 (1) 갈래
   *  9개는 전부 "장면 내내 같은 링" 이라 스텝별로 적을 것이 없다.
   *  ⚠️ 2026-08-31 정정 — 이 문장이 오래 *"지금 21개 장면은 전부"* 라고 적혀 있었으나 (2) 갈래에는
   *  **스텝마다 링이 다른 장면이 있다** — 12벌 중 **6벌**이다(실측: dfk·ifk·penalty 는 첫 스텝만
   *  5m, goal-kick 은 스텝 2 만, corner 는 스텝 4 만, kick-in 은 스텝 2·3). 나머지 6벌은 이 한계에
   *  걸리지 않는다: kickoff 은 두 스텝 **다** 5m, set-ball·two-on-one 은 1스텝이라 갈릴 자리가
   *  없고, inout·scoring·three-in-area 는 링이 아예 없다. 편집기가 이미 그 표현을 갖고 있어서다.
   *  (재측정: `RULE_SCENE_EXPECT` 의 `rings`·`steps` 를 나란히 읽으면 그대로 세어진다.) 그러니
   *  이 한계는 (1) 갈래에만 남았다 — 여기에도 필요해지면 `cutSteps` 와 같은 꼴로
   *  `ringSteps?: Readonly<Record<number, '3m'|'5m'>>` 를 더하면 된다(주입 루프가 이미 스텝을
   *  돌고 있어 자리는 준비돼 있다). */
  ring?: '3m' | '5m';
  /** Drill.defense 후처리. 생략 = createDrill 기본값(`defaultDefense`: 풀=home, 하프=away). */
  defense?: TeamSide;
  /** 0-based 스텝 인덱스 — 이 스텝들에 cut:true 를 얹는다(보간 없이 즉시 컷). */
  cutSteps?: readonly number[];
}

/** **입력** 표 — (1) 갈래(손코딩 `SeedDrillSpec`) 9개 전용. 파일 머리말의 "표를 둘로 쪼갰다" 참조.
 *
 *  (2) 갈래 12개는 **여기 없다.** 있으면 아무도 읽지 않는 값이 살아 있는 것처럼 보인다.
 *  `Record<RuleSceneId, …>` 가 아니라 `Partial` 인 것도 같은 이유다 — 빠진 키가 곧 "raw Drill 로
 *  옮겨 갔다" 는 뜻이고, `{}` 가 어차피 정당한 값이라(field-tour·lineup·contested-touch) 전수
 *  Record 로 강제해 봐야 얻는 안전이 없다. 실제 안전망은 `RULE_SCENE_EXPECT` 쪽이다. */
const SEED_SCENE_META: Partial<Record<RuleSceneId, RuleSceneMeta>> = {
  'field-tour': {},
  lineup: {},
  'two-on-one-open': { ring: '3m', defense: 'home' },
};

/** 장면 하나가 **담고 있어야 하는 것**. 값의 성격이 칸마다 다르므로 칸별로 근거를 적는다 —
 *  전부 같은 무게의 "사실" 인 척하면 다음 사람이 스냅샷 핀을 규정으로 착각한다. */
export interface RuleSceneExpect {
  /** 코트 모드. (1) 갈래는 전부 'full'(머리말), (2) 갈래는 계획 §4.2 표가 정한다 — 12벌 중
   *  `kickoff` 만 full 이고 나머지 11개가 half. **근거 있는 주장이다.** */
  mode: CourtMode;
  /** 코트 크기. (1) 갈래 '28x15'(FIPFA 표준), (2) 갈래는 §4.2 표대로 전부 '30x18'.
   *  **근거 있는 주장이다.** */
  size: CourtSize;
  /** **스텝별** 링 도장 — `0-based 스텝 인덱스 → 그 스텝에 찍힌 링 종류`(공 하나에 하나씩,
   *  중복 포함·정렬). 링이 하나도 없는 스텝은 **키가 없다.**
   *
   *  종류의 근거는 docs/RULES-FIPFA-2025.md 의 거리 규정이다 — 재개 7종(킥오프·직접/간접FK·
   *  페널티·킥인·골킥·코너킥)은 상대가 공에서 5m, 세트볼은 참여자 외 전원이 3m, 2-on-1 은
   *  공 3m 이내가 판정 반경. **거기까지가 근거 있는 주장이고, 어느 스텝에 찍는가는 스냅샷 핀이다**
   *  — "재개 장면의 몇 번째 판에서 원을 켤까" 는 어느 문서도 규정하지 않는 연출 판단이라
   *  `cut` 과 같은 성격이다.
   *
   *  ⚠️ 2026-08-31 — 옛 정의는 **종류의 집합** 하나였다(`['3m']`). 그 단위는 후처리가 링을
   *  **전 스텝에** 깔던 시절엔 "집합 크기 1 = 전 스텝 전 공" 이라 뜻이 통했지만, 편집기 데이터는
   *  1~2 스텝에만 찍는다(실측: dfk·ifk·penalty 첫 스텝만, goal-kick 스텝 2 만, corner 스텝 4 만,
   *  kick-in 스텝 2·3). 그래서 집합으로 접으면 **링을 잃은 스텝이 초록으로 통과했다** — 링은
   *  장식이 아니라 규칙 선택이라(model/rules.ts `ruleForRing`) 링을 잃은 스텝은 5m 대신
   *  2-on-1 로 판정된다.
   *  개수도 같은 이유로 살린다: `two-on-one` 은 공 2개에 3m 을 각각 찍으므로 `{ 0: ['3m','3m'] }`
   *  이고, 한 공이 링을 잃으면 `['3m']` 이 되어 여기서 빨개진다 — 옛 `two-on-one` 전용 단언이
   *  하던 일을 이 칸이 흡수했다. */
  rings: Readonly<Record<number, readonly StoredBallRing[]>>;
  /** 5m 링이 걸린 스텝에서 **5m 를 물러나야 하는 팀** — `스텝 인덱스 → 팀`. '5m' 이 없는 스텝은
   *  키가 없다(3m 링은 2-on-1 로 판정돼 이 값이 뜻을 잃는다 — `ruleForRing`).
   *
   *  값은 `model/rules.ts` 의 `fiveMeterRetreat(step.ballOwner?.[ballId], defense)` 가 내는 답이고,
   *  그 함수는 **공을 차는 팀의 반대**를 돌려준다(소유가 없으면 진영을 그대로 쓴다).
   *
   *  ⚠️ 세 재개는 **정본이 킥커를 못 박아** 근거 있는 주장이다 — 골킥은 수비 팀이 차고(Law 16),
   *  코너킥은 수비가 마지막으로 건드려 공격 팀이 차며(Law 17), 페널티킥은 자기 골에어리어에서
   *  반칙한 팀(= 그 골을 지키는 수비)의 상대가 찬다(Law 14). 나머지 넷은 **스냅샷 핀**이다:
   *  킥오프의 킥커는 동전 던지기(Law 8), 킥인은 마지막으로 건드린 팀의 상대(Law 15), 프리킥은
   *  반칙당한 팀(Law 12 — 5m 거리 규정만 Law 13) — 전부 장면이 고른 이야기지 규정이 정하는
   *  값이 아니다(어느 팀이 반칙했나·마지막으로 건드렸나를 문서가 정해 주지 않는다). 앞의 셋은
   *  `ruleScenes.test.ts` 가 이 표를 거치지 않고 **진영과의 관계**로 한 번 더 건다.
   *
   *  ⚠️ 이 칸이 없던 동안 `goal-kick` 스텝 2 의 `ballOwner` 를 지워도 테스트가 전부 초록이었다
   *  (2026-08-31 실증). 지우면 `fiveMeterRetreat(undefined,'away') = 'away'` 가 되어 **차는 팀인
   *  away 가 다시 5m 위반으로 칠해진다** — §4.1 근거 3 이 고쳤다는 그 버그의 거울상이다. */
  retreat: Readonly<Record<number, TeamSide>>;
  /** cut:true 스텝의 0-based 인덱스, 오름차순.
   *  ⚠️ **스냅샷 핀이다** — "어디서 뚝 끊을까" 는 어느 문서도 규정하지 않는 연출 판단이라
   *  기댓값을 문서에서 유도할 수 없다. 그래서 이 칸은 "지금 데이터가 이렇다" 를 못 박아 **다시
   *  임베드했을 때 조용히 달라지는 것**을 잡는 용도다. 값이 바뀌었다면 먼저 재임베드를 의심하고,
   *  의도한 변경이면 이 칸을 고친다. 구조적 규칙(컷은 첫 스텝일 수 없다)만은 별도 단언이 지킨다. */
  cut: readonly number[];
  /** 스텝 수. §4.2 가 못 박은 넷은 근거 있는 주장이다 — `inout` 5 · `scoring` 6 ·
   *  `set-ball` 1 · `two-on-one` 1. 나머지는 스냅샷 핀.
   *  ⚠️ 1스텝은 화면 동작을 바꾼다: `RuleSceneBlock` 이 `steps.length > 1` 일 때만 포스터를
   *  그리므로 1스텝 장면은 포스터 없이 정지 판으로 뜬다(RulesScreen.test.tsx 의 포스터 개수가
   *  이 값에 걸려 있다). */
  steps: number;
  /** 수비 진영(왼쪽/아래 골을 지키는 팀).
   *  ⚠️ **스냅샷 핀이다.** 다만 이 칸이 옛 표에서 틀려 실물 버그를 냈으므로(goal-kick 이
   *  킥커를 5m 위반으로 칠했다, §4.1 근거 3) 비워 두지 않는다. 실측하면 21/21 이
   *  `defaultDefense(courtMode)`(풀=home, 하프=away)와 같다 — 즉 지금은 `mode` 에서 유도되는
   *  값이지만, **그 기본값에서 벗어나는 장면이 들어오는 순간 이 칸이 그 사실을 드러낸다.**
   *  유도로 바꿔 적으면 그 예외가 영원히 안 보인다. */
  defense: TeamSide;
}

/** **검사표** — 21개 전수. **이 파일은 읽지 않는다**(`ruleScenes.test.ts` 전용).
 *
 *  출처: (2) 갈래 12개는 계획 §4.2 표(코트)와 docs/RULES-FIPFA-2025.md(거리 5m/3m · 재개별
 *  킥커). (1) 갈래 9개는 이 파일의 `SPECS` 리터럴과 `SEED_SCENE_META` 가 **주장하는** 값을 손으로
 *  옮겨 적은 것 — 파생이 아니라 **재진술**이다. 후처리 루프가 조용히 망가지면(예: "공 없는 스텝엔
 *  링도 없다" 가드가 전부를 떨구면) 그 재진술만이 알아챈다. 그래서 두 표를 합치면 안 된다.
 *
 *  ⚠️ 값이 데이터와 어긋나면 **표를 먼저 의심하라.** 옛 `SCENE_META` 를 그대로 뒤집었다면 9개가
 *  즉시 빨개졌을 것이고, 그때 옳은 쪽은 데이터였다(머리말의 실측 목록). */
export const RULE_SCENE_EXPECT: Record<RuleSceneId, RuleSceneExpect> = {
  // ── (1) 손코딩 갈래 9개 — 28×15 풀 코트 고정 ───────────────────────────────────────────────
  // 링은 `SEED_SCENE_META.ring` 이 **공이 놓인 모든 스텝에** 같은 값으로 깐다(`fromSpec`) —
  // 그래서 2-on-1 4종은 스텝 인덱스가 빠짐없이 채워져 있고, 그 빈틈없음 자체가 후처리 루프가
  // 살아 있다는 증거다(가드 하나가 전부를 떨구면 여기가 빨개진다).
  'field-tour': { mode: 'full', size: '28x15', rings: {}, retreat: {}, cut: [], steps: 1, defense: 'home' },
  lineup: { mode: 'full', size: '28x15', rings: {}, retreat: {}, cut: [], steps: 1, defense: 'home' },
  // 2026-09-04 (2) 갈래로 교체 — 옛 핀 { full 28x15 · cut [1] · home } 은 손코딩 원고 값이었다.
  // 편집기 데이터는 하프 코트(defaultDefense 가 away)이고 컷을 두지 않았다. 링 3m 은 두 스텝 다 그대로.
  'two-on-one-active': { mode: 'half', size: '30x18', rings: { 0: ['3m'], 1: ['3m'] }, retreat: {}, cut: [], steps: 2, defense: 'away' },
  'two-on-one-open': { mode: 'full', size: '28x15', rings: { 0: ['3m'], 1: ['3m'] }, retreat: {}, cut: [], steps: 2, defense: 'home' },
  // 2026-09-04 (2) 갈래로 교체 — 우연히 옛 손코딩 핀과 mode·size·defense·rings·cut·steps 값이 전부 같다.
  'two-on-one-escape': { mode: 'full', size: '28x15', rings: { 0: ['3m'], 1: ['3m'], 2: ['3m'] }, retreat: {}, cut: [], steps: 3, defense: 'home' },
  // 2026-09-04 (2) 갈래로 교체 — 옛 핀 { full 28x15 · 3스텝 · cut [2] · home } 은 손코딩 원고 값이었다.
  // 편집기 데이터는 하프 코트(defaultDefense 가 away)이고 1스텝이라 컷이 없다.
  'spin-kick': { mode: 'half', size: '30x18', rings: {}, retreat: {}, cut: [], steps: 1, defense: 'away' },

  // ── (2) 편집기 갈래 12개 — 30×18, kickoff 만 full (§4.2) ──────────────────────────────────
  // 여기 `rings` 는 **띄엄띄엄하다** — 편집기 데이터는 링을 재개가 실제로 일어나는 판에만 찍는다.
  // 그 배치가 7종에서 서로 다른 것은 기현님 판단 항목으로 남겨 뒀다(계획 §4.2 인계).
  kickoff: { mode: 'full', size: '30x18', rings: { 0: ['5m'], 1: ['5m'] }, retreat: { 0: 'home', 1: 'home' }, cut: [], steps: 2, defense: 'home' },
  inout: { mode: 'half', size: '30x18', rings: {}, retreat: {}, cut: [], steps: 5, defense: 'away' },
  scoring: { mode: 'half', size: '30x18', rings: {}, retreat: {}, cut: [], steps: 6, defense: 'away' },
  'two-on-one': { mode: 'half', size: '30x18', rings: { 0: ['3m', '3m'] }, retreat: {}, cut: [], steps: 1, defense: 'away' },
  // 🆕 2026-09-01 기현님 신규 4벌. 3m 링은 2-on-1 판정이므로 `retreat` 는 비어 있는 것이 맞다
  // (5m 후퇴 대상이 아니다). `gk-behind-line` 만 5m 이고, 소유가 home(공격)이므로 물러날 팀은
  // away — 정본 Law 13 의 "상대는 5m 이상"에서 유도한 값이지 데이터를 베낀 것이 아니다.
  'two-on-one-gk': { mode: 'half', size: '30x18', rings: { 0: ['3m'], 1: ['3m'], 2: ['3m'] }, retreat: {}, cut: [], steps: 3, defense: 'away' },
  'two-on-one-gk-only': { mode: 'half', size: '30x18', rings: { 0: ['3m'], 1: ['3m'], 2: ['3m'] }, retreat: {}, cut: [], steps: 3, defense: 'away' },
  'contested-touch': { mode: 'half', size: '30x18', rings: {}, retreat: {}, cut: [], steps: 3, defense: 'away' },
  'gk-behind-line': { mode: 'half', size: '30x18', rings: { 0: ['5m'], 1: ['5m'] }, retreat: { 0: 'away', 1: 'away' }, cut: [], steps: 2, defense: 'away' },
  'three-in-area': { mode: 'half', size: '30x18', rings: {}, retreat: {}, cut: [], steps: 2, defense: 'away' },
  dfk: { mode: 'half', size: '30x18', rings: { 0: ['5m'] }, retreat: { 0: 'away' }, cut: [], steps: 2, defense: 'away' },
  ifk: { mode: 'half', size: '30x18', rings: { 0: ['5m'] }, retreat: { 0: 'away' }, cut: [], steps: 3, defense: 'away' },
  penalty: { mode: 'half', size: '30x18', rings: { 0: ['5m'] }, retreat: { 0: 'away' }, cut: [], steps: 2, defense: 'away' },
  // ⚠️ 스텝 3 은 링이 있는데 `ballOwner` 가 없다 — 폴백(진영 'away')이 스텝 2 의 답과 우연히
  // 같아서 값이 갈라지지 않는다. 우연이 깨지는 날을 위해 기현님 판단 항목으로 올려 뒀다.
  'kick-in': { mode: 'half', size: '30x18', rings: { 2: ['5m'], 3: ['5m'] }, retreat: { 2: 'away', 3: 'away' }, cut: [2], steps: 4, defense: 'away' },
  // ⚠️ **이 커밋의 간판.** 골킥은 정본 Law 16 대로 **수비 팀(= 진영 away)이 찬다** — 그래서
  // 물러나는 팀은 그 반대인 'home' 이고, 진영과 다른 유일한 칸이다. 옛 표가 이 자리를 진영으로
  // 읽어 킥커를 5m 위반으로 칠했다(§4.1 근거 3).
  'goal-kick': { mode: 'half', size: '30x18', rings: { 2: ['5m'] }, retreat: { 2: 'home' }, cut: [2], steps: 4, defense: 'away' },
  corner: { mode: 'half', size: '30x18', rings: { 4: ['5m'] }, retreat: { 4: 'away' }, cut: [4], steps: 5, defense: 'away' },
  'set-ball': { mode: 'half', size: '30x18', rings: { 0: ['3m'] }, retreat: {}, cut: [], steps: 1, defense: 'away' },
};

/** 정본이 **킥커를 못 박는** 재개 — 값이 아니라 `Drill.defense` 와의 **관계**다.
 *
 *  `RULE_SCENE_EXPECT.retreat` 는 손으로 옮겨 적은 표라 데이터에 맞춰 고쳐지면 그만이다.
 *  이 표는 그 자리를 한 겹 더 받는다: 여기 셋은 "누가 차는가" 가 docs/RULES-FIPFA-2025.md 로
 *  결정되므로, 물러나는 팀을 **장면 데이터를 보지 않고** 진영에서 유도할 수 있다.
 *  `ruleScenes.test.ts` 가 유도한 값과 데이터를 대조한다.
 *
 *  - `goal-kick` — Law 16: *"수비 팀 선수가 골에어리어 안 임의 지점에서 찬다"* → 킥커 = 진영.
 *  - `corner` — Law 17: *"수비 팀이 마지막으로 건드린 공이 골라인을 완전히 넘으면 코너킥"* →
 *    킥커 = 공격(진영의 반대).
 *  - `penalty` — Law 14: *"자기 팀 골에어리어 안에서 … 반칙을 저지르면 페널티킥"* → 반칙한 쪽이
 *    그 골을 지키는 진영이므로 킥커 = 공격.
 *
 *  나머지 넷은 여기 **없다.** 킥오프의 킥커는 동전 던지기(Law 8), 킥인은 마지막으로 건드린 팀의
 *  상대(Law 15), 직접/간접프리킥은 반칙당한 팀(Law 12 — *"아래 반칙을 저지르면 상대 팀에
 *  직접프리킥"*. Law 13 이 정하는 것은 5m 거리이지 누가 차는가가 아니다) — 정본은 관계만 정하고
 *  누가 반칙했나·누가 마지막으로 건드렸나는 장면이 고른다.
 *  없는 근거를 지어내 넣으면 이 표의 뜻이 곧바로 죽는다. */
export const RULE_SCENE_KICKER_BY_LAW: Partial<Record<RuleSceneId, 'defense' | 'attack'>> = {
  'goal-kick': 'defense',
  corner: 'attack',
  penalty: 'attack',
};

// 값 타입이 유니온인 이유는 머리말 (2) 참조. `'schemaVersion' in src` 로 갈래를 나눈다 —
// `SeedDrillSpec` 에는 그 키가 없다(seedDrills.ts 는 스키마 버전을 `createDrill` 이 붙이게 둔다).
const SPECS: Record<RuleSceneId, SeedDrillSpec | Drill> = {
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
  kickoff: kickoffScene,

  // ── Law 9 — 인/아웃 플레이 ──────────────────────────────────────────────────────────────
  inout: inoutScene,

  // ── Law 10 — 득점 방법 ──────────────────────────────────────────────────────────────────
  scoring: scoringScene,

  // ── Law 11 — 필드 포지션: 2-on-1 ────────────────────────────────────────────────────────
  'two-on-one': twoOnOneScene,

  // ── Law 11 — 2-on-1: 액티브 플레이 관여 전/후 ────────────────────────────
  // 2026-09-04 기현 지시(*"규칙카드 7번 2번째 장면을 … 로 교체"*)로 손코딩 → 편집기 드릴
  // "2대1 반칙의 성립"(half/30x18, 2스텝). 옛 손코딩 원고는 git 이력에 있다(a4c5adb 이전).
  'two-on-one-active': twoOnOneActiveScene,

  // ── Law 11 — 2-on-1: 골키퍼 예외 ────────────────────────────────────────────────────────
  'two-on-one-gk': twoOnOneGkDrill,
  'two-on-one-gk-only': twoOnOneGkOnly,

  // ── Law 11 — 2-on-1: 상대 없음 예외 ─────────────────────────────────────────────────────
  'two-on-one-open': {
    title: '2-on-1 — 상대 없음 예외',
    drillType: 'tactical',
    situation: '2-on-1-spacing',
    level: '초급',
    courtMode: 'full',
    courtSize: COURT_SIZE,
    durationMin: 1,
    steps: [
      {
        name: '',
        note: '같은 팀 2명이 공 3m 안에 있어도, 그 3m 안에 상대가 아예 없으면 2-on-1이 아닙니다.',
        chairs: {
          'home-2': [360, 210, 20],
          'home-3': [410, 240, 200],
          'away-3': [560, 150, 180],
        },
        balls: [[387.5, 225]],
      },
      {
        name: '',
        note: '상대(점선 밖)가 3m 안으로 들어오기 전까지는 아무리 팀원이 모여도 위반이 될 수 없습니다.',
        chairs: {
          'home-2': [360, 210, 20],
          'home-3': [410, 240, 200],
          'away-3': [560, 150, 180],
        },
        balls: [[387.5, 225]],
        notes: [{ at: [387.5, 190], text: '상대 없음 — 위반 아님' }],
      },
    ],
  },

  // ── Law 11 — 2-on-1: 회피 이탈 ──────────────────────────────────────────
  // 2026-09-04 기현 지시로 손코딩 → 편집기 드릴 "2매1 반칙 일시적 회피"(full/28x15, 3스텝).
  // 옛 손코딩 원고는 git 이력에 있다(42366d1 이전).
  'two-on-one-escape': twoOnOneEscapeScene,

  // ── Law 11 — 필드 포지션: 골에어리어 3인 ────────────────────────────────────────────────
  'three-in-area': threeInAreaScene,

  // ── Law 12 — 반칙과 비신사적 행위: 램핑 ──────────────────────────────────────────────────
  // 2026-09-04 기현 지시로 카드 8 에서 이 장면을 지웠다 — ruleTopics.ts 의 카드 8 'ramming'
  // scene 블록을 없애고 그 앞 두 prose 블록을 하나로 합쳤다(중복 정의 제거). 이 장면은
  // 어디에도 배치되지 않으므로(ruleTopics.test.ts 의 '고아 장면 없음' 불변식) 완전히
  // 뺀다 — RuleSceneId 유니온·RULE_SCENE_IDS·SEED_SCENE_META·RULE_SCENE_EXPECT 전부에서.
  // ruleContent.ts(룰 북 부록) Law 12 의 sceneId 참조도 같이 뺐다 — 그쪽은 애초에 이
  // 불변식이 세는 '배치'가 아니었다(law-index 는 RuleSceneBlock 을 그리지 않는다). 옛
  // 좌표는 git 이력에 있다(이 커밋 이전).

  // ── Law 12 — 회전킥(스핀킥)에 관하여 ────────────────────────────────────────
  // 2026-09-04 기현 지시로 손코딩 → 편집기 드릴 "회전킥 시도 및 방해"(half/30x18, 1스텝).
  // 옛 손코딩 원고는 git 이력에 있다(917c193 이전).
  'spin-kick': spinKickScene,

  // ── Law 13 — 프리킥: 직접 ───────────────────────────────────────────────────────────────
  dfk: dfkScene,

  // ── Law 13 — 프리킥: 간접 ───────────────────────────────────────────────────────────────
  ifk: ifkScene,

  // ── Law 14 — 페널티킥 ───────────────────────────────────────────────────────────────────
  penalty: penaltyScene,

  // ── Law 15 — 킥인 ───────────────────────────────────────────────────────────────────────
  'kick-in': kickInScene,

  // ── Law 16 — 골킥 ───────────────────────────────────────────────────────────────────────
  'goal-kick': goalKickScene,

  // ── Law 17 — 코너킥 ─────────────────────────────────────────────────────────────────────
  corner: cornerScene,

  // ── Law 8 — 세트볼(Set Ball) ────────────────────────────────────────────────────────────
  'set-ball': setBallScene,

  // ── Law 15 — 경합: 동시 접촉 주행 ───────────────────────────────────────────────────────
  'contested-touch': contestedTouchDrill,
  'gk-behind-line': gkBehindLine,
};

/** 장면 하나를 만든다. 갈래는 머리말 (1)/(2) — `'schemaVersion' in src` 하나로 갈린다.
 *
 *  `?? {}` 는 "(1) 갈래인데 메타가 없다" = 링·컷·진영 후처리가 없다는 뜻이다. `{}` 는 정당한
 *  값이므로(field-tour 등) 여기서 던지지 않는다 — 값이 실제로 맞는지는 `RULE_SCENE_EXPECT` 가 본다. */
export function buildRuleScene(id: RuleSceneId, locale: Locale = 'ko'): Drill {
  const src = SPECS[id];
  const drill = 'schemaVersion' in src ? fromRawDrill(src) : fromSpec(src, SEED_SCENE_META[id] ?? {});
  return applySceneLocale(drill, id, locale);
}

/** 손코딩 9개의 스텝 노트를 로케일판으로 갈아끼운다.
 *
 *  ⚠️ **편집기에서 온 12개는 건드리지 않는다** — 그 코트 위 쪽지는 기현님이 찍은 좌표 데이터
 *  안에 있고, 로케일별로 바꾸려면 드릴 데이터 모델 결정이 선행된다(PLAN-RULES-9CARDS §9.3-4).
 *  `SCENE_NOTES_EN` 에 그 12개의 키가 아예 없는 것이 그 경계선이다.
 *
 *  스텝 수가 다르면 **아무것도 바꾸지 않는다** — 인덱스가 어긋난 채 절반만 갈아끼우면 그 장면은
 *  한국어와 영어가 뒤섞인 채로 뜬다. 조용히 원본을 쓰는 편이 낫다(그 경우 노트 띠가 한국어로
 *  남고, 화면의 안내가 이미 그 가능성을 말한다). */
function applySceneLocale(drill: Drill, id: RuleSceneId, locale: Locale): Drill {
  if (locale === 'ko') return drill;

  // 팀 이름은 **모든** 장면에 적용한다 — 편집기에서 온 12개도 포함이다. 좌표·쪽지는 기현님
  // 저작물이지만 팀 이름은 `fromRawDrill` 이 이미 앱 기본값으로 덮어쓰던 값이라 기현님이 찍은
  // 것이 아니다. 화면 글자로는 안 보이지만 **체어의 aria-label 과 위반 발화**에 들어간다
  // (`PresentObjects.tsx`·`RuleOverlay.tsx`) — 영어 화면에서 스크린리더가 "우리 팀 4번" 이라고
  // 읽던 자리다.
  const teams = {
    home: { ...drill.teams.home, label: translate(locale, 'team.defaultHomeLabel') },
    away: { ...drill.teams.away, label: translate(locale, 'team.defaultAwayLabel') },
  };

  const text = sceneTextFor(locale)?.[id];
  if (!text) return { ...drill, teams };

  // ⚠️ **개수가 어긋나면 그 종류는 통째로 원본을 쓴다.** 기현님이 쪽지를 고쳐 개수가 달라지는
  // 날, 절반만 덮으면 한 장면 안에 두 언어가 섞인다 — 조용히 한국어로 되돌아가는 편이 낫다
  // (깨지지 않고 **되돌아가는** 것이 오버레이 설계의 요점이다, `sceneText.ts` 머리말).
  const useNote = text.note?.length === drill.steps.length;
  const useLabels = text.labels?.length === drill.steps.length;
  if (!useNote && !useLabels) return { ...drill, teams };

  return {
    ...drill,
    teams,
    steps: drill.steps.map((st, i) => ({
      ...st,
      note: useNote ? (text.note![i] ?? st.note) : st.note,
      notes:
        useLabels && text.labels![i]!.length === st.notes.length
          ? st.notes.map((n, j) => ({ ...n, text: text.labels![i]![j] ?? n.text }))
          : st.notes,
    })),
  };
}

/** (2) 편집기가 만든 raw `Drill`. **후처리를 하지 않는 것이 이 갈래의 요점이다** — ring·defense·
 *  cut·좌표·메모는 이미 데이터 안에 있고, 표로 덮으면 편집기에서 찍은 것이 지워진다. 그래서 이
 *  12개는 `SEED_SCENE_META` 에 **키조차 없다** — 후처리가 실수로 되살아날 자리를 없앤 것이다.
 *
 *  두 가지만 손댄다.
 *  - `teams`: 앱 기본값(`DEFAULT_TEAMS`)으로 갈아끼운다. 안 하면 드릴을 만든 기기의 팀색·팀이름이
 *    규칙 화면 팀색으로 굳는다 — 규칙 도해는 특정 기기 설정이 아니라 앱 기본을 보여야 한다.
 *    (지금 들어 있는 12벌은 이미 기본값이라 값이 안 바뀐다. 앞으로 들어올 것을 위한 방어다.)
 *  - 사본: 모듈 상수를 그대로 넘기면 호출자가 공유 객체를 잡는다. `buildSeedDrill` 갈래는 매번
 *    새 객체를 주므로, 두 갈래의 계약을 같게 맞춘다.
 *
 *  **`title`·`id`·`createdAt`/`updatedAt` 은 봉투 값 그대로 둔다**(2026-08-31 판단, 근거 셋).
 *  - `title`: 규칙 화면은 드릴 제목을 **안 그린다** — `RuleSceneBlock` 이 쓰는 것은 코트·스텝
 *    수·`step.note` 뿐이고(`PresentStage` 도 title 을 안 읽는다), 화면에 보이는 제목은 별개
 *    데이터인 `topic.title`/`law.title`(RuleTopicDoc)이다. 그래서 조항 형식('제8조 —')으로
 *    고쳐 적어도 보이는 것이 없고, 대신 기현님 라이브러리의 제목('2-1 킥오프')을 그대로 두면
 *    그 제목이 곧 `--title` 키라 `--check` 드리프트 검사가 계속 산다.
 *  - `id`: 라이브러리와 같은 `dr_…` 를 들고 오지만 이 값은 **저장소에 닿지 않는다** —
 *    `buildRuleScene` 호출자는 `RuleSceneBlock` 하나뿐이고(그 밖은 테스트), 거기서 드릴은
 *    `PresentStage` 로 내려가 그려지기만 한다. 규칙 화면에 쓰기 경로가 없다(features/rules 전체에
 *    storage/repo 호출 0건). 접두사를 붙이면 원본과 대조가 끊기므로 붙이지 않는다. 언젠가 이
 *    드릴을 저장하는 경로가 생기면 **그때** 접두사가 필요해진다.
 *
 *    ── ⚠️ 2026-09-06: *"저장소에 닿지 않는다"* 가 죽었다(그 "언젠가" 가 왔다) ──────────────
 *    `seedRuleDrills`(파일 끝)가 이 봉투 id 를 **그대로 첫 실행 시드의 드릴 id 로 심는다.**
 *    그래도 접두사는 여전히 붙이지 않는다 — 이유가 뒤집힌 게 아니라 **더 세졌다**: 기기마다
 *    다른 id 를 발급하면 동기화 뒤 사본이 생기므로 id 는 소스에 박힌 값이어야 하고, 봉투 id 가
 *    바로 그 값이다. 대가는 라이브러리 원본 드릴과 시드가 같은 id 를 갖는 것인데, 원본은
 *    기현님 기기의 문서라 남의 기기와 만나지 않는다.
 *  - 타임스탬프: `RULE_SCENE_CREATED_AT` 이 지키려던 것은 "빌드할 때마다 값이 달라지지 않는 것"
 *    이다. 봉투 값도 소스에 박힌 리터럴이라 그 재현성은 그대로다(기계 시계를 읽지 않는다). */
function fromRawDrill(src: Drill): Drill {
  return {
    ...structuredClone(src),
    teams: { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } },
  };
}

/** (1) 손코딩 `SeedDrillSpec`. `ring`/`defense`/`cut` 은 `SeedDrillSpec` 표현력 밖이라
 *  변환 후 후처리한다(파일 머리말 근거). */
function fromSpec(spec: SeedDrillSpec, meta: RuleSceneMeta): Drill {
  const drill = buildSeedDrill(spec, RULE_SCENE_CREATED_AT);

  // v9 — 링은 스텝 소유다. cut 과 **한 번의 순회**로 함께 얹는다.
  const cutSet = new Set(meta.cutSteps ?? []);
  const ringBallId = meta.ring !== undefined ? drill.cast.balls[0]?.id : undefined;
  const steps =
    cutSet.size === 0 && ringBallId === undefined
      ? drill.steps
      : drill.steps.map((step, i) => {
          let out = cutSet.has(i) ? { ...step, cut: true as const } : step;
          // 그 스텝의 판에 공이 없으면 링도 없다 — validate 가 고아로 떨굴 값을 만들지 않는다.
          if (ringBallId !== undefined && meta.ring !== undefined && step.balls[ringBallId] !== undefined) {
            out = { ...out, ballRings: { [ringBallId]: meta.ring } };
          }
          return out;
        });

  return {
    ...drill,
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
  'two-on-one-active',
  'two-on-one-gk',
  'two-on-one-gk-only',
  'two-on-one-open',
  'two-on-one-escape',
  'three-in-area',
  'spin-kick',
  'dfk',
  'ifk',
  'penalty',
  'kick-in',
  'goal-kick',
  'corner',
  'set-ball',
  'contested-touch',
  'gk-behind-line',
];

// ⚠️ 상태 정정(2026-08-31). 이 export 와 머리말은 오래 *"ruleScenes.test.ts 가
// courtDefFor('full','28x15') 와 대조해 드리프트를 잡는다"* 고 적어 왔지만 **그런 단언은 실재한
// 적이 없다** — `rg courtDefFor src/features/rules/*.test.ts` 가 0건이다. 즉 지금 GEO 는
// **읽는 코드가 없다**: 위 (1) 갈래 장면들의 좌표는 GEO 를 참조하지 않고 손으로 적힌 리터럴이고,
// GEO 는 그 숫자들이 어디서 나왔는지를 적어 둔 대조표다.
//
// 그래도 지우지 않는 이유: 약속된 그 드리프트 테스트가 아직 **쓸 값이 있는** 물건이다. 손코딩
// 장면 9개가 남아 있는 한 court.ts 의 28×15 계산이 바뀌면 그 좌표들은 조용히 어긋나고, 그걸
// 잡는 유일한 재료가 이 표다.
//
// ✅ 2026-08-31 — **그 테스트를 붙였다.** `ruleScenes.test.ts` 의 describe
// *"RULE_SCENE_GEO ↔ court.ts 드리프트"* 가 `courtDefFor('full','28x15')` 와 위 표를 대조한다
// (viewBox·경기면·중심·센터 마크·골포스트 4개·골에어리어 2개+깊이·페널티 마크 2개).
// 이 export 는 그 단언 하나가 유일한 소비자다 — 즉 **읽는 코드가 생겼다.**
//
// ⚠️ 여기 세 번이나 "붙이면 쓸 값이 있다" 는 약속만 적혔던 자리다(그 반복 자체가 지적이었다).
// **약속을 더 적지 마라** — 다음 사람이 이 표에 뭔가 더 해야 한다고 생각되면, 적는 대신 붙여라.
// 손코딩 장면이 0개가 되는 날에는 표와 단언을 함께 지운다.
export { GEO as RULE_SCENE_GEO };

// ── 첫 실행 시드 (2026-09-06) — docs/PLAN-SEED-FROM-RULES.md 가 정본 ──────────────────────
//
// 기현 지시(2026-09-06): *"첫 실행시 기본 저장되어있는 드릴을 규칙에 있는 드릴로 교체 (앞으로 쭉
// 그 정책 유지"*
//
// **첫 실행에 심는 드릴의 정본은 위 `RULE_SCENE_IDS` 하나다.** 규칙에 장면을 넣으면 시드에도
// 들어가고, 빼면 시드에서도 빠진다 — 시드 전용 목록도, 시드 전용 손코딩도 앞으로 없다(AGENTS.md
// §5 의 연장이다: 코트 위 콘텐츠는 편집기로 만든다).
//
// 폐기된 것: 손코딩 시드 3벌(`model/seedDrillContent.ts`). 그 파일이 지키던 **온보딩 내레이션**
// (스텝 메모로 앱 조작법을 읽어 주던 장치)은 이 정책과 함께 잃는다 — 규칙 장면은 메모가 거의
// 비어 있고 코트 위 쪽지로 말한다. 그 장치가 다시 필요해지면 장면 메모를 **편집기에서** 채워
// 재임포트한다(손코딩 금지는 그대로). 옛 근거의 전문은 `model/seedDrills.ts` 머리말에 남겼다.

/** 시드 드릴의 기준 시각 — 2026-09-06T00:00:00Z. **기계 시계를 읽지 않는 것이 요점이다.**
 *
 *  동기화는 LWW 다(`sync/plan.ts`). 심을 때 `Date.now()` 를 쓰면 나중에 첫 실행한 기기의
 *  **손 안 댄 시드**가 다른 기기에서 고친 같은 문서를 이긴다 — 편집이 조용히 사라진다. 과거의
 *  고정 시각이면 사용자가 손댄 쪽이 항상 새롭고, 지운 것(톰스톤)도 시드보다 새로워 되살아나지
 *  않는다. 값이 미래로 가면 안 되는 이유도 같다(그러면 시드가 편집을 이긴다). */
export const SEED_EPOCH = Date.UTC(2026, 8, 6);

/** 카드 순서 i 마다 시각을 1분씩 **뒤로** 민다 — 목록 기본 정렬(updatedAt 내림차순)이 그대로
 *  규칙 카드 순서가 된다. 1분은 사람이 못 느끼면서 정렬은 확실히 가르는 폭이고, 22벌을 다 밀어도
 *  21분이라 `SEED_EPOCH` 당일을 벗어나지 않는다. */
export const SEED_STEP_BACK_MS = 60_000;

/** (1) 갈래 3벌의 **고정 드릴 id**. (2) 갈래 19벌은 `.scene.ts` 봉투의 리터럴 id 를 그대로 쓴다
 *  (`fromRawDrill` 이 id 를 안 건드린다) — 여기 적을 것이 없다.
 *
 *  ⚠️ **기기마다 `newId('dr')` 를 발급하면 안 된다.** 그러면 동기화 뒤 기기 수만큼 사본이 생긴다
 *  (옛 시드의 알려진 결함). 같은 id 면 어디서 심어도 한 벌이고, 한쪽에서 고친 것이 LWW 로 이긴다.
 *  형식: 접두 `dr_` + 소문자·숫자·밑줄 → `isId(id, 'dr')` 를 통과한다(`core/ids.ts`).
 *  **이 값은 바꾸지 마라** — 바꾸는 순간 이미 심은 기기에서 사본이 하나 더 생긴다. */
const SEED_DRILL_ID: Partial<Record<RuleSceneId, DrillId>> = {
  'field-tour': 'dr_rule_field_tour',
  lineup: 'dr_rule_lineup',
  'two-on-one-open': 'dr_rule_two_on_one_open',
};

/** 시드 순서 = **규칙 화면이 장면을 내놓는 순서** 그대로: 카드(`ruleTopicsFor` 배열) 순 → 카드 안
 *  블록 순 → 재개 비교표 자리에서는 그 표의 열 순서(`RESTART_COLUMNS`)로 7벌.
 *
 *  ⚠️ **순서 목록을 여기 손으로 적지 않는다.** 적는 순간 카드를 재배열하는 사람이 두 곳을 고쳐야
 *  하고, 한쪽을 잊으면 목록만 옛 순서로 남는다(§3 정본 하나). 카드 배치의 정본은 `ruleTopics.ts`
 *  배열이므로 거기서 파생한다 — `ruleTopics.test.ts` 의 '고아 장면 없음' 불변식이 도는 것과 같은
 *  순회이고, 재개 7종을 표에서 집어 오는 것도 그 불변식과 같은 이유다(카드 5 는 그 7벌을 scene
 *  블록이 아니라 표 블록으로 연다).
 *
 *  로케일을 보지 않는 이유: `TOPICS_EN`/`TOPICS_JA` 는 같은 구조의 번역본이라 어느 쪽으로 걸어도
 *  같은 순서가 나온다. ko 하나로 고정해 두면 언어를 바꿔도 목록 순서가 흔들리지 않는다.
 *
 *  어느 카드에도 안 실린 장면은 **끝에** 붙인다. 지금은 없지만(고아 0), 생기더라도 시드에서
 *  조용히 사라지는 것보다 목록 맨 아래에 있는 편이 낫다. */
export function ruleSceneCardOrder(): readonly RuleSceneId[] {
  const seen = new Set<RuleSceneId>();
  const out: RuleSceneId[] = [];
  const push = (id: RuleSceneId): void => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const topic of ruleTopicsFor('ko')) {
    for (const block of topic.blocks) {
      if (block.kind === 'scene') push(block.sceneId);
      else if (block.kind === 'restart-table') for (const col of RESTART_COLUMNS) push(col.sceneId);
    }
  }
  for (const id of RULE_SCENE_IDS) push(id);
  return out;
}

/** 첫 실행에 심을 드릴 전량(22벌). `storage/seed.ts` 가 유일한 제품 호출자다.
 *
 *  장면과 다른 점은 셋뿐이고, 셋 다 **저장되기 때문에** 생긴다(장면은 인메모리라 상관없었다).
 *  - `id`: (1) 갈래는 위 고정 표, (2) 갈래는 봉투 id. 기기 간 동일성이 사본을 막는다.
 *  - `createdAt`/`updatedAt`: `SEED_EPOCH − i·1분`. 기계 시계를 안 읽는다(위 상수 근거).
 *  - 그 외에는 `buildRuleScene` 결과 그대로다 — **두 번째 변환 경로를 만들지 않는다.**
 *
 *  **제목은 손대지 않는다**(결정 7). 규칙 화면이 장면에 붙이는 캡션 표가 코드에 없어서다 —
 *  화면에 뜨는 제목은 카드/조항 제목(`ruleTopics`·`ruleContent`)이지 드릴 제목이 아니라
 *  장면별 캡션이라는 것이 애초에 존재하지 않는다. 없는 표를 시드를 위해 새로 만들면 그것이
 *  다음 드리프트의 발원지가 되므로(§3), 편집기 원본 제목('2-1 킥오프' 꼴)을 그대로 쓴다.
 *  그 제목은 `--check` 드리프트 검사의 `--title` 키이기도 해서 살아 있을 값이다. */
export function seedRuleDrills(locale: Locale = 'ko'): Drill[] {
  return ruleSceneCardOrder().map((sceneId, i) => {
    const scene = buildRuleScene(sceneId, locale);
    const at = SEED_EPOCH - i * SEED_STEP_BACK_MS;
    return { ...scene, id: SEED_DRILL_ID[sceneId] ?? scene.id, createdAt: at, updatedAt: at };
  });
}
