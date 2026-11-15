// 저장소 시드 — 앱 스크립트가 돌기 전에 저장소를 원하는 상태로 만든다. docs/PLAN-TEST-SUITE.md §3.
//
// SPIN 의 첫 실행 잡음(부팅 로더·작은 화면 안내·[시작하기]·화면 투어·소리·언어 자동 감지·시드 드릴)은
// 전부 `localStorage['spin.prefs']` 의 도장으로 이미 제어된다. 그래서 잡음은 기능을 끄는 스위치가 아니라
// **상태를 심어서** 지운다(결정 5) — 끄는 스위치를 새로 만들면 배송 경로가 사각지대가 된다(AGENTS §6
// `loaderMinMs` 의 교훈).
//
// 프로필
// - quiet  (기본) : 아래 도장 전부 + `seeded: true`(빈 서랍)
// - scenes        : quiet 에서 `seeded: false` — 앱이 **스스로** 규칙 장면 22벌을 심는다. 테스트가
//                   IDB 문서를 직접 쓰지 않는다(스키마를 두 벌 두지 않는다)
// - fresh         : 아무것도 안 심는다 — 첫 방문 순서(S3) 전용
//
// ⚠️ 기본값·도장 이름은 앱의 `makeDefaultPrefs`·`TUTORIAL_SCREEN_KEYS` 에서 가져온다 — 여기 베껴 적으면
//    투어가 하나 늘 때 시드만 낡아 투어가 시험 화면을 덮는다.
//
// 드라이버 중립: buildSeed() 는 { 키: JSON 문자열 } 을 만들고 applySeed() 는 그것을 페이지 안에서
// 적용하는 순수 함수다 — Playwright(page.evaluate)·WebdriverIO(browser.execute) 어디서든 그대로 쓴다.
import { DB_NAME } from '../../src/storage/db.ts';
import { makeDefaultPrefs, PREFS_KEY, TUTORIAL_SCREEN_KEYS, type Preferences, type TutorialScreenKey } from '../../src/storage/prefs.ts';

export type SeedProfile = 'quiet' | 'scenes' | 'fresh';

/** prefs 덮어쓰기 — 최상위는 얕게, `a11y`·`present`·`tray` 는 한 단계 더 합친다 */
export type PrefsPatch = Partial<Omit<Preferences, 'a11y' | 'present' | 'tray'>> & {
  a11y?: Partial<Preferences['a11y']>;
  present?: Partial<Preferences['present']>;
  tray?: Partial<Preferences['tray']>;
};

export interface SeedState {
  /** 기본 'quiet' */
  profile?: SeedProfile;
  /** 프로필 위에 덮는 prefs. `fresh` 에 주면 그것만 심는다(나머지는 앱 기본값) */
  prefs?: PrefsPatch;
  /** 심은 뒤 처음 여는 주소 (기본 '/') */
  route?: string;
}

/** quiet 프로필의 prefs — 첫 실행 잡음을 전부 잠재운다(§3 표) */
function quietPrefs(): Preferences {
  const d = makeDefaultPrefs();
  return {
    ...d,
    // 부팅·레일 로더(1500/1000ms)·스텝 트윈·CSS 모션을 감축 모션 분기로 0 으로 접는다
    a11y: { ...d.a11y, reduceMotion: 'always', sound: false },
    seeded: true,
    language: 'ko',
    tutorialsSeen: Object.fromEntries(TUTORIAL_SCREEN_KEYS.map((k) => [k, true])) as Record<TutorialScreenKey, true>,
    smallScreenNoticeDismissed: true,
    helpWelcomeSeen: true,
  };
}

function mergePrefs(base: Preferences, patch: PrefsPatch): Preferences {
  return {
    ...base,
    ...patch,
    a11y: { ...base.a11y, ...patch.a11y },
    present: { ...base.present, ...patch.present },
    tray: { ...base.tray, ...patch.tray },
  } as Preferences;
}

/** SeedState → localStorage 에 그대로 넣을 { 키: JSON 문자열 } */
export function buildSeed(state: SeedState = {}): Record<string, string> {
  const profile = state.profile ?? 'quiet';
  if (profile === 'fresh') {
    return state.prefs ? { [PREFS_KEY]: JSON.stringify(mergePrefs(makeDefaultPrefs(), state.prefs)) } : {};
  }
  const base = quietPrefs();
  if (profile === 'scenes') base.seeded = false;
  return { [PREFS_KEY]: JSON.stringify(mergePrefs(base, state.prefs ?? {})) };
}

export interface SeedPayload {
  entries: Record<string, string>;
  dbName: string;
}

export const seedPayload = (state?: SeedState): SeedPayload => ({ entries: buildSeed(state), dbName: DB_NAME });

/**
 * 페이지 안에서 실행되는 함수 — 저장소를 비우고 시드를 넣는다. 직렬화되어 브라우저로 넘어가므로
 * 바깥 변수를 참조하면 안 된다. IndexedDB 는 지우기가 끝날 때까지 기다린다(지운 뒤 앱이 열어야 빈 서랍이다).
 */
export async function applySeed({ entries, dbName }: SeedPayload): Promise<void> {
  localStorage.clear();
  sessionStorage.clear();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName);
    let blocked = false;
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('indexedDB.deleteDatabase 실패'));
    // 열린 연결이 남아 막혀도 그 연결이 닫히면 onsuccess 가 온다 — 여기서 끝내지 않는다
    req.onblocked = () => {
      blocked = true;
    };
    // ⚠️ 2026-11-15 CI(e2e-app linux) — 앞 문서의 연결이 끝내 안 닫혀 지우기가 영영 기다린 적이 있다(스크립트 상한 20초로
    //   "script timeout" 만 남았다). 상한 안에 이름 붙은 오류로 끊어, 드라이버가 알아보고 되살릴 수 있게 한다(WdioApp.seed).
    //   직렬화되는 함수라 상한·표식은 바깥 상수가 아니라 여기 적는다.
    setTimeout(() => reject(new Error(`SEED_DB_STUCK: deleteDatabase 가 8초 안에 끝나지 않음 (blocked ${blocked ? '옴' : '안 옴'})`)), 8_000);
  });
  for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
}
