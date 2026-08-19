// §10.6 prefs. localStorage 는 jsdom 환경에서 기본 제공된다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_LIMITS, DEFAULT_ZONES } from '../core/constants.ts';
import { migrateDoc, PREFS_MIGRATIONS } from '../model/migrate.ts';
import {
  PREFS_KEY,
  CURRENT_PREFS_SCHEMA,
  makeDefaultPrefs,
  loadPrefs,
  savePrefs,
  patchPrefs,
  validatePrefs,
  resolvePhysics,
  prunePhysics,
  resetPrefs,
  bumperKmhMax,
} from './prefs.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('makeDefaultPrefs', () => {
  it('호출마다 독립된 객체를 만든다(공유 유출 방지)', () => {
    const a = makeDefaultPrefs();
    const b = makeDefaultPrefs();
    a.teams.home.color = '#000000';
    expect(b.teams.home.color).not.toBe('#000000');
  });
  it("language 기본값은 'auto' 다(i18n C1)", () => {
    expect(makeDefaultPrefs().language).toBe('auto');
  });
});

describe('validatePrefs', () => {
  it('playbackSpeed 1.5 는 1 로 떨어진다', () => {
    const { value } = validatePrefs({ playbackSpeed: 1.5 });
    expect(value.playbackSpeed).toBe(1);
  });
  it('playbackSpeed 0.5/2 는 그대로 통과한다', () => {
    expect(validatePrefs({ playbackSpeed: 0.5 }).value.playbackSpeed).toBe(0.5);
    expect(validatePrefs({ playbackSpeed: 2 }).value.playbackSpeed).toBe(2);
  });
  it("theme:'purple' 은 'dark' 로 떨어진다", () => {
    const { value } = validatePrefs({ theme: 'purple' });
    expect(value.theme).toBe('dark');
  });
  it("theme:'light' 는 유지된다", () => {
    expect(validatePrefs({ theme: 'light' }).value.theme).toBe('light');
  });
  it('boolean 필드는 잘못된 타입이면 기본값으로 떨어진다', () => {
    const { value } = validatePrefs({ loop: 'yes', showGrid: 1 });
    expect(value.loop).toBe(makeDefaultPrefs().loop);
    expect(value.showGrid).toBe(makeDefaultPrefs().showGrid);
  });
  it('알 수 없는 defaultCourtMode/defaultFormation 은 안전한 기본값으로 떨어진다', () => {
    const { value } = validatePrefs({ defaultCourtMode: 'bogus', defaultFormation: 'bogus' });
    expect(value.defaultCourtMode).toBeNull();
    expect(value.defaultFormation).toBe('1-2-1');
  });
  it('teams 의 색이 hex 형식이 아니면 DEFAULT_TEAMS 값으로 떨어진다', () => {
    const { value } = validatePrefs({ teams: { home: { color: 'not-a-color' }, away: {} } });
    expect(value.teams.home.color).toBe(makeDefaultPrefs().teams.home.color);
  });
  it('teams 의 유효한 hex 색은 통과한다', () => {
    const { value } = validatePrefs({ teams: { home: { color: '#123abc', label: '홈', gkColor: '#ffffff' }, away: {} } });
    expect(value.teams.home.color).toBe('#123abc');
  });
  it('객체가 아니면 완전한 기본값을 돌려준다', () => {
    expect(validatePrefs(null).value).toEqual(makeDefaultPrefs());
    expect(validatePrefs('garbage').value).toEqual(makeDefaultPrefs());
    expect(validatePrefs([1, 2, 3]).value).toEqual(makeDefaultPrefs());
  });
  it("language:'ko'/'en'/'ja'/'auto' 는 그대로 통과한다(i18n C1)", () => {
    expect(validatePrefs({ language: 'ko' }).value.language).toBe('ko');
    expect(validatePrefs({ language: 'en' }).value.language).toBe('en');
    expect(validatePrefs({ language: 'ja' }).value.language).toBe('ja');
    expect(validatePrefs({ language: 'auto' }).value.language).toBe('auto');
  });
  it("language 에 지원하지 않는 값이 있으면 'auto' 로 떨어진다", () => {
    expect(validatePrefs({ language: 'fr' }).value.language).toBe('auto');
    expect(validatePrefs({ language: 123 }).value.language).toBe('auto');
  });
  it('teams 가 통째로 없으면(첫 실행) 기본 팀 이름이 language 로케일을 따라간다(C8b)', () => {
    expect(validatePrefs({ language: 'en' }).value.teams.home.label).toBe('Our Team');
    expect(validatePrefs({ language: 'en' }).value.teams.away.label).toBe('Opponent');
    expect(validatePrefs({ language: 'ja' }).value.teams.home.label).toBe('自チーム');
    expect(validatePrefs({ language: 'ko' }).value.teams.home.label).toBe('우리 팀');
  });
  it('teams.home 만 손상됐으면(라벨 없음) 그 자리만 language 로케일 기본값으로, 멀쩡한 away 는 그대로 둔다(C8b)', () => {
    const { value } = validatePrefs({ language: 'en', teams: { home: { color: 'nope' }, away: { label: '우리가 정한 이름' } } });
    expect(value.teams.home.label).toBe('Our Team');
    expect(value.teams.away.label).toBe('우리가 정한 이름');
  });
  it('sync.enabled — 기본 꺼짐, 참값은 왕복 보존, 쓰레기는 기본값으로 접는다(0.6, 스키마 도장 불변)', () => {
    expect(validatePrefs({}).value.sync.enabled).toBe(false); // 구버전 저장본(sync 키 없음)
    expect(validatePrefs({ sync: { enabled: true } }).value.sync.enabled).toBe(true);
    expect(validatePrefs({ sync: { enabled: 'yes' } }).value.sync.enabled).toBe(false);
    expect(validatePrefs({ sync: 'on' }).value.sync.enabled).toBe(false);
    // a11y.sound 전례 — 필드 추가로 스키마를 올리지 않는다(구앱 too-new 리셋 비용 회피)
    expect(validatePrefs({ sync: { enabled: true } }).value.schemaVersion).toBe(makeDefaultPrefs().schemaVersion);
  });
});

