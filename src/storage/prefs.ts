// §4.6 설정. localStorage 를 쓰는 이유: 테마는 첫 페인트 전에 동기로 읽어야 한다(IDB 는 비동기
// → FOUC). FOUC 방지 부트 스크립트(index.html, app-shell 소유)는 `spin.prefs.theme` 을 최상위
// 문자열 필드로, `'light'` 값을 영구 불변식으로 전제한다(§4.1 예외 1건) — 이 필드의 위치·타입을
// 바꾸는 마이그레이션은 index.html 부트 스크립트도 같은 커밋에서 함께 고쳐야 한다.
import { clamp } from '../core/geom.ts';
import { DEFAULT_ZONES, DEFAULT_LIMITS } from '../core/constants.ts';
import type { ZoneConfig } from '../model/chair.ts';
import type { TeamSide, TeamStyle } from '../model/drill.ts';
import type { CourtMode } from '../model/court.ts';
import { COURT_MODES } from '../model/court.ts';
import type { FormationName } from '../model/defaults.ts';
import { FORMATIONS, DEFAULT_TEAMS } from '../model/defaults.ts';
import type { Repair } from '../model/validate.ts';
import { migrateDoc, PREFS_MIGRATIONS } from '../model/migrate.ts';
import type { Locale } from '../i18n/locale.ts';
import { SUPPORTED_LOCALES, resolveLocale } from '../i18n/locale.ts';
import { browserLangs } from '../i18n/useLocale.ts';
import { translate } from '../i18n/useT.ts';

export const PREFS_KEY = 'spin.prefs';
// `UI_KEY = 'spin.ui'` 는 여기 없다(5.0 ④ 로 삭제, 2026-08-13). 호출자 0곳인 죽은 export 였고
// — rg 로 문자열 'spin.ui' 까지 확인, 남은 곳은 docs/DESIGN.md 의 옛 스냅숏뿐 — 남겨 두면
// 다음 사람이 "이 키는 왜 백업(backup 봉투)에 안 들어가지" 를 다시 조사하게 된다.
// 이 앱이 localStorage 에 쓰는 키는 PREFS_KEY 와 board.ts 의 BOARD_KEY 둘뿐이다.
/** 3.0 에서 1 → 2. 트레이 서랍·seed 도장·2존 모드를 **한 번에** 태운 상승이다(§7 E-6) —
 *  네 필드를 따로 올렸으면 여기까지 오는 동안 백업 파일의 스키마가 네 갈래로 갈라졌다.
 *  i18n C1 에서 2 → 3. 언어 설정(language) 한 필드만 추가한다. */
export const CURRENT_PREFS_SCHEMA = 3;

export interface PhysicsParams {
  zones: ZoneConfig;
  linearKmh: number;
  bumperKmh: number;
  editorSpeedMultiplier: number; // 1.0 기본. 드래그/놓은 뒤 이어가기에만 적용(§5.11)
  /** 개체 이동 속도 제한. 끄면 잡은 개체가 포인터를 즉시 따라온다 —
   *  실제 파워체어 속도(10 km/h)를 지키는 것과 판을 빨리 짜는 것은 다른 목적이라
   *  화면에서 바로 오갈 수 있어야 한다. */
  speedLimit: boolean;
}
/** 중첩을 타입에서 푼다. Partial<PhysicsParams> 는 zones 를 부분 저장할 수 없어 슬라이더 하나만
 *  만져도 나머지 기본값이 박제된다. */
export type PhysicsOverride = Partial<Omit<PhysicsParams, 'zones'>> & { zones?: Partial<ZoneConfig> };

