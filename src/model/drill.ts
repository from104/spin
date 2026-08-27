// §3.5 드릴 스키마 (cast·스텝·드릴 본체). 화살표 부분은 arrow.ts 로 분리.
import type { Vec2 } from '../core/units.ts';
import type { ChairId, BallId, ConeId, DrillId, StepId, NoteId } from '../core/ids.ts';
import type { CourtMode, CourtSize } from './court.ts';
import type { StoredChairPose } from './chair.ts';
import type { Arrow } from './arrow.ts';
import type { Shape } from './shape.ts';
import type { Locale } from '../i18n/locale.ts';

export type PoseMap<K extends string, P> = Partial<Record<K, P>>;
export type TeamSide = 'home' | 'away';

export interface ChairDef {
  id: ChairId;
  team: TeamSide;
  number: string; // 화면에 그대로 찍는 값. 'G'|'2'|'3'|'4' (1~3자)
  isGk: boolean;
  role?: string; // 'GK'|'DF'|'WG'|'PM' — 명단 패널 우측 라벨 (인스펙터 역할 셀렉트가 채움)
  name?: string; // '플레이메이커' — 인스펙터 이름 입력이 채움
  color?: string; // 지정 시 팀 색 무시 — 인스펙터 개별 색 스와치가 채움
}
/** §7 5.2 공마다 따로 켜는 거리 원(2026-08-13, 기현님 실기 피드백 ③).
 *
 *  **스텝마다 따로다**(2026-08-27 기현 지시: *"각 스텝마다 공의 원 상태 … 가 각각 저장되어야
 *  한다"*). 저장 자리는 `DrillStep.ballRings` 이고, 재탭은 **그 스텝만** 바꾼다.
 *
 *  ⚠️ 이 결정은 **뒤집힌 것**이다. 2026-08-13~08-26 에는 `BallDef.ring` 으로 cast 에 있었고,
 *  근거는 *"콘의 colorIndex·휠체어의 color/isGk 처럼 개체의 정체성에 붙는 값은 cast 에 있다"*
 *  와 *"스텝마다 두면 스텝 12개짜리 드릴에서 원 하나 켜는 데 탭이 12번 필요하다"* 였다.
 *  실제로 규칙 장면을 만들면서 그 전제가 깨졌다 — **링은 정체성이 아니라 국면이다.** 킥오프는
 *  공이 멈춰 있는 동안만 5 m 제한을 받고 킥 이후에는 받지 않는데, cast 소유로는 그 한 장면조차
 *  표현할 수 없었다(전 스텝이 한 값을 공유한다). 탭 비용은 실재하지만, 표현할 수 없는 것이
 *  있는 쪽이 더 큰 손해다.
 *
 *  ⚠️ 그래서 이것은 `locked`/`ignored`/`cut` 과 **같은 부류**다 — "그 스텝의 판이 어떤
 *  상태인가". 저장 방식도 그쪽 규약을 따른다: **예외만 싣고, 없으면 'none'**.
 *
 *  ⚠️ **'none' 은 키 없음으로만 표현한다**(그래서 저장형이 `StoredBallRing` 이다) —
 *  `{ring: undefined}` 는 structuredClone(IDB)이 보존하고 JSON 이 지운다(edits.ts `omitKey`
 *  머리말의 함정). 초기 배치가 '원 없음' 이라는 뜻이기도 하다: 새 공은 키를 아예 안 만든다. */
export type BallRing = 'none' | '3m' | '5m';
export const BALL_RINGS = ['none', '3m', '5m'] as const;
/** 문서에 실제로 적히는 값. 'none' 이 여기 없는 것이 규율이다(위 주석). */
export type StoredBallRing = Exclude<BallRing, 'none'>;

export interface BallDef {
  id: BallId;
}
/** 그 스텝에서 이 공이 갖는 원. 값을 채우는 자리는 **재탭 순환 하나뿐**이다
 *  (store/editor 의 BALL_RETAP → edits.ts 의 `cycleBallRing`). */
export const ballRingOf = (step: Pick<DrillStep, 'ballRings'>, id: BallId): BallRing => step.ballRings?.[id] ?? 'none';
/** ⚠️ 이 값은 **표시가 아니라 규칙 선택**이다(2026-08-17). '5m' 은 *"이 공은 세트피스"* 라는
 *  약속이라, 그 공은 2-on-1 대신 **5 m 제한**으로 판정된다 — `model/rules.ts` 의 `ruleForRing`. */
/** 재탭 순환: 없음 → 3 m → 5 m → 없음. 4번째 탭에서 선택도 함께 풀리는 것은 **여기가 아니라**
 *  uiReducer 가 한다(`ring === '5m'` 일 때) — 순수 함수는 선택을 모른다. */
