// 시나리오 작성 도구 — 드라이버 중립(Playwright 를 import 하지 않는다). docs/PLAN-TEST-SUITE.md §2·§4.
//
// 시나리오 = { title, needs?, seed?, run(app) }. 파일 하나가 그룹 하나를 default export 한다:
//
//   export default defineGroup('boot', [
//     { title: '직접 진입', run: async (app) => { await app.open('/drills'); … } },
//   ]);
//
// 실행기(e2e/web/run.ts 등)가 그룹의 각 시나리오를 시험 하나로 만들고, seed 로 앱을 띄운 뒤 run 을 부른다.
//
// ⚠️ 시나리오를 늘리기 전에 한 문장으로 답한다: **"이것을 지우면 어떤 실기 버그가 새는가?"** 그리고 새
//    단언은 앱을 일부러 망가뜨려 빨간불을 본 뒤 남긴다(AGENTS.md 「E2E 시나리오 규칙」).
//
// QCalc `feature/e2e-suite` 의 kit.ts 에서 Scenario·defineGroup·todo·missingCapabilities·eventually 를
// 그대로 가져왔다. 키패드 표는 버렸다(SPIN 의 조작 대상은 코트다).
import type { Capability, CourtObject, CourtPoint, ScreenPoint, SpinApp } from '../drivers/SpinApp.ts';
import type { SeedState } from '../fixtures/seed.ts';

/** 시나리오 — A 는 그 시나리오가 다루는 드라이버(공유 시나리오는 SpinApp, 앱 전용은 TauriApp — e2e/app/native.ts) */
export interface Scenario<A extends SpinApp = SpinApp> {
  /** 보고서에 나오는 이름 */
  title: string;
  /** 필요한 드라이버 능력 — 하나라도 없으면 건너뛰고 이유를 남긴다 */
  needs?: Capability[];
  /** 앱을 띄울 때의 저장소 상태 (기본: quiet 프로필 — 한국어, 첫 실행 잡음 없음, 빈 서랍) */
  seed?: SeedState;
  /**
   * 알려진 앱 버그 — 이 시나리오는 지금 **실패해야 정상**이다(버그 설명을 적는다. 시험을 약하게 고치지 말 것).
   * 실행기가 시나리오를 그대로 돌려, 실패하면 "known-bug"(기대된 실패)로 보고하고, 통과하면 버그가 고쳐진 것이므로
   * "bug fixed — remove the known-bug mark" 로 빨갛게 만든다. 그때 이 줄(과 관련 예외 처리)을 지운다.
   */
  knownBug?: string;
  /** knownBug 와 함께 필수 — 그 버그로 생기는 오류 메시지의 모양. 메시지가 맞지 않는 실패는 "기대된 실패"가 아니라 진짜 실패다 */
  symptom?: RegExp;
  /** 아직 안 만든 시나리오 — 무엇을 다룰지 적어 두면 실행기가 건너뛰고 보고한다 */
  todo?: string;
  run(app: A): Promise<void>;
}

export interface ScenarioGroup<A extends SpinApp = SpinApp> {
  name: string;
  scenarios: Scenario<A>[];
}

export const defineGroup = <A extends SpinApp = SpinApp>(name: string, scenarios: Scenario<A>[]): ScenarioGroup<A> => ({
  name,
  scenarios,
});

/** 아직 구현하지 않은 시나리오 자리 */
export const todo = <A extends SpinApp = SpinApp>(title: string, what: string, needs: Capability[] = []): Scenario<A> => ({
  title,
  needs,
  todo: what,
  run: () => Promise.reject(new Error(`not implemented: ${title}`)),
});

/** 시나리오 needs 중 드라이버에 없는 능력 */
export const missingCapabilities = <A extends SpinApp>(scenario: Scenario<A>, app: A): Capability[] =>
  (scenario.needs ?? []).filter((need) => !app.capabilities.has(need));

/**
 * 시나리오 하나를 돌리고 known-bug 판정까지 한다 — 두 실행기(e2e/web/run.ts·e2e/app/run.ts)가 함께 쓴다.
 * 알려진 앱 버그는 실패해야 정상이다. 통과하면 버그가 고쳐진 것 → 표시를 지우라고 빨갛게 알린다(test.fail() 과 같은 뜻이지만
 * 메시지를 우리가 정하고, 요약이 known-bug 를 따로 센다). annotate 는 보고서 주석을 다는 자리(Playwright test.info()).
 */
export async function executeScenario<A extends SpinApp>(
  app: A,
  scenario: Scenario<A>,
  annotate: (type: string, description: string) => void,
): Promise<void> {
  if (!scenario.knownBug) return scenario.run(app);
  annotate('known-bug', scenario.knownBug);
  let failure: unknown;
  try {
    await scenario.run(app);
  } catch (error) {
    failure = error;
  }
  if (!scenario.symptom) throw new Error('knownBug 에는 symptom(기대하는 오류 모양)이 함께 있어야 한다');
  if (failure === undefined) {
    throw new Error(`bug fixed — remove the known-bug mark (scenario.knownBug): ${scenario.knownBug}`);
  }
  const message = String((failure as Error)?.message ?? failure);
  if (!scenario.symptom.test(message)) {
    throw new Error(`known-bug 의 증상이 아닌 실패 — 기대 ${scenario.symptom} / 실제: ${message.split('\n')[0]!.slice(0, 200)}`);
  }
  annotate('known-bug-error', String(failure).split('\n')[0]!.slice(0, 200));
}

// ─── 단언 ─────────────────────────────────────────────────────────────────