describe('resolvePhysics', () => {
  it('역전된 zones 는 정렬·클램프된다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { zones: { sTowRearMax: 0.5, sSpinMin: 0.1, sTowFrontMin: 0.05, grabPadPx: 10 } };
    const p = resolvePhysics(prefs);
    expect(p.zones.sTowRearMax).toBeLessThanOrEqual(0.18);
    expect(p.zones.sSpinMin).toBeGreaterThan(p.zones.sTowRearMax);
    expect(p.zones.sTowFrontMin).toBeGreaterThan(p.zones.sSpinMin);
  });
  it('linearKmh: 0 은 하한 4 로 클램프된다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { linearKmh: 0 };
    expect(resolvePhysics(prefs).linearKmh).toBe(4);
  });
  it('bumperKmh 는 linearKmh 에 연동된 상한을 넘지 않는다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { linearKmh: 4, bumperKmh: 999 };
    const p = resolvePhysics(prefs);
    expect(p.bumperKmh).toBeLessThanOrEqual(bumperKmhMax(4));
    expect(p.bumperKmh).toBeLessThanOrEqual(36);
  });
  it('한 항목만 override 해도 zones 의 나머지는 DEFAULT_ZONES 를 따라간다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { zones: { sTowRearMax: 0.15 } };
    const p = resolvePhysics(prefs);
    expect(p.zones.sTowRearMax).toBe(0.15);
    // 리터럴로 두면 기본값을 바꿀 때마다 "따라간다" 는 뜻과 무관하게 빨간불이 뜬다.
    expect(p.zones.sSpinMin).toBe(DEFAULT_ZONES.sSpinMin);
    expect(p.zones.sTowFrontMin).toBe(DEFAULT_ZONES.sTowFrontMin);
    expect(p.zones.grabPadPx).toBe(10);
  });

  it('아무것도 override 하지 않으면 DEFAULT_ZONES 가 클램프에 잘리지 않고 그대로 나온다', () => {
    // 회귀: sSpinMin 클램프 상한이 0.45 로 남아 있어, 기본값을 1/3 에서 1/2 로 옮기자
    // 아무도 손대지 않았는데 0.45 로 잘려 경계가 조용히 어긋났다.
    // 클램프 상한이 기본값보다 낮으면 설정이 저절로 기본값과 달라진다.
    const p = resolvePhysics(makeDefaultPrefs());
    expect(p.zones.sTowRearMax).toBe(DEFAULT_ZONES.sTowRearMax);
    expect(p.zones.sSpinMin).toBe(DEFAULT_ZONES.sSpinMin);
    expect(p.zones.sTowFrontMin).toBe(DEFAULT_ZONES.sTowFrontMin);
    expect(p.zones.grabPadPx).toBe(DEFAULT_ZONES.grabPadPx);
    expect(p.linearKmh).toBe(DEFAULT_LIMITS.linearKmh);
    expect(p.bumperKmh).toBe(DEFAULT_LIMITS.bumperKmh);
  });
});