export const nextBallRing = (r: BallRing): BallRing => (r === 'none' ? '3m' : r === '3m' ? '5m' : 'none');
export interface ConeDef {
  id: ConeId;
  colorIndex: 0 | 1;
}
export interface DrillCast {
  chairs: ChairDef[];
  balls: BallDef[];
  cones: ConeDef[];
}

export interface NoteLabel {
  id: NoteId;
  x: number;
  y: number;
  text: string;
  size?: number; // px, 기본 14 — 인스펙터 크기 셀렉트
  color?: string; // 기본 '#ffffff'
  align?: 'start' | 'middle' | 'end'; // 기본 'middle'
}

export interface DrillStep {
  id: StepId;
  // 폐기됨(2026-08-17, 과제⑦) — UI 는 이름 필드를 쓰지 않는다. 새 스텝은 항상 ''.
  // 옛 드릴이 계속 들어오므로 필드는 남긴다: validate.ts 의 정화기가 로드 시 note 로
  // 이관하고 비운다(자동 생성 이름 '스텝 N' 은 이관 없이 버림). 그래서 이 필드가 실제로
  // 채워진 채 관찰되는 것은 로드 전(파일 원본)뿐이고, 앱을 거친 Drill 은 항상 ''다.
  name: string; // ≤40자

  note: string; // ≤600자
  durationMs?: number; // 이 스텝만 재생 간격 override
  chairs: PoseMap<ChairId, StoredChairPose>;
  balls: PoseMap<BallId, Vec2>;
  /** 이 스텝에서 각 공이 갖는 거리 원(2026-08-27, v9). `balls` 옆에 **따로** 두는 이유는
   *  `balls` 의 값이 `Vec2` 라서다 — 거기에 필드를 얹으면 `sanitizeVec`(좌표 정화기)·
   *  `setPose` 가 전부 흔들린다. `locked`/`ignored` 처럼 **예외만 싣는 별도 자리**가 이
   *  파일의 기존 규약이고, 그 규약을 그대로 따른다. 없으면 전부 'none'. */
  ballRings?: PoseMap<BallId, StoredBallRing>;
  /** 이 스텝에서 그 공을 **차는(소유한) 팀** — 5 m 링일 때만 뜻이 있다(2026-08-27 기현 지시).
   *
   *  ⚠️ **없으면 진영에서 파생한다**: `Drill.defense` 의 **반대**가 소유 팀이다. 그것이 이
   *  필드가 생기기 전의 동작(수비 진영 팀이 5 m 물러난다)과 정확히 같은 값이라, 옛 문서에
   *  이 키가 없다는 사실이 곧 "그때 보이던 그림" 이다 — 그래서 마이그레이션도, 도장 상승도
   *  필요 없다(`locked`/`ignored`/`cut` 과 같은 논법).
   *
   *  ⚠️ **왜 진영과 갈라야 했나**: `defense` 의 뜻은 "골 지역을 지키는 팀" 인데, 5 m 를 물러날
   *  팀은 "공을 **안** 차는 팀" 이다. 둘은 재개 종류에 따라 갈린다 — 코너킥·킥인은 공격이
   *  차니 수비가 물러나 두 값이 우연히 같지만, **골킥·수비 프리킥은 수비가 차므로 정반대**다.
   *  한 필드로 묶여 있는 동안에는 골킥 장면에서 진영을 뒤집어야 했고, 그러면 골 지역 3인
   *  판정까지 함께 뒤집혀 못 쓸 판이 됐다. */
  ballOwner?: PoseMap<BallId, TeamSide>;
  cones: PoseMap<ConeId, Vec2>;
  arrows: Arrow[];
  notes: NoteLabel[];
  /** 작도 도형 — 코트 위, 칩·화살표 **아래** 층(2026-08-14). 스텝마다 따로다: 화살표·메모와
   *  같은 규율이고, 스텝이 곧 "그때의 판" 이므로 구역 표시도 스텝을 따라가야 한다. */
  shapes: Shape[];
  // ── 개체 상태 플래그 (2026-08-14 기현 지시, 스텝마다 따로) ────────────────────────────
  // *"오른쪽 클릭 또는 긴 터치 … 잠김, 무시, 삭제 메뉴"*.
  //
  // ⚠️ **개체마다 필드를 다는 대신 스텝이 id 목록을 쥔다.** 대상이 여섯 종류인데(휠체어·공·
  // 콘·화살표·메모·도형) 앞의 셋은 cast 에 정의가 있고 좌표만 스텝에 있으며, 뒤의 셋은 객체
  // 자체가 스텝 배열이다. 개체마다 `locked?: boolean` 을 달면 **두 가지 저장 방식**이 생기고,
  // 잠금을 읽는 코드가 매번 "이건 어느 쪽이지" 를 물어야 한다. 목록 하나면 전부 같은 질문이다.
  //
  // 없으면 빈 목록이다 — 옛 문서에 키가 없는 것이 곧 "아무것도 안 잠겼다" 이므로 참말이다.
  /** 이 스텝에서 **잠긴** 개체 id. 이동만 막힌다 — 자리는 지키고 물리 상호작용도 그대로다.
   *  화면에는 붉은 테두리로 표시한다(기현 지시). */
  locked?: string[];
  /** 이 스텝에서 **무시**되는 휠체어 id. 흐리게 그리고, 물리 월드에서 아예 빠지며(공이 통과),
   *  포인터도 안 받는다. **휠체어에만** 있다(기현 지시) — 공·콘을 유령으로 만들 이유가 없다. */
  ignored?: ChairId[];
  // ── 사슬(끊긴 경계, 2026-08-17 기현 지시) ───────────────────────────────────────────────
  // *"연결 = 지금처럼 보간 애니메이션, 끊김 = 그 경계만 즉시 컷(멈추지 않고 순간 점프,
  //  재생은 계속 흐른다)."* 저장은 **예외만** 싣는다.
  //
  // ⚠️ **교리: 끊긴 경계의 "다음 스텝"이 진다. 키가 없으면 연결.** 스텝 배열이 앞뒤 경계를
  // 공유하는데(스텝 i 와 i+1 사이 경계는 둘 다 "안다"), 값을 어느 한쪽에 실어야 자기모순이
  // 없다 — 양쪽에 각각 두면 "i 는 끊겼다 하는데 i+1 은 연결이다 한다" 가 저장 가능해지고,
  // sampleDrill 은 매 경계마다 둘을 병합하는 규칙이 따로 필요해진다. **다음 스텝**을 택한
  // 것은 sampleDrill 의 루프 변수 i(= "지금 향하는 스텝")가 이미 그 규약과 같은 방향이라
  // 읽는 자리에서 추가 매핑이 없기 때문이다(§3.6 sampleDrill).
  //
  // 없으면 빈 목록·잠금과 같은 값의 논법으로 **연결**이다 — 그래서 예외만 저장하는 `true` 다
  // (`cut: false` 는 애초에 저장하지 않는다, `locked`/`ignored` 가 빈 배열을 지우는 것과 같은
  // 절약). 옛 드릴엔 이 키가 아예 없으므로 자동으로 전부-연결 = **지금 시연 동작 그대로,
  // 마이그레이션 불필요**("없음 = 참" 이 증명되는 경우 — `BallDef.ring` 상승 판단과 같은 논법,
  // drill.ts 상단 v3→v4 주석 참조). 스키마 도장도 올리지 않는다: 옛 앱이 이 키를 몰라도
  // "전부 보간" 으로 여전히 읽히므로 courtSize 류의 "다른 그림" 위험이 없다.
  cut?: true;
}

