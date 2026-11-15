// 시나리오 그룹 → 실제 앱 위의 Playwright 시험. e2e/web/run.ts 와 같은 규칙이다: needs → 이유를 남기고 skip, seed,
// 그다음 kit.ts executeScenario 의 known-bug 판정. docs/PLAN-TEST-SUITE.md §11.
import type { SpinApp } from '../drivers/SpinApp.ts';
import { executeScenario, missingCapabilities, type ScenarioGroup } from '../scenarios/kit.ts';
import { test } from './fixtures.ts';
import type { TauriApp } from './tauri-app.ts';

/** only: 그룹에서 이 제목 머리(예: 'S4')로 시작하는 시나리오만 — 공유 부분집합을 고를 때(shared.spec.ts) */
export function runGroup<A extends SpinApp>(group: ScenarioGroup<A>, { only }: { only?: string[] } = {}): void {
  const scenarios = only ? group.scenarios.filter((s) => only.some((id) => s.title.startsWith(`${id} `))) : group.scenarios;
  if (only && scenarios.length !== only.length) {
    throw new Error(`${group.name}: 고른 ${only.join(',')} 중 ${only.length - scenarios.length}개가 그룹에 없다 — 제목이 바뀌었나`);
  }
  test.describe(group.name, () => {
    for (const scenario of scenarios) {
      test(scenario.title, async ({ app }) => {
        const typed = app as TauriApp & A;
        test.skip(!!scenario.todo, `TODO: ${scenario.todo}`);
        const missing = missingCapabilities(scenario, typed);
        test.skip(missing.length > 0, `드라이버(${app.platform})에 없는 능력: ${missing.join(', ')}`);

        await app.step('앱 띄우기 (seed)', () => app.seed(scenario.seed));
        await executeScenario(typed, scenario, (type, description) => test.info().annotations.push({ type, description }));
      });
    }
  });
}
