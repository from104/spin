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

export const PREFS_KEY = 'spin.prefs';
export const UI_KEY = 'spin.ui';
export const CURRENT_PREFS_SCHEMA = 1;

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
  teams: Record<TeamSide, TeamStyle>;
  defaultFormation: FormationName;
  defaultCourtMode: CourtMode | null;
  present: { autoFullscreen: boolean; wakeLock: boolean };
  a11y: {
    largeTargets: boolean;
    uiScale: 1 | 1.15 | 1.3;
    reduceMotion: 'system' | 'always';
    singleKeyShortcuts: 'on' | 'modifier' | 'off';
  };
  // iosPwa: DESIGN.md §6.9 "iPhone Safari 최초 진입 시 1회 안내" 배너의 노출 여부(껐다 켬).
  // degradedStorage: DESIGN.md §4.8 열화 모드 상시 경고를 다시 보지 않기 설정. 두 필드 모두
  // 소비하는 배너 컴포넌트가 아직 없다(감사 2026-08-08 minor — src/features/present/*,
  // app-shell 쪽 작업으로 이 담당(settings/render/editor) 범위 밖이라 배선하지 않았다).
  // 마이그레이션 호환을 위해 필드·기본값·검증은 그대로 유지한다.
  hints: { iosPwa: boolean; degradedStorage: boolean };
  physics: PhysicsOverride;
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
  teams: structuredClone(DEFAULT_TEAMS),
  defaultFormation: '1-2-1',
  defaultCourtMode: null,
  present: { autoFullscreen: false, wakeLock: true },
  a11y: { largeTargets: false, uiScale: 1, reduceMotion: 'system', singleKeyShortcuts: 'on' },
  hints: { iosPwa: true, degradedStorage: true },
  physics: {},
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

  const teamsRaw = isRecord(raw.teams) ? raw.teams : {};
  const teams: Record<TeamSide, TeamStyle> = {
    home: sanitizeTeamStyle(teamsRaw.home, DEFAULT_TEAMS.home),
    away: sanitizeTeamStyle(teamsRaw.away, DEFAULT_TEAMS.away),
  };

  const presentRaw = isRecord(raw.present) ? raw.present : {};
  const a11yRaw = isRecord(raw.a11y) ? raw.a11y : {};
  const hintsRaw = isRecord(raw.hints) ? raw.hints : {};

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
    },
    hints: {
      iosPwa: bool(hintsRaw.iosPwa, d.hints.iosPwa),
      degradedStorage: bool(hintsRaw.degradedStorage, d.hints.degradedStorage),
    },
    physics: sanitizePhysicsOverride(raw.physics),
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