/** 이 스텝에 **잃을 것이 있는가**(2026-08-28). 자유 전술판의 코트 전환 게이트가 묻는 진짜
 *  질문이다 — 그전에는 리듀서의 `past.length === 0`(= 되돌릴 편집이 없다)을 대용으로 썼고,
 *  그 대용이 [비우기]를 되돌릴 수 없게 만든 원인이었다(EditorWorkspace 의 게이트 주석).
 *
 *  글(`note`)도 센다. 코트를 바꾸면 판이 통째로 갈리므로 적어 둔 메모도 함께 사라진다 —
 *  "잃을 것이 없을 때만 전환한다" 는 규율에서 메모는 개체와 같은 자격이다.
 *  (`name` 은 2026-08-17 폐기 필드라 앱을 거친 드릴에서는 언제나 ''다 — 세지 않는다.) */
export function isStepEmpty(s: DrillStep): boolean {
  return (
    Object.keys(s.chairs).length === 0 &&
    Object.keys(s.balls).length === 0 &&
    Object.keys(s.cones).length === 0 &&
    s.arrows.length === 0 &&
    s.notes.length === 0 &&
    s.shapes.length === 0 &&
    s.note === ''
  );
}

export type DrillLevel = '초급' | '중급' | '고급';
export const DRILL_LEVELS = ['초급', '중급', '고급'] as const;
/** i18n C4 — **저장값(DrillLevel)은 한국어 리터럴 그대로 둔다**(스키마 마이그레이션 없이).
 *  이 딕셔너리는 순수 표시용이다: `drill.level` 은 여전히 '초급' 같은 원문으로 비교·저장되고,
 *  화면에 찍을 때만 `DRILL_LEVEL_LABELS[locale][drill.level]` 을 거친다. */