export interface Preferences {
  schemaVersion: number;
  theme: 'dark' | 'light';
  playbackSpeed: 0.5 | 1 | 2;
  loop: boolean;
  showGrid: boolean;
  showGridLabels: boolean;
  showRuleZones: boolean;
  /** 편집기 인스펙터를 판 옆에 **붙박이**로 둘지(결정 ③A). 기본은 false = 판 위 오버레이 시트다.
   *  기기를 옮겨도 따라오는 취향이라 prefs 에 남기고, 좁은 컨테이너(<1100)에서는 이 값이
   *  true 여도 오버레이로 물러난다(features/editor/inspectorLayout.ts). */
  inspectorPinned: boolean;
  teams: Record<TeamSide, TeamStyle>;
  defaultFormation: FormationName;
  defaultCourtMode: CourtMode | null;
  present: { autoFullscreen: boolean; wakeLock: boolean };
  a11y: {
    largeTargets: boolean;
    uiScale: 1 | 1.15 | 1.3;
    reduceMotion: 'system' | 'always';
    singleKeyShortcuts: 'on' | 'modifier' | 'off';
    /** §4.3 P1-4 놓임·막힘·상자 빔의 소리와 진동(한 스위치다 — ui/cues.ts 머리말 ③).
     *  '모션 줄이기' 와 같은 층에 둔다: 둘 다 "판이 손에 어떻게 느껴지는가" 설정이다.
     *  기본 켬 — 이 기능의 존재 이유가 *시선을 화면에서 떼는 것*이라, 기본 끔이면 설정을
     *  파고든 사람에게만 존재하는 기능이 된다. 끄는 데는 한 번의 탭이 든다.
     *
     *  **`haptic` 은 따로 두지 않는다**(3.0 확정). 소리와 진동은 한 스위치다 — ui/cues.ts 머리말
     *  ③ 이 "둘을 같은 if 에 묶으면 태블릿 무음 모드에서 신호가 통째로 사라진다" 를 이유로
     *  *채널만* 독립시켰지 설정은 하나로 못박아 뒀다. 필드를 쪼개면 스피커 없는 기기에서
     *  '소리 끔 + 진동 켬' 이라는, 사용자가 구분할 수 없는 두 상태가 생긴다. */
    sound: boolean;
    /** 2존 모드(결정 ④ · 5.5). ON 이면 차체 전체가 이동이고 회전·견인은 차체 밖 가이드로만 한다 —
     *  `handlesVisible(pxPerUnit, pointerType, forced)` 의 `forced` 가 이 값을 받는다.
     *  **기본 OFF**: 자동 배율 게이트로 켜면 줌이 조작 규칙을 바꾸는 사고가 된다(§9-④).
     *  3.0 은 **값만** 심는다 — 소비처 배선은 5.5 다. 지금 넣어 두는 이유는 그때 스키마를
     *  한 번 더 올리지 않기 위해서다. */
    twoZone: boolean;
  };
  // iosPwa: DESIGN.md §6.9 "iPhone Safari 최초 진입 시 1회 안내" 배너의 노출 여부(껐다 켬).
  // 소비하는 배너 컴포넌트가 아직 없다(감사 2026-08-08 minor — src/features/present/*,
  // app-shell 쪽 작업으로 이 담당(settings/render/editor) 범위 밖이라 배선하지 않았다).
  // 마이그레이션 호환을 위해 필드·기본값·검증은 그대로 유지한다.
  // ⚠️ degradedStorage(DESIGN.md §4.8 열화 모드 상시 경고)는 2026-08-20 폐기했다(로드맵
  // §0.5 결정) — 그 배너 자체(ensurePersistence/storagePressure, storage/db.ts)를
  // 걷어냈으니 "다시 보지 않기" 플래그만 남겨 둘 이유가 없다.
  hints: { iosPwa: boolean };
  /** §3 트레이 서랍 2개(작도 · 설명)의 개폐 상태. 둘 다 기본 닫힘 — 손잡이는 처음부터 보이므로
   *  닫혀 있어도 잠긴 기능은 0개다. 단축키 R·P·T 를 누르면 그 서랍이 **영구히** 열리고(§3 불변식 2)
   *  그 '영구히' 를 기기 재시작 너머로 들고 가는 것이 이 필드다. 기기를 옮겨도 따라오는 취향이라
   *  드릴이 아니라 prefs 에 산다 — 판마다 서랍이 다르면 표적 좌표가 판마다 달라진다. */
  tray: { draw: boolean; note: boolean };
  /** seed 드릴 3개를 이미 심었는가(3.8). **"드릴이 0개인가" 로 대신할 수 없다** — 그러면 seed 를
   *  지운 사람에게 매번 되살아난다. 심은 사실만 기록하는 1회성 도장이다. */
  seeded: boolean;
  physics: PhysicsOverride;
  /** i18n C1. `'auto'` 는 브라우저 언어(navigator.languages)로 매 렌더 해석된다 — 값 자체는
   *  로케일이 아니라 "무엇을 볼지에 대한 취향"이라 기기를 옮겨도 따라오는 게 맞다(theme·
   *  defaultFormation 과 같은 결). 해석 로직은 i18n/locale.ts 가 단일 출처다. */
  language: 'auto' | Locale;
  /** 0.6 Drive 동기화. enabled 만 prefs 에 둔다 — 계정 이메일은 IDB meta(syncMeta.ts)에
   *  (백업 파일이 prefs 를 통째로 실으므로 이메일이 백업을 타면 안 된다), 토큰은 어디에도
   *  저장하지 않는다(auth.ts 머리말). 스키마 도장은 안 올린다(a11y.sound 전례 — 없으면
   *  기본값 꺼짐). enabled 가 백업을 타고 이동하는 것은 의도다: 새 기기에서 복원하면
   *  "다시 연결하세요" 안내가 자연스러운 온보딩이 된다(토큰이 없으니 저절로 그 상태다). */
  sync: { enabled: boolean };
  /** 화면별 튜토리얼(스포트라이트)을 이미 봤는가(§0.5 도움말·튜토리얼, 2026-08-20 계획서
   *  docs/PLAN-HELP-TUTORIAL.md). **본 화면만 키가 있다** — `seeded`(전역 1회성 도장)와
   *  같은 결이지만 화면이 여럿이라 sparse 객체다. 기기별이고 드라이브 동기화 제외다(sync
   *  머리말과 같은 이유는 아니다 — 이건 그냥 prefs 전체가 애초에 동기화 대상이 아니라서다).
   *  새 기기에서 다시 나오는 것은 사고가 아니라 의도다. */
  tutorialsSeen: Partial<Record<TutorialScreenKey, true>>;
}