describe('prunePhysics', () => {
  it('기본값과 같은 항목은 걷어낸다', () => {
    const pruned = prunePhysics({
      zones: { ...DEFAULT_ZONES },
      linearKmh: 10,
      bumperKmh: 30,
      editorSpeedMultiplier: 1,
    });
    expect(pruned).toEqual({});
  });
  it('기본값과 다른 항목만 남긴다', () => {
    const pruned = prunePhysics({
      zones: { ...DEFAULT_ZONES, sTowRearMax: 0.16 },
      linearKmh: 12,
      bumperKmh: 30,
      editorSpeedMultiplier: 1,
    });
    expect(pruned).toEqual({ zones: { sTowRearMax: 0.16 }, linearKmh: 12 });
  });
});

describe('savePrefs', () => {
  it('setItem 이 던지면 삼키고 false 를 반환한다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      expect(savePrefs(makeDefaultPrefs())).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
  it('정상 상황에서는 true 를 반환하고 저장한다', () => {
    expect(savePrefs(makeDefaultPrefs())).toBe(true);
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();
  });
});

describe('loadPrefs / patchPrefs / resetPrefs', () => {
  it('저장된 값이 없으면 기본값을 돌려준다', () => {
    expect(loadPrefs()).toEqual(makeDefaultPrefs());
  });
  it('손상된 JSON 이 있어도 throw 하지 않고 기본값으로 떨어진다', () => {
    localStorage.setItem(PREFS_KEY, '{not-json');
    expect(loadPrefs()).toEqual(makeDefaultPrefs());
  });
  it('too-new schemaVersion 은 완전히 기본값으로 되돌린다', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ schemaVersion: 999, theme: 'light' }));
    expect(loadPrefs().theme).toBe('dark'); // 구조를 신뢰할 수 없어 theme 도 기본값
  });
  it('patchPrefs 는 저장하고 병합된 값을 돌려준다', () => {
    const { prefs, persisted } = patchPrefs({ loop: true });
    expect(persisted).toBe(true);
    expect(prefs.loop).toBe(true);
    expect(loadPrefs().loop).toBe(true);
  });
  it('resetPrefs 이후 loadPrefs 는 기본값', () => {
    savePrefs({ ...makeDefaultPrefs(), loop: true });
    resetPrefs();
    expect(loadPrefs().loop).toBe(false);
  });
});

// §4.3 P1-4 — 놓임 소리·진동 스위치. 스키마를 올리지 않고 넣은 필드라, 옛 저장본이
// 어떻게 접히는지가 계약의 전부다.
describe('a11y.sound (P1-4)', () => {
  it('기본은 켬이다 — 시선을 화면에서 떼게 하는 기능이라 기본 끔이면 존재하지 않는 기능이 된다', () => {
    expect(makeDefaultPrefs().a11y.sound).toBe(true);
  });

  it('이 키가 없는 옛 저장본은 켬으로 접힌다 — 스키마를 올리지 않은 이유가 이것이다', () => {
    const old = makeDefaultPrefs() as unknown as Record<string, unknown>;
    old.a11y = { largeTargets: false, uiScale: 1, reduceMotion: 'system', singleKeyShortcuts: 'on' };
    localStorage.setItem(PREFS_KEY, JSON.stringify(old));
    expect(loadPrefs().a11y.sound).toBe(true);
    // 대조군 — 같은 저장본의 이웃 필드는 저장된 값을 그대로 읽는다(전부 기본값으로 리셋된 것이 아니다).
    expect(loadPrefs().a11y.singleKeyShortcuts).toBe('on');
  });

  it('꺼 둔 값은 그대로 살아 돌아온다', () => {
    savePrefs({ ...makeDefaultPrefs(), a11y: { ...makeDefaultPrefs().a11y, sound: false } });
    expect(loadPrefs().a11y.sound).toBe(false);
  });

  it("불리언이 아닌 쓰레기는 기본값으로 접는다 — 'off' 라고 써 있어도 켬이다", () => {
    expect(validatePrefs({ a11y: { sound: 'off' } }).value.a11y.sound).toBe(true);
    expect(validatePrefs({ a11y: { sound: 0 } }).value.a11y.sound).toBe(true);
    // 대조군 — 진짜 false 는 통과한다.
    expect(validatePrefs({ a11y: { sound: false } }).value.a11y.sound).toBe(false);
  });

  it('haptic 은 독립 필드가 아니다 — 소리와 진동은 한 스위치다(ui/cues.ts ③)', () => {
    // 필드를 쪼개면 스피커 없는 기기에서 '소리 끔 + 진동 켬' 이라는, 사용자가 구분할 수 없는
    // 두 상태가 생긴다. 3.0 이 sound/haptic 을 하나로 확정한 근거를 여기 못박아 둔다.
    const a11y = makeDefaultPrefs().a11y as unknown as Record<string, unknown>;
    expect(Object.keys(a11y)).not.toContain('haptic');
    // 대조군 — 그 자리를 대신하는 필드는 실재한다(키가 통째로 없어서 통과한 것이 아니다).
    expect(Object.keys(a11y)).toContain('sound');
  });
});