export const DRILL_LEVEL_LABELS: Record<Locale, Record<DrillLevel, string>> = {
  ko: { 초급: '초급', 중급: '중급', 고급: '고급' },
  en: { 초급: 'Beginner', 중급: 'Intermediate', 고급: 'Advanced' },
  ja: { 초급: '初級', 중급: '中級', 고급: '上級' },
};

// ── 분류 유형 (v8, 2026-08-18 기현님 확정 — 질문 20문 중 ⑤) ─────────────────────────────────
// 코칭 표준의 유형 축이다: 일반 축구 세션 설계(warm-up→technical→tactical→scrimmage)와
// USPSA Knowledge Center 의 분류(Technical Skills / Tactical Coaching)가 공유하는 어휘라,
// 세션의 구획(phase)과 드릴의 유형이 같은 말로 이어진다(기술 드릴 → 기술 구획).
// **닫힌 목록**이다 — v7 까지의 category 는 열린 string 이라 '공격'/'슛팅'/'슈팅 연습' 같은
// 표기 변형이 전부 다른 분류가 됐고, 필터가 그 변형 수만큼 갈라졌다.
export const DRILL_TYPES = ['technical', 'tactical', 'set-piece', 'game-scenario', 'conditioning'] as const;
export type DrillType = (typeof DRILL_TYPES)[number];
/** 화면·인쇄·검색키가 함께 쓰는 라벨. 값(영문 키)은 저장용, 라벨은 표시용 — 라벨을
 *  저장하면 라벨 문구를 다듬는 순간 옛 문서가 전부 "알 수 없는 유형" 이 된다.
 *  i18n C4 — 로케일 차원이 붙었다. 호출부는 `DRILL_TYPE_LABELS[locale][key]` 로 쓴다.
 *  검색키(model/summary.ts buildSearchKey)만 예외 — 로케일 하나로 좁히지 않고 **세 언어를
 *  전부** 넣는다(검색이 UI 언어에 매이지 않게). */
export const DRILL_TYPE_LABELS: Record<Locale, Record<DrillType, string>> = {
  ko: { technical: '기술', tactical: '전술', 'set-piece': '세트피스', 'game-scenario': '경기 상황', conditioning: '컨디셔닝' },
  en: { technical: 'Technical', tactical: 'Tactical', 'set-piece': 'Set Piece', 'game-scenario': 'Game Scenario', conditioning: 'Conditioning' },
  ja: { technical: '技術', tactical: '戦術', 'set-piece': 'セットプレー', 'game-scenario': 'ゲームシナリオ', conditioning: 'コンディショニング' },
};