/** 튜토리얼이 있는 화면 6개. docs/PLAN-HELP-TUTORIAL.md §D 의 표와 순서를 맞춘다. */
export const TUTORIAL_SCREEN_KEYS = ['library', 'sessions', 'editor', 'board', 'present', 'sessionEditor'] as const;
export type TutorialScreenKey = (typeof TUTORIAL_SCREEN_KEYS)[number];

/** 팀 이름 기본값. DEFAULT_TEAMS(model/defaults.ts) 는 seed 드릴 전용(번역 범위 밖 — 시드
 *  콘텐츠)이라 그대로 두고, prefs 의 첫 실행 기본값만 로케일에 맞춰 새로 고른다. **저장되는
 *  값**이라 여기서 한 번 고르면 그 뒤로는 고정 문자열이다 — i18n/locale.ts 의 label: Record<Locale,…>
 *  패턴(매 렌더 다시 읽는 값)과는 다른 결이다. */
function defaultTeams(locale: Locale): Record<TeamSide, TeamStyle> {
  return {
    home: { ...DEFAULT_TEAMS.home, label: translate(locale, 'team.defaultHomeLabel') },
    away: { ...DEFAULT_TEAMS.away, label: translate(locale, 'team.defaultAwayLabel') },
  };
}

/** 상수 대신 팩토리 — 공유 객체 유출 방지(호출자가 반환값을 변형해도 다음 호출엔 영향 없음). */
export const makeDefaultPrefs = (): Preferences => ({
  schemaVersion: CURRENT_PREFS_SCHEMA,
  theme: 'dark',
  playbackSpeed: 1,
  loop: false,
  showGrid: true,
  showGridLabels: true,
  showRuleZones: true,
  inspectorPinned: false,
  // language 는 항상 'auto' 로 시작하므로(아래) 이 시점의 로케일도 auto 감지가 맞다 —
  // 사용자가 고른 값이 아직 없다.
  teams: defaultTeams(resolveLocale('auto', browserLangs())),
  defaultFormation: '1-2-1',
  defaultCourtMode: null,
  present: { autoFullscreen: false, wakeLock: true },
  a11y: { largeTargets: false, uiScale: 1, reduceMotion: 'system', singleKeyShortcuts: 'on', sound: true, twoZone: false },
  hints: { iosPwa: true },
  tray: { draw: false, note: false },
  seeded: false,
  physics: {},
  language: 'auto',
  sync: { enabled: false },
  tutorialsSeen: {},
});