// ---- 3.0 prefs 스키마 확장 (v1 → v2, 한 번에) -------------------------------------------------
// tray(서랍 2개) · seeded(seed 1회 도장) · a11y.twoZone(2존 모드, 5.5 용 값만).
// sound/haptic 은 2.11 이 `a11y.sound` 하나로 이미 넣었으므로 여기서 늘리지 않는다.

/** 상승 직전(v1) 저장본. 사용자가 실제로 만졌을 법한 값을 골고루 담아 둔다 — 전부 기본값이면
 *  "기존 값을 안 잃는다" 를 단언해도 기본값과 구분되지 않아 아무것도 증명하지 못한다. */
const makeV1Doc = (): Record<string, unknown> => ({
  schemaVersion: 1,
  theme: 'light',
  playbackSpeed: 2,
  loop: true,
  showGrid: false,
  showGridLabels: false,
  showRuleZones: false,
  inspectorPinned: true,
  teams: { home: { label: '우리', color: '#123abc', gkColor: '#ffffff' }, away: { label: '상대', color: '#abc123', gkColor: '#000000' } },
  defaultFormation: '2-1-1',
  defaultCourtMode: 'half',
  present: { autoFullscreen: true, wakeLock: false },
  a11y: { largeTargets: true, uiScale: 1.3, reduceMotion: 'always', singleKeyShortcuts: 'off', sound: false },
  hints: { iosPwa: false, degradedStorage: false },
  physics: { linearKmh: 12, zones: { sTowRearMax: 0.16 } },
});

/** index.html:26-33 부트 스크립트의 재현. 키도 로직도 그쪽과 **같은 리터럴**이어야 한다 —
 *  PREFS_KEY 상수를 쓰면 키를 바꿔도 이 테스트가 함께 따라가 버려 불변식을 못 지킨다. */