// ── 경기 상황 (v8, 질문 20문 중 ⑥ — 선택 필드) ──────────────────────────────────────────────
// FIPFA Laws 2025 의 재개(restart) 8종 + 오픈 플레이 + 파워체어 고유의 2대1 스페이싱.
// 룰북의 어휘를 그대로 쓴다 — 코치가 룰북과 앱 사이에서 번역할 일이 없도록.
// 유형(drillType)과 직교하는 축이다: 세트피스 유형이 아니어도 "킥인에서 시작하는 전술 드릴"
// 처럼 상황이 붙을 수 있다. 없음 = 미지정(키 생략)이라 마이그레이션이 적을 참말이 없다.
export const DRILL_SITUATIONS = [
  'kick-off',
  'kick-in',
  'goal-kick',
  'corner',
  'direct-fk',
  'indirect-fk',
  'penalty',
  'set-ball',
  'open-play',
  '2-on-1-spacing',
] as const;
export type DrillSituation = (typeof DRILL_SITUATIONS)[number];
/** i18n C4 — 로케일 차원이 붙었다(위 DRILL_TYPE_LABELS 와 같은 규약). */
export const SITUATION_LABELS: Record<Locale, Record<DrillSituation, string>> = {
  ko: {
    'kick-off': '킥오프',
    'kick-in': '킥인',
    'goal-kick': '골킥',
    corner: '코너킥',
    'direct-fk': '직접 프리킥',
    'indirect-fk': '간접 프리킥',
    penalty: '페널티킥',
    'set-ball': '세트볼',
    'open-play': '오픈 플레이',
    '2-on-1-spacing': '2대1 스페이싱',
  },
  en: {
    'kick-off': 'Kick-off',
    'kick-in': 'Kick-in',
    'goal-kick': 'Goal Kick',
    corner: 'Corner',
    'direct-fk': 'Direct Free Kick',
    'indirect-fk': 'Indirect Free Kick',
    penalty: 'Penalty',
    'set-ball': 'Set Ball',
    'open-play': 'Open Play',
    '2-on-1-spacing': '2-on-1 Spacing',
  },
  ja: {
    'kick-off': 'キックオフ',
    'kick-in': 'キックイン',
    'goal-kick': 'ゴールキック',
    corner: 'コーナーキック',
    'direct-fk': '直接フリーキック',
    'indirect-fk': '間接フリーキック',
    penalty: 'ペナルティキック',
    'set-ball': 'セットボール',
    'open-play': 'オープンプレー',
    '2-on-1-spacing': '2対1スペーシング',
  },
};
export interface TeamStyle {
  label: string;
  color: string;
  gkColor: string;
}
/** v2 = §7 3.2/3.3 교육 필드 + 훈련량. **3.2 와 3.3 을 한 상승에 태웠다** — 나눠 올리면
 *  migrate 를 두 번 돌고 "교육 필드는 아는데 훈련량은 모르는" 중간 버전 파일이 세상에 남는다.
 *
 *  v3 = §7 5.1 코트 크기 3단(`courtSize`). **여기서 도장을 올리는 이유는 "필드가 하나 늘어서"
 *  가 아니다** — 좌표의 뜻이 바뀌기 때문이다. courtSize:'25x14' 드릴의 좌표는 700×425 판 위의
 *  값인데, 이 필드를 모르는 옛 앱은 그것을 825×525 판에 그린다. 파일은 멀쩡히 열리고 아무 경고도
 *  없이 **틀린 전술 그림**이 나온다. 도장을 올려 두면 옛 앱이 too-new 로 정직하게 거절한다.
 *  (봉투 버전 ENVELOPE_VERSION 은 1 그대로다 — 그릇이 아니라 내용의 버전이다.)
 *
 *  ⚠️⚠️ **아래 "v4 로 올리지 않았다" 문단은 2026-08-27 에 수명을 다했다.** 링이 cast 에서
 *  스텝으로 옮겨가며(v9) 도장이 올라갔기 때문이다. 문단을 지우지 않는 이유는 그때의 판단이
 *  **그때는 옳았기** 때문이다 — 조건 ①②③은 "링이 공의 정체성" 이라는 전제 위에서 셋 다 참이었고,
 *  무너진 것은 그 전제다(위 `BallRing` 머리말: 링은 정체성이 아니라 국면이다). v9 는 조건 ①이
 *  깨져서 올린 것이다: 이제 마이그레이션이 **할 일이 있다**(cast 의 값을 전 스텝에 옮겨 적어야
 *  지금 보이는 그림이 보존된다). ②③은 여전히 참이지만 ①만으로 충분하다.
 *
 *  ⚠️ **5.2 `BallDef.ring` 은 v4 로 올리지 않았다**(2026-08-13). 위 courtSize 문단과 반대
 *  판단이라 근거를 남긴다 — 셋 다 성립해야 안 올린다:
 *   ① **없으면 'none'** 이 전역(全域)이다. v3 문서에는 이 키가 없고, 없는 것이 곧 초기값이라
 *      마이그레이션이 할 일이 0 이다. courtSize 는 반대였다(없는 값의 뜻이 '미지정' 이 아니라
 *      '30×18' 이라 **문서마다 도장을 찍어 둬야** 기본값이 옮겨져도 안전했다).
 *   ② **옛 앱이 이 필드를 몰라도 좌표의 뜻이 안 바뀐다.** 옛 앱이 그리는 3 m 링은 문서 내용이
 *      아니라 **읽는 사람 기기의 설정**(`prefs.showRuleZones`, 기기별 값)에서 나온다 — 격자를
 *      켜 놓고 보는 것과 같은 축이다. courtSize 는 **저장된 좌표의 해석**을 바꿔서 "파일은
 *      멀쩡히 열리고 틀린 전술 그림이 나온다" 였다.
 *   ③ 올리면 대가가 즉시 실재한다: 배포된 v0.1.0 빌드가 새 파일을 **전부 too-new 로 거절**한다
 *      (드릴 파일도, 기기 이사 파일도). 표시 상태 하나 때문에 기기 사이 이사를 끊을 값이 아니다.
 *   덧붙여, v3→v4 마이그레이션은 **적을 참말이 없다**: 'none' 을 찍으면 옛 드릴이 지금까지
 *   보이던 모습(스위치를 켜면 모든 공에 3 m 링)과 어긋나고, '3m' 을 찍으면 기현님이 요청한
 *   "초기 배치는 원 없음" 과 어긋난다. 적을 것이 없는 상승은 도장만 올리는 상승이다. */