export interface EventuallyOptions {
  /** 기다릴 최대 시간 (기본 5초) */
  timeout?: number;
}

/**
 * read() 가 expected 가 될 때까지 기다린다. 화면은 비동기로 갱신되므로 화면 단언은 이걸 쓴다.
 * 읽는 중 예외(요소가 잠깐 없음 등)도 기다리는 동안은 다시 시도한다. 고정 sleep 대신 쓰는 유일한 기다림이다.
 */
export async function eventually<T>(
  label: string,
  read: () => Promise<T>,
  expected: T | ((actual: T) => boolean),
  { timeout = 5000 }: EventuallyOptions = {},
): Promise<T> {
  const ok = typeof expected === 'function' ? (expected as (a: T) => boolean) : (a: T) => a === expected;
  const deadline = Date.now() + timeout;
  let last: T | undefined;
  let lastError: unknown;
  for (;;) {
    try {
      last = await read();
      lastError = undefined;
      if (ok(last)) return last;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const want = typeof expected === 'function' ? '(조건)' : JSON.stringify(expected);
  const got = lastError ? `오류: ${String(lastError).split('\n')[0]}` : JSON.stringify(last);
  throw new Error(`${label}: ${timeout}ms 안에 ${want} 이(가) 되지 않음 — 마지막 값 ${got}`);
}

/** 조건이 참이어야 한다 — 아니면 label 과 실제 값을 담은 오류. 드라이버 중립 단언(expect 를 import 하지 않는다) */
export function check(condition: boolean, label: string, actual?: unknown): asserts condition {
  if (!condition) throw new Error(`${label}${actual === undefined ? '' : ` — 실제 ${JSON.stringify(actual)}`}`);
}

/** 끊긴 외부 요청·콘솔 오류가 하나도 없어야 한다. 외부 요청을 먼저 본다 — 끊긴 요청은 콘솔 오류도 함께
 *  남기므로, 순서가 반대면 새는 요청이 늘 "콘솔 오류" 로만 보고되어 원인이 가려진다 */
export async function expectQuiet(app: SpinApp, where: string): Promise<void> {
  if (app.capabilities.has('netMock')) {
    const blocked = await app.blockedRequests();
    check(blocked.length === 0, `${where}: 외부 요청 ${blocked.length}건`, blocked.slice(0, 3));
  }
  const errors = await app.errors();
  check(errors.length === 0, `${where}: 콘솔 오류 ${errors.length}건`, errors.slice(0, 3));
}

// ─── 코트 ─────────────────────────────────────────────────────────────────

/** 코트 점 — 경기면 사각형의 0..1 비율(SpinApp.CourtPoint). 앱 상수를 베끼지 않고 자리를 말하는 유일한 길 */
export const at = (u: number, v: number): CourtPoint => ({ u, v });

/** 화면 점 이동 */
export const shift = (p: ScreenPoint, dx: number, dy: number): ScreenPoint => ({ x: p.x + dx, y: p.y + dy });

/** 손끝 허용 오차(화면 px) — 계획 §8: 화면 판정은 정확값이 아니라 3px. WebKit 은 포인터 좌표를 정수로 반올림한다 */
export const FINGER_PX = 3;

/** 두 화면 점이 tol 안에 있어야 한다 */
export function expectNear(label: string, actual: ScreenPoint | null, expected: ScreenPoint, tol = FINGER_PX): void {
  check(actual !== null, `${label}: 화면에 없다`);
  const dx = actual.x - expected.x;
  const dy = actual.y - expected.y;
  check(
    Math.abs(dx) <= tol && Math.abs(dy) <= tol,
    `${label}: 기대 (${expected.x.toFixed(1)}, ${expected.y.toFixed(1)}) ±${tol}px — 어긋남 (${dx.toFixed(1)}, ${dy.toFixed(1)})`,
  );
}

/** 모델 자세에서 id 하나 */
export async function objectById(app: SpinApp, id: string): Promise<CourtObject> {
  const found = (await app.objects()).find((o) => o.id === id);
  check(!!found, `개체 ${id} 가 모델에 없다`);
  return found;
}

/** 자세 비교용 정규형 — id 순으로 정렬한 (id, x, y, 각도) */
export const poseKey = (objects: readonly CourtObject[]): string =>
  JSON.stringify([...objects].sort((a, b) => a.id.localeCompare(b.id)).map((o) => [o.id, o.x, o.y, o.angleDeg]));

/** 판정자 자체 검증(계획 §8 위험 2): CTM 으로 푼 경기면 네 모서리의 외접 상자가 브라우저 레이아웃의
 *  court-field 상자와 같아야 한다. 어긋나면 그 엔진·배율에서는 좌표 판정 전부를 믿을 수 없다 */
export async function expectCtmMatchesLayout(app: SpinApp): Promise<void> {
  const corners = await Promise.all([at(0, 0), at(1, 0), at(0, 1), at(1, 1)].map((p) => app.courtToScreen(p)));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const box = await app.rectOf('court-field');
  check(!!box, 'court-field 가 화면에 없다');
  const gap = Math.max(
    Math.abs(Math.min(...xs) - box.left),
    Math.abs(Math.min(...ys) - box.top),
    Math.abs(Math.max(...xs) - box.right),
    Math.abs(Math.max(...ys) - box.bottom),
  );
  check(gap <= 1, `CTM 으로 푼 경기면이 레이아웃 상자와 ${gap.toFixed(2)}px 어긋난다 — 좌표 판정자를 믿을 수 없다`);
}