function bootScriptTheme(): string {
  try {
    const p = JSON.parse(localStorage.getItem('spin.prefs') || '{}') as { theme?: unknown };
    return p.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

describe('3.0 스키마 상승 자체', () => {
  it('현재 스키마 — 이 숫자가 바뀔 때마다 아래 체인 정합성 테스트가 새 단계를 요구한다', () => {
    expect(CURRENT_PREFS_SCHEMA).toBe(3);
  });

  it('체인은 버전마다 한 단계씩만 이어지고 끊긴 곳이 없다 — 같은 단계에서 두 번 올리면 중간 버전 파일이 세상에 남는다', () => {
    expect(PREFS_MIGRATIONS).toHaveLength(CURRENT_PREFS_SCHEMA - 1);
    for (let v = 1; v < CURRENT_PREFS_SCHEMA; v += 1) {
      const steps = PREFS_MIGRATIONS.filter((m) => m.from === v);
      expect(steps, `v${v} 에서 나가는 길`).toHaveLength(1);
      expect(steps[0]!.to).toBe(v + 1);
    }
  });

  it('v1 문서는 마이그레이션 경로를 찾는다 — 체인이 비어 있으면 no-path 로 떨어진다', () => {
    const r = migrateDoc(makeV1Doc(), PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 몇 단계를 거치는지는 아래 "i18n C1" 블록이 더 정확히 잰다 — 여기서는 "경로가 있다"만.
    expect(r.applied.length).toBeGreaterThan(0);
    expect(r.doc.schemaVersion).toBe(CURRENT_PREFS_SCHEMA);
  });

  it('이미 현재 스키마인 문서에는 아무 단계도 돌지 않는다', () => {
    // schemaVersion 을 CURRENT_PREFS_SCHEMA 로 동적으로 맞춘다 — 리터럴 2 를 박으면 다음
    // 스키마 상승 때 이 테스트가 "이미 최신" 이 아니라 "한 단계 남음" 을 검증하게 조용히
    // 바뀌어 버린다(i18n C1 에서 실제로 겪었다: 2→3 상승 후 이 자리가 빨간불이 났다).
    const r = migrateDoc({ ...makeV1Doc(), schemaVersion: CURRENT_PREFS_SCHEMA }, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.applied).toEqual([]);
    expect(r.changed).toBe(false);
  });

  it('마이그레이션 산출물 자체가 새 필드를 들고 나온다 — validatePrefs 의 방어에 기대지 않는다', () => {
    const r = migrateDoc(makeV1Doc(), PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.tray).toEqual({ draw: false, note: false });
    expect(r.doc.seeded).toBe(false);
    expect((r.doc.a11y as Record<string, unknown>).twoZone).toBe(false);
  });
});

// ---- i18n C1: prefs 스키마 확장 (v2 → v3) -----------------------------------------------------
// language 한 필드만 추가한다 — 없거나 지원하지 않는 값이면 'auto' 로 채운다.

/** 상승 직전(v2) 저장본. v1 의 골고루 값 + 3.0 이 추가한 필드까지 채운, language 만 없는 문서. */
const makeV2Doc = (): Record<string, unknown> => ({
  ...makeV1Doc(),
  schemaVersion: 2,
  tray: { draw: true, note: false },
  seeded: true,
  a11y: { largeTargets: true, uiScale: 1.3, reduceMotion: 'always', singleKeyShortcuts: 'off', sound: false, twoZone: true },
});

describe('i18n C1 — prefs v2→v3(language)', () => {
  it('v2 문서는 language 없이도 경로를 찾아 v3 로 오른다', () => {
    const r = migrateDoc(makeV2Doc(), PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.applied).toHaveLength(1);
    expect(r.doc.schemaVersion).toBe(3);
    expect(r.doc.language).toBe('auto');
  });

  it('v1 문서는 두 단계(1→2→3)를 통째로 지나 v3 로 온다', () => {
    const r = migrateDoc(makeV1Doc(), PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.applied).toHaveLength(2);
    expect(r.doc.language).toBe('auto');
  });

  it('이미 유효한 language 값이 있으면 그대로 지나간다 — 마이그레이션은 없는 자리만 채운다', () => {
    const r = migrateDoc({ ...makeV2Doc(), language: 'ja' }, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.language).toBe('ja');
  });

  it("지원하지 않는 값('fr' 등)은 v3 로 오르며 'auto' 로 접힌다", () => {
    const r = migrateDoc({ ...makeV2Doc(), language: 'fr' }, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.language).toBe('auto');
  });
});

describe('3.0 새 필드의 기본값', () => {
  it('서랍 둘은 닫힌 채로 시작한다 — 손잡이는 보이므로 잠긴 기능은 0개다(§3 불변식 2)', () => {
    expect(makeDefaultPrefs().tray.draw).toBe(false);
    expect(makeDefaultPrefs().tray.note).toBe(false);
  });
  it('seeded 는 false 로 시작한다 — 아직 아무것도 심지 않았다', () => {
    expect(makeDefaultPrefs().seeded).toBe(false);
  });
  it('2존 모드는 기본 OFF 다 (결정 ④)', () => {
    expect(makeDefaultPrefs().a11y.twoZone).toBe(false);
  });
});

describe('3.0 v1 → v2 마이그레이션: 새 필드는 채우고 옛 값은 하나도 안 잃는다', () => {
  beforeEach(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(makeV1Doc()));
  });

  it('새 필드 세 개가 기본값으로 채워진다', () => {
    const p = loadPrefs();
    expect(p.tray).toEqual({ draw: false, note: false });
    expect(p.seeded).toBe(false);
    expect(p.a11y.twoZone).toBe(false);
  });

  it('schemaVersion 도장이 최신 스키마로 갱신된다', () => {
    // loadPrefs 는 항상 CURRENT_PREFS_SCHEMA 까지 올린다 — 이 v1 픽스처가 v2 만 겪던 시절엔
    // 리터럴 2 였지만, i18n C1(2→3)이 더해지며 "v1→v2" 라는 이 블록의 제목과 무관하게
    // 최종 도장은 항상 최신값이다.
    expect(loadPrefs().schemaVersion).toBe(CURRENT_PREFS_SCHEMA);
  });

  // 아래는 "기존 값을 안 잃는다" 를 필드별로 따로 찌른다. 한 it 에 몰아 AND 로 묶으면
  // 어느 필드가 증발했는지 못 읽는다.
  it('최상위 값이 살아 돌아온다', () => {
    const p = loadPrefs();
    expect(p.theme).toBe('light');
    expect(p.playbackSpeed).toBe(2);
    expect(p.loop).toBe(true);
    expect(p.showGrid).toBe(false);
    expect(p.showGridLabels).toBe(false);
    expect(p.showRuleZones).toBe(false);
    expect(p.inspectorPinned).toBe(true);
    expect(p.defaultFormation).toBe('2-1-1');
    expect(p.defaultCourtMode).toBe('half');
  });
  it('teams 가 살아 돌아온다', () => {
    expect(loadPrefs().teams).toEqual(makeV1Doc().teams);
  });
  it('present 가 살아 돌아온다', () => {
    expect(loadPrefs().present).toEqual({ autoFullscreen: true, wakeLock: false });
  });
  it('a11y 의 이웃 필드가 살아 돌아온다 — twoZone 을 끼워 넣으면서 형제를 지우지 않는다', () => {
    const p = loadPrefs();
    expect(p.a11y.largeTargets).toBe(true);
    expect(p.a11y.uiScale).toBe(1.3);
    expect(p.a11y.reduceMotion).toBe('always');
    expect(p.a11y.singleKeyShortcuts).toBe('off');
    expect(p.a11y.sound).toBe(false);
  });
  it('hints 가 살아 돌아온다', () => {
    expect(loadPrefs().hints).toEqual({ iosPwa: false, degradedStorage: false });
  });
  it('physics override 가 살아 돌아온다', () => {
    expect(loadPrefs().physics).toEqual({ linearKmh: 12, zones: { sTowRearMax: 0.16 } });
  });
});

describe('3.0 저장 왕복 — 화이트리스트 조립부에 안 적힌 필드는 소리 없이 증발한다', () => {
  it('tray.draw 만 열어 저장해도 다시 읽으면 열려 있다', () => {
    savePrefs({ ...makeDefaultPrefs(), tray: { draw: true, note: false } });
    expect(loadPrefs().tray.draw).toBe(true);
    expect(loadPrefs().tray.note).toBe(false); // 대조군 — 둘이 함께 켜진 것이 아니다
  });
  it('tray.note 만 열어 저장해도 다시 읽으면 열려 있다', () => {
    savePrefs({ ...makeDefaultPrefs(), tray: { draw: false, note: true } });
    expect(loadPrefs().tray.note).toBe(true);
    expect(loadPrefs().tray.draw).toBe(false);
  });
  it('seeded 도장은 저장 왕복을 견딘다 — 증발하면 seed 를 지운 사람에게 매번 되살아난다', () => {
    savePrefs({ ...makeDefaultPrefs(), seeded: true });
    expect(loadPrefs().seeded).toBe(true);
  });
  it('a11y.twoZone 은 저장 왕복을 견딘다', () => {
    const d = makeDefaultPrefs();
    savePrefs({ ...d, a11y: { ...d.a11y, twoZone: true } });
    expect(loadPrefs().a11y.twoZone).toBe(true);
    expect(loadPrefs().a11y.sound).toBe(true); // 대조군 — a11y 가 통째로 갈린 것이 아니다
  });
  it('patchPrefs 로 서랍만 만져도 나머지 prefs 는 그대로다', () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'light', seeded: true });
    const { prefs } = patchPrefs({ tray: { draw: true, note: true } });
    expect(prefs.tray).toEqual({ draw: true, note: true });
    expect(prefs.theme).toBe('light');
    expect(prefs.seeded).toBe(true);
  });

  it('불리언이 아닌 쓰레기는 기본값으로 접는다', () => {
    expect(validatePrefs({ tray: { draw: 'open', note: 1 } }).value.tray).toEqual({ draw: false, note: false });
    expect(validatePrefs({ tray: 'open' }).value.tray).toEqual({ draw: false, note: false });
    expect(validatePrefs({ seeded: 'yes' }).value.seeded).toBe(false);
    expect(validatePrefs({ a11y: { twoZone: 'on' } }).value.a11y.twoZone).toBe(false);
    // 대조군 — 진짜 true 는 통과한다(무엇을 넣어도 false 가 나오는 것이 아니다).
    expect(validatePrefs({ tray: { draw: true, note: true } }).value.tray).toEqual({ draw: true, note: true });
    expect(validatePrefs({ seeded: true }).value.seeded).toBe(true);
    expect(validatePrefs({ a11y: { twoZone: true } }).value.a11y.twoZone).toBe(true);
  });
});

