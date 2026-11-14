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
import type { Capability, SpinApp } from '../drivers/SpinApp.ts';
import type { SeedState } from '../fixtures/seed.ts';

export interface Scenario {
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
  run(app: SpinApp): Promise<void>;
}

export interface ScenarioGroup {
  name: string;
  scenarios: Scenario[];
}

export const defineGroup = (name: string, scenarios: Scenario[]): ScenarioGroup => ({ name, scenarios });

/** 아직 구현하지 않은 시나리오 자리 */
export const todo = (title: string, what: string, needs: Capability[] = []): Scenario => ({
  title,
  needs,
  todo: what,
  run: () => Promise.reject(new Error(`not implemented: ${title}`)),
});

/** 시나리오 needs 중 드라이버에 없는 능력 */
export const missingCapabilities = (scenario: Scenario, app: SpinApp): Capability[] =>
  (scenario.needs ?? []).filter((need) => !app.capabilities.has(need));

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