/** v4 = 작도 도형(타원·정삼각형·직사각형, `DrillStep.shapes`) — 2026-08-14 기현 지시.
 *
 *  ⚠️ **위 `BallDef.ring` 문단과 반대 판단이라 근거를 남긴다.** 그쪽은 세 조건이 다 성립해
 *  안 올렸는데, 도형은 **②를 못 넘는다**:
 *   ① 없으면 도형 0개 — 전역이다. 마이그레이션이 적을 참말은 없다. (ring 과 같다)
 *   ② ✗ **도형은 문서 내용이다.** ring 을 안 올린 핵심 논지는 *"옛 앱이 그리는 3 m 링은 문서
 *      내용이 아니라 읽는 사람 기기의 설정에서 나온다"* 였다. 도형은 코치가 판에 **그린 것**
 *      이라, 옛 앱은 그것을 조용히 빠뜨리고 나머지를 그린다 — courtSize 가 문제 삼은
 *      *"파일은 멀쩡히 열리고 아무 경고도 없이 틀린 전술 그림이 나온다"* 와 같은 형태다.
 *      수비 구역 셋을 그려 보낸 드릴이 상대 기기에서 빈 판으로 열리면 그것은 다른 드릴이다.
 *   ③ 대가는 그대로다 — 배포된 옛 빌드가 새 파일을 too-new 로 거절한다. 그러나 그것이
 *      courtSize 에서 이미 감수한 대가이고, ②가 성립하는 한 **거절이 정답**이다.
 *  즉 이 상승은 "도장만 올리는 상승" 이 맞지만, 도장 자체가 목적이다: 옛 앱이 **정직하게
 *  거절**하게 만드는 것. */
/** v5 = 자유 삼각형(`Shape.pts` — 꼭짓점 셋) — 2026-08-15 기현 지시.
 *
 *  *"앵커는 4개 : 회전용 1개, 중심에서 꼭지점 사이의 거리 3개. 어떤 모양의 삼각형이든."*
 *  삼각형의 모양이 `w,h`(정삼각형 한 변)에서 꼭짓점 셋으로 옮겨 갔다.
 *
 *  ⚠️ **여기는 위 둘과 달리 ②가 가장 세게 걸린다.** v4 를 아는 옛 앱은 새 파일을 열 수는
 *  있지만 `pts` 를 모르므로 **자유롭게 그린 삼각형을 정삼각형으로 다시 그린다** — 파일은
 *  멀쩡히 열리고 아무 경고도 없이 **다른 모양**이 나온다. courtSize 가 문제 삼은 바로 그
 *  형태이고, 도형과 달리 여기서는 빠지는 것이 아니라 **바뀌는** 것이라 더 조용하다.
 *  그래서 이 상승은 도장뿐 아니라 **적을 참말도 있다**(migrate.ts v4→v5). */
/** v6 = 진영(`Drill.defense`) — 2026-08-15 기현 지시.
 *
 *  *"수비측이 우리편 골에리어에 3명이 못 들어가는 거지. 공격은 제한 없어."*
 *
 *  ⚠️ **②를 넘는다**(도장을 올린다). v5 를 아는 옛 앱은 `defense` 를 모르므로 골 지역 3인을
 *  **팀 무관**으로 칠한다 — 공격 3대가 골 지역에 들어간 마무리 드릴이 그 앱에서는 붉게 나오고,
 *  파일은 멀쩡히 열리며 아무 경고도 없다. *"틀린 전술 그림"* 이 아니라 **틀린 규칙 해석**이라
 *  더 나쁘다: 코치가 없는 반칙을 배운다. */
/** v7 = 선 통일(`Arrow.kind` 삭제 · `headFrom`/`headTo` 신설) — 2026-08-16 기현 지시.
 *
 *  *"작도에 패스, 이동이 무의미하다. 선으로 통일하고 양 끝 앵커를 반복 클릭하면
 *   [화살표 없음, 폭이 좁은 화살표, 폭이 넓은 화살표] 순차로 변하게."*
 *
 *  ⚠️ **②를 넘는다.** v6 앱은 화살촉 둘을 모르므로 넓은 화살촉도, 화살촉 없는 선도 전부
 *  옛 좁은 화살촉으로 그린다 — 파일은 멀쩡히 열리고 아무 경고도 없이 **다른 그림**이 나온다.
 *  자유 삼각형(v5)이 넘은 그 문턱과 같은 형태다. */
/** v8 = 분류 개편(2026-08-18, 구조 개편 질문 20문) — `category`(열린 string) → `drillType`
 *  (닫힌 유형) 교체 · `situation`/`variation` 신설 · 훈련량(`reps`/`sets`/`intervalSec`) 폐기.
 *
 *  ⚠️ **②를 넘는다**(도장을 올린다). v7 앱은 `drillType` 을 모르고 `category` 를 찾는데
 *  새 파일에는 그 키가 없다 — validate 가 '기타' 로 접어 파일은 멀쩡히 열리고 아무 경고도
 *  없이 **분류가 통째로 사라진** 드릴이 나온다. courtSize 가 문제 삼은 "조용히 다른 문서"
 *  의 형태라 거절이 정답이다. 폐기 셋은 마이그레이션이 description 말미에 텍스트로 보존한다
 *  (migrate.ts v7→v8 — 사용자가 적은 값은 형식이 죽어도 글로 남긴다). */
