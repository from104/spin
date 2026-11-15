// 시나리오 그룹 → Playwright 시험. 스펙 파일은 이것만 부른다(그룹당 3줄):
//
//   import group from '../scenarios/boot.ts';
//   import { runGroup } from './run.ts';
//   runGroup(group);
//
// QCalc `feature/e2e-suite` 의 run.ts 그대로다 — needs 검사·skip 사유·knownBug/symptom 판정(kit.ts executeScenario,
// 실제 앱 층 e2e/app/run.ts 와 같은 판정).
// `test.fixme`·`test.skip(조건 없이)`·`retries` 는 쓰지 않는다(PLAN-TEST-SUITE 결정 7): 고쳐도 모르는 일이
// 없어야 하고, 흔들림은 숨기지 않고 드러낸다.
import { test } from '../fixtures/test.ts';
import { executeScenario, missingCapabilities, type ScenarioGroup } from '../scenarios/kit.ts';

export function runGroup(group: ScenarioGroup): void {
  test.describe(group.name, () => {
    for (const scenario of group.scenarios) {
      test(scenario.title, async ({ app }) => {
        test.skip(!!scenario.todo, `TODO: ${scenario.todo}`);
        const missing = missingCapabilities(scenario, app);
        test.skip(missing.length > 0, `드라이버(${app.platform})에 없는 능력: ${missing.join(', ')}`);

        await app.step('앱 띄우기 (seed)', () => app.seed(scenario.seed));
        await executeScenario(app, scenario, (type, description) => test.info().annotations.push({ type, description }));
      });
    }
  });
}