describe('3.0 이후에도 spin.prefs.theme 은 최상위 문자열이다 (index.html:26-33 부트 스크립트 전제)', () => {
  it('저장 키는 리터럴 spin.prefs 다 — 부트 스크립트가 이 문자열을 박아 두고 읽는다', () => {
    expect(PREFS_KEY).toBe('spin.prefs');
  });

  it('스키마 2 로 저장한 뒤에도 부트 스크립트가 light 를 읽는다', () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'light' });
    expect(bootScriptTheme()).toBe('light');
    // 첫 페인트 전에 도는 스크립트라 마이그레이션을 못 거친다 — 날것의 JSON 최상위에 있어야 한다.
    const raw = JSON.parse(localStorage.getItem('spin.prefs')!) as Record<string, unknown>;
    expect(typeof raw.theme).toBe('string');
    expect(raw.schemaVersion).toBe(CURRENT_PREFS_SCHEMA);
  });

  it('대조군 — dark 로 저장하면 부트 스크립트도 dark 를 읽는다', () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'dark' });
    expect(bootScriptTheme()).toBe('dark');
  });

  it('v1 저장본을 읽어 되쓰는 상승 경로가 테마를 옮기지 않는다', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(makeV1Doc())); // theme:'light'
    expect(bootScriptTheme()).toBe('light'); // 상승 전
    savePrefs(loadPrefs()); // 기회적 되쓰기
    expect(bootScriptTheme()).toBe('light'); // 상승 후에도 같은 자리에서 읽힌다
  });
});