/** v9 = 공의 거리 원이 cast(`BallDef.ring`)에서 스텝(`DrillStep.ballRings`)으로 — 2026-08-27
 *  기현 지시. 근거는 위 `BallRing` 머리말(링은 정체성이 아니라 국면이다).
 *
 *  ⚠️ **②를 넘는다**(도장을 올린다). 2026-08-13 이 "안 올린다" 고 판단할 때 든 조건 ①이
 *  *"없으면 'none' 이 전역이라 마이그레이션이 할 일이 0"* 이었는데, 이번에는 **할 일이 있다** —
 *  cast 에 있던 값을 전 스텝에 옮겨 적어야 지금 보이는 그림이 그대로 보존된다. 옮겨 적지 않으면
 *  링을 켜 둔 옛 드릴이 전부 '원 없음' 으로 열린다(= 5 m 세트피스 판정이 조용히 꺼진다 —
 *  `ruleForRing`. 표시가 아니라 **규칙 선택**이라 조용한 손실이다).
 *
 *  옛 앱 쪽도 거절이 정답이다: v8 앱은 `steps[].ballRings` 를 몰라 전부 무시하고 `cast.balls[].ring`
 *  을 찾는데 새 파일에는 그 키가 없다 — 파일은 멀쩡히 열리고 **링이 통째로 사라진** 드릴이 나온다. */
export const CURRENT_DRILL_SCHEMA = 9;