/** linearKmh 에 연동되는 회전 속도 상한. 기본점(linear=10 → 30)을 지나는 선형식이며
 *  [10,36](DEFAULT_LIMITS.bumperKmhRange) 로 클램프한다. 계약서는 사용처만 규정하고 식은
 *  명시하지 않아 이 기본점을 통과하는 가장 단순한 관계로 채웠다(§DEVIATIONS 참고). */
export function bumperKmhMax(linearKmh: number): number {
  const [lo, hi] = DEFAULT_LIMITS.bumperKmhRange;
  return clamp(linearKmh * 3, lo, hi);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function sanitizeTeamStyle(raw: unknown, fallback: TeamStyle): TeamStyle {
  if (!isRecord(raw)) return { ...fallback };
  return {
    label: typeof raw.label === 'string' ? raw.label : fallback.label,
    color: isHexColor(raw.color) ? raw.color : fallback.color,
    gkColor: isHexColor(raw.gkColor) ? raw.gkColor : fallback.gkColor,
  };
}

function sanitizePhysicsOverride(raw: unknown): PhysicsOverride {
  if (!isRecord(raw)) return {};
  const out: PhysicsOverride = {};
  if (isRecord(raw.zones)) {
    const z: Partial<ZoneConfig> = {};
    for (const k of ['sTowRearMax', 'sSpinMin', 'sTowFrontMin', 'grabPadPx'] as const) {
      const v = raw.zones[k];
      if (typeof v === 'number' && Number.isFinite(v)) z[k] = v;
    }
    if (Object.keys(z).length > 0) out.zones = z;
  }
  if (typeof raw.linearKmh === 'number' && Number.isFinite(raw.linearKmh)) out.linearKmh = raw.linearKmh;
  if (typeof raw.bumperKmh === 'number' && Number.isFinite(raw.bumperKmh)) out.bumperKmh = raw.bumperKmh;
  if (typeof raw.editorSpeedMultiplier === 'number' && Number.isFinite(raw.editorSpeedMultiplier)) {
    out.editorSpeedMultiplier = raw.editorSpeedMultiplier;
  }
  if (typeof raw.speedLimit === 'boolean') out.speedLimit = raw.speedLimit;
  return out;
}

export function validatePrefs(raw: unknown): { value: Preferences; repairs: Repair[] } {
  const repairs: Repair[] = [];
  const d = makeDefaultPrefs();
  if (!isRecord(raw)) return { value: d, repairs };

  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

  const theme: 'dark' | 'light' = raw.theme === 'light' ? 'light' : 'dark';
  // 1.5 를 통과시키면 STEP_INTERVAL_MS[1.5] = undefined → transitionMs = NaN → 재생이 조용히 멈춘다.
  const playbackSpeed: 0.5 | 1 | 2 = raw.playbackSpeed === 0.5 || raw.playbackSpeed === 2 ? raw.playbackSpeed : 1;
  const defaultCourtMode: CourtMode | null =
    typeof raw.defaultCourtMode === 'string' && (COURT_MODES as readonly string[]).includes(raw.defaultCourtMode)
      ? (raw.defaultCourtMode as CourtMode)
      : null;
  const defaultFormation: FormationName =
    typeof raw.defaultFormation === 'string' && (FORMATIONS as readonly string[]).includes(raw.defaultFormation)
      ? (raw.defaultFormation as FormationName)
      : '1-2-1';

  // teams 보정보다 먼저 정해야 한다 — 아래 sanitizeTeamStyle 폴백이 이 로케일을 쓴다.
  const language: Preferences['language'] =
    raw.language === 'auto' || (SUPPORTED_LOCALES as readonly string[]).includes(raw.language as string)
      ? (raw.language as Preferences['language'])
      : d.language;
  const fallbackTeams = defaultTeams(resolveLocale(language, browserLangs()));

  const teamsRaw = isRecord(raw.teams) ? raw.teams : {};
  const teams: Record<TeamSide, TeamStyle> = {
    home: sanitizeTeamStyle(teamsRaw.home, fallbackTeams.home),
    away: sanitizeTeamStyle(teamsRaw.away, fallbackTeams.away),
  };

  const presentRaw = isRecord(raw.present) ? raw.present : {};
  const a11yRaw = isRecord(raw.a11y) ? raw.a11y : {};
  const hintsRaw = isRecord(raw.hints) ? raw.hints : {};
  const trayRaw = isRecord(raw.tray) ? raw.tray : {};
  const syncRaw = isRecord(raw.sync) ? raw.sync : {};
  const tutorialsSeenRaw = isRecord(raw.tutorialsSeen) ? raw.tutorialsSeen : {};
  const tutorialsSeen: Partial<Record<TutorialScreenKey, true>> = {};
  for (const k of TUTORIAL_SCREEN_KEYS) {
    if (tutorialsSeenRaw[k] === true) tutorialsSeen[k] = true;
  }

  const uiScale: 1 | 1.15 | 1.3 = a11yRaw.uiScale === 1.15 || a11yRaw.uiScale === 1.3 ? a11yRaw.uiScale : 1;
  const reduceMotion: 'system' | 'always' = a11yRaw.reduceMotion === 'always' ? 'always' : 'system';
  const singleKeyShortcuts: 'on' | 'modifier' | 'off' =
    a11yRaw.singleKeyShortcuts === 'modifier' || a11yRaw.singleKeyShortcuts === 'off' ? a11yRaw.singleKeyShortcuts : 'on';

  const value: Preferences = {
    schemaVersion: CURRENT_PREFS_SCHEMA,
    theme,
    playbackSpeed,
    loop: bool(raw.loop, d.loop),
    showGrid: bool(raw.showGrid, d.showGrid),
    showGridLabels: bool(raw.showGridLabels, d.showGridLabels),
    showRuleZones: bool(raw.showRuleZones, d.showRuleZones),
    inspectorPinned: bool(raw.inspectorPinned, d.inspectorPinned),
    teams,
    defaultFormation,
    defaultCourtMode,
    present: {
      autoFullscreen: bool(presentRaw.autoFullscreen, d.present.autoFullscreen),
      wakeLock: bool(presentRaw.wakeLock, d.present.wakeLock),
    },
    a11y: {
      largeTargets: bool(a11yRaw.largeTargets, d.a11y.largeTargets),
      uiScale,
      reduceMotion,
      singleKeyShortcuts,
      // 스키마를 올리지 않는다 — 옛 저장본에는 이 키가 없고, 없으면 기본값(켬)을 받는다.
      // `sound: 'yes'` 같은 쓰레기도 bool() 이 기본값으로 접는다.
      sound: bool(a11yRaw.sound, d.a11y.sound),
      twoZone: bool(a11yRaw.twoZone, d.a11y.twoZone),
    },
    hints: {
      iosPwa: bool(hintsRaw.iosPwa, d.hints.iosPwa),
    },
    // 이 화이트리스트 조립부에 안 적힌 필드는 저장 왕복에서 **소리 없이 증발한다**.
    // 모델에 필드를 넣었으면 여기도 같은 커밋에서 넣고, 왕복 테스트로 못박아라.
    tray: { draw: bool(trayRaw.draw, d.tray.draw), note: bool(trayRaw.note, d.tray.note) },
    seeded: bool(raw.seeded, d.seeded),
    physics: sanitizePhysicsOverride(raw.physics),
    language,
    sync: { enabled: bool(syncRaw.enabled, d.sync.enabled) },
    tutorialsSeen,
  };
  return { value, repairs };
}

/** resolvePhysics 는 존 경계를 강제로 정렬·클램프한다 — 역전된 값이 저장돼 있으면 classifyZone 이
 *  항상 towRear 를 돌려줘 4존 조작이 통째로 죽는다. */
export function resolvePhysics(p: Preferences): PhysicsParams {
  const z = { ...DEFAULT_ZONES, ...(p.physics.zones ?? {}) };
  // 하한 0 · 상한 1 을 허용한다 — 기본값이 바로 그 두 끝이다(차체 안에서는 견인이 잡히지
  // 않고 앞뒤 가이드로만 견인한다, DEFAULT_ZONES 주석 참고). 예전 하한 0.04·상한 0.96 은
  // 기본값 자체를 잘라내 차체 양끝에 얇은 견인 띠를 되살려 놓았다.
  const sTowRearMax = clamp(z.sTowRearMax, 0, 0.18);
  // 상한 0.9 는 뒤따르는 sTowFrontMin ≥ sSpinMin + 0.1 이 1 을 넘지 않게 남겨 둔 여유다.
  // 예전 0.45 는 기본값이 1/3 이던 시절에는 안 걸렸지만, 반반(0.5)으로 옮기자 **기본값을
  // 그대로 0.45 로 잘라** 경계가 조용히 어긋났다. 클램프 상한이 기본값보다 낮으면
  // 아무도 손대지 않아도 설정이 기본값과 달라진다 — 아래 회귀 테스트로 못박았다.
  const sSpinMin = clamp(z.sSpinMin, sTowRearMax + 0.04, 0.9);
  const sTowFrontMin = clamp(z.sTowFrontMin, sSpinMin + 0.1, 1);
  const linearKmh = clamp(p.physics.linearKmh ?? DEFAULT_LIMITS.linearKmh, 4, 16);
  const bumperKmh = clamp(p.physics.bumperKmh ?? DEFAULT_LIMITS.bumperKmh, 10, bumperKmhMax(linearKmh));
  const editorSpeedMultiplier = clamp(p.physics.editorSpeedMultiplier ?? 1, 1, 4);
  const speedLimit = p.physics.speedLimit ?? true;
  return {
    zones: { sTowRearMax, sSpinMin, sTowFrontMin, grabPadPx: z.grabPadPx },
    speedLimit,
    linearKmh,
    bumperKmh,
    editorSpeedMultiplier,
  };
}

/** 기본값과 같은 항목을 걷어낸 압축형. 슬라이더를 기본값으로 되돌려도 prefs 가 부풀지 않는다. */
export function prunePhysics(v: PhysicsParams | PhysicsOverride): PhysicsOverride {
  const out: PhysicsOverride = {};
  if (v.zones) {
    const zones: Partial<ZoneConfig> = {};
    for (const k of ['sTowRearMax', 'sSpinMin', 'sTowFrontMin', 'grabPadPx'] as const) {
      const val = v.zones[k];
      if (val !== undefined && val !== DEFAULT_ZONES[k]) zones[k] = val;
    }
    if (Object.keys(zones).length > 0) out.zones = zones;
  }
  if (v.linearKmh !== undefined && v.linearKmh !== DEFAULT_LIMITS.linearKmh) out.linearKmh = v.linearKmh;
  if (v.bumperKmh !== undefined && v.bumperKmh !== DEFAULT_LIMITS.bumperKmh) out.bumperKmh = v.bumperKmh;
  if (v.editorSpeedMultiplier !== undefined && v.editorSpeedMultiplier !== 1) out.editorSpeedMultiplier = v.editorSpeedMultiplier;
  // 기본값이 true 이므로 false 일 때만 남긴다.
  if (v.speedLimit === false) out.speedLimit = false;
  return out;
}

/** 절대 throw 하지 않는다 — Safari 프라이빗 모드는 setItem 을 매번 QuotaExceededError 로 던지고,
 *  React 이벤트 핸들러(테마 토글) 안에서 던지면 에러 바운더리까지 올라가 화면이 날아간다.
 *  false 반환은 호출부(screen-settings)가 "설정이 이 탭에서만 유지됩니다" 토스트를 최초 1회만
 *  띄우는 신호로 쓴다(그 상태는 화면 쪽 책임이라 여기서 들고 있지 않는다). */
export function savePrefs(p: Preferences): boolean {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(): Preferences {
  let raw: unknown;
  try {
    const s = localStorage.getItem(PREFS_KEY);
    raw = s ? JSON.parse(s) : undefined;
  } catch {
    raw = undefined;
  }
  const mig = migrateDoc(raw, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
  // too-new 는 구조를 신뢰할 수 없어 완전히 기본값으로 되돌린다. no-path(형상 불일치)는
  // validatePrefs 의 필드별 방어에 맡긴다.
  const input = mig.ok ? mig.doc : mig.reason === 'too-new' ? undefined : raw;
  return validatePrefs(input).value;
}

export function patchPrefs(patch: Partial<Preferences>): { prefs: Preferences; persisted: boolean } {
  const merged: Preferences = { ...loadPrefs(), ...patch };
  return { prefs: merged, persisted: savePrefs(merged) };
}

export function resetPrefs(): void {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // 프라이빗 모드 등에서 removeItem 도 던질 수 있다 — savePrefs 와 동일하게 무시.
  }
}