describe('3.0 알 수 없는 미래 버전', () => {
  it('바로 다음 버전(3)도 거부하고 완전한 기본값으로 되돌린다 — 기존 too-new 정책 그대로', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeV1Doc(), schemaVersion: CURRENT_PREFS_SCHEMA + 1 }));
    expect(loadPrefs()).toEqual(makeDefaultPrefs());
  });

  it('거부는 loadPrefs 가 아니라 migrateDoc 이 판정한다', () => {
    const r = migrateDoc({ schemaVersion: CURRENT_PREFS_SCHEMA + 1 }, PREFS_MIGRATIONS, CURRENT_PREFS_SCHEMA);
    expect(r).toEqual({ ok: false, reason: 'too-new', found: CURRENT_PREFS_SCHEMA + 1, supported: CURRENT_PREFS_SCHEMA });
  });
});

// ── 5.0 ④(2026-08-13) — 죽은 export UI_KEY('spin.ui') 삭제 ────────────────────────────────────
// 호출자 0곳이었다(rg 로 문자열 'spin.ui' 까지 확인 — 남은 곳은 docs/DESIGN.md 의 옛 스냅숏뿐).
// 남겨 두면 다음 사람이 "이 키는 왜 backup 봉투에 안 들어가지" 를 다시 조사한다.
describe('사라진 계약 — UI_KEY 는 이 모듈에 없다 (5.0 ④)', () => {
  it('UI_KEY 가 더 이상 export 되지 않는다', async () => {
    const mod: Record<string, unknown> = await import('./prefs.ts');
    expect('UI_KEY' in mod).toBe(false);
    // 대조군 — 이 검사가 모듈을 실제로 읽었다(이름을 틀려 빈 객체를 본 것이 아니다).
    expect(mod.PREFS_KEY).toBe('spin.prefs');
  });
});