export interface Drill {
  schemaVersion: number;
  id: DrillId;
  title: string; // ≤80자
  /** 분류 유형(v8). courtMode 부류다 — 없음이 "미지정" 이 아니라 값이 늘 있어야 하는 축이라
   *  optional 이 아니다. 채우는 자리: `createDrill` · `DRILL_MIGRATIONS` v7→v8 · 메타 편집 UI. */
  drillType: DrillType;
  /** 경기 상황(v8, 선택). 없음 = 미지정 — 키를 만들지 않는다(`BallDef.ring` 과 같은 교리). */
  situation?: DrillSituation;
  level: DrillLevel;
  durationMin: number; // 훈련 계획용 소요시간(분). 재생 속도와 무관
  tags: string[]; // ≤12개, 각 ≤24자
  /** 진행 방법(USPSA 서술 3필드의 Setup, v8 에서 라벨만 재정의 — 필드는 그대로다). */
  description?: string;
  /** 변형(v8 신설 — USPSA 서술 3필드의 Variation). 더 쉽게/어렵게 조절하는 방법. ≤400자. */
  variation?: string;
  // ── §3.2 교육 필드 (2026-08-12 결정 ⑦ = (B) 중간) ──────────────────────────────────────
  // 4차 PDF 세션 계획서가 읽어 갈 값들이다. **성공 기준·변형(progression/regression)·드릴간
  // 참조는 넣지 않는다** — (C) 최대의 몫이고 참조는 §8 이 이미 잘라냈다(삭제 시 참조 무결성).
  //
  // 전부 optional 이다. 필수로 만들면 저장소 곳곳의 `Drill` 리터럴(테스트 픽스처 포함)이 한꺼번에
  // 컴파일 오류가 나는데, 그 파일들은 지금 다른 작업이 만지는 중이다. 대신 **값을 채우는 자리는
  // 세 곳뿐**이다: `createDrill`(새 드릴) · `DRILL_MIGRATIONS` v1→v2(옛 파일) · 인스펙터(사람).
  // 그래서 실제로 돌아다니는 드릴에는 언제나 키가 있고, optional 은 타입 편의일 뿐이다.
  objective?: string; // 목적 — 이 드릴로 무엇을 얻는가 (≤200자). USPSA 3필드의 Purpose
  coachingPoints?: string[]; // 코칭 포인트 — PDF 가 불릿으로 찍는다 (≤6개, 각 ≤80자)
  playersNeeded?: number; // 필요 인원(명). **0 = 미지정** (1~30)
  equipment?: string; // 필요 장비 — '공 2 · 콘 6 · 조끼 8' (≤120자)
  // §3.3 훈련량(reps/sets/intervalSec)은 **v8 에서 폐기됐다**(2026-08-18 기현님 확정, 질문 ⑦).
  // 편집 UI 가 한 번도 붙지 않은 채 인쇄만 읽던 필드였다 — 값이 있던 옛 문서는 마이그레이션이
  // description 말미에 "훈련량(구버전): …" 텍스트로 보존한다(migrate.ts v7→v8).
  courtMode: CourtMode; // 드릴 레벨 불변
  // ── §5.1 코트 크기 3단 (2026-08-13, §9 결정 ②) ────────────────────────────────────────────
  //
  // **왜 `courtMode` 에 접지 않고 별도 필드인가** (두 길 중 ②를 택한 근거):
  //  ① `'full30' | 'full28' | 'full25' | 'half' | 'flat'` 로 접으면 `CourtMode` 를 읽는 자리가
  //     전부 대상이 된다 — `COURT_MODES` 화이트리스트 · `Record<CourtMode, CourtDef>` ·
  //     `cloneToCourt` 의 isHalfFlat · 화면의 코트 선택 UI · `m === 'full'` 비교 9곳. 그중
  //     한 곳만 놓쳐도 "28×15 는 풀 코트가 아니다" 라고 판단하는 분기가 생긴다.
  //  ② 크기는 **모드와 직교하는 축**이다. 하프로 갔다 풀로 돌아왔을 때 고른 크기가 남아 있어야
  //     하는데, 접어 넣으면 그 정보가 전환 순간 사라진다.
  //  대가는 스키마 도장 상승(v2→v3)과 화이트리스트·마이그레이션·backup 봉투 세 관문인데,
  //  그 셋은 이 저장소에 이미 규약과 테스트가 있다(3차의 확립된 수법).
  //
  // ⚠️ optional 인 것은 타입 편의다 — **없으면 '30x18'** 이고, 값을 채우는 자리는 셋뿐이다:
  // `createDrill`(새 드릴) · `DRILL_MIGRATIONS` v2→v3(옛 파일) · 설정/편집 UI(사람).
  // 필수로 만들면 저장소 곳곳의 `Drill` 리터럴이 한꺼번에 컴파일 오류가 난다(§3.2 필드와 같은 판단).
  courtSize?: CourtSize;
  // ── 진영 (2026-08-15 기현 지시) ───────────────────────────────────────────────────────
  //
  // *"수비측이 우리편 골에리어에 3명이 못 들어가는 거지. 공격은 제한 없어."*
  //
  // **이 한 필드가 `model/rules.ts` 머리말이 못 하겠다고 적어 둔 그것이다.** 그 파일은 2026-08-13
  // 에 *"모델에 어느 팀이 어느 골대를 지키는가가 없다"* 며 골 지역 3인을 **팀 무관**으로, 2-on-1
  // 의 골키퍼 면제를 **아무 골 지역**으로 넓게 재고 있었고, 고칠 조건을 *"`Drill` 에 '이 팀이
  // 지키는 골대' 가 저장될 때"* 라고 명시해 뒀다. 그 조건이 여기서 충족된다.
  //
  // **뜻**: `courtDefFor(...).ruleZones[0]` 을 **지키는** 팀.
  //   · 풀 코트 — `ruleZones[0]` 은 **왼쪽** 골 지역이다. 오른쪽은 반대 팀이 지킨다.
  //   · 하프 코트 — 존이 하나뿐이다(아래쪽 골). 이 값이 곧 그 골의 수비 팀이고, 반대 팀은
  //     지킬 골이 없다(= 언제나 공격이라 골 지역 인원 제한을 안 받는다).
  //   · 플랫 코트 — `ruleZones` 가 비어 있어 **이 값이 쓰이지 않는다**(UI 도 비활성이다).
  //
  // ⚠️ 왜 좌/우가 아니라 **존 인덱스 기준**인가: 하프 코트의 골대는 좌우가 아니라 **아래쪽**이다
  // (`HALF_GOAL_POSTS` 의 y=412.5). `'left'|'right'` 로 두면 하프에서 뜻이 없는 값이 되고, 모드
  // 전환 때마다 좌표계를 다시 해석해야 한다. 존 인덱스는 세 모드에서 같은 규칙으로 읽힌다.
  //
  // ⚠️ optional 인 것은 타입 편의다 — 없으면 `defaultDefense(courtMode)` 다(풀=home, 하프=away.
  // 그 기본값의 근거는 `FULL_POSITIONS`/`HALF_POSITIONS` 의 GK 자리다). 채우는 자리는 셋:
  // `createDrill` · `DRILL_MIGRATIONS` v5→v6 · 진영 바꾸기 버튼.
  defense?: TeamSide;
  formation: string; // 생성 시 쓴 포메이션. 표시용
  teams: Record<TeamSide, TeamStyle>; // 생성 시 prefs 에서 structuredClone 으로 복사
  cast: DrillCast;
  steps: DrillStep[]; // 최소 1, 최대 60
  createdAt: number;
  updatedAt: number;
}
