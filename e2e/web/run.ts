// 시나리오 그룹 → Playwright 시험. 스펙 파일은 이것만 부른다(그룹당 3줄):
//
//   import group from '../scenarios/boot.ts';
//   import { runGroup } from './run.ts';
//   runGroup(group);
//
// QCalc `feature/e2e-suite` 의 run.ts 그대로다 — needs 검사·skip 사유·knownBug/symptom 판정.
// `test.fixme`·`test.skip(조건 없이)`·`retries` 는 쓰지 않는다(PLAN-TEST-SUITE 결정 7): 고쳐도 모르는 일이
// 없어야 하고, 흔들림은 숨기지 않고 드러낸다.
import { test } from '../fixtures/test.ts';
import { missingCapabilities, type ScenarioGroup } from '../scenarios/kit.ts';

export function runGroup(group: ScenarioGroup): void {
  test.describe(group.name, () => {
    for (const scenario of group.scenarios) {
      test(scenario.title, async ({ app }) => {
        test.skip(!!scenario.todo, `TODO: ${scenario.todo}`);
        const missing = missingCapabilities(scenario, app);
        test.skip(missing.length > 0, `드라이버(${app.platform})에 없는 능력: ${missing.join(', ')}`);

        await app.step('앱 띄우기 (seed)', () => app.seed(scenario.seed));
        if (!scenario.knownBug) return scenario.run(app);

        // 알려진 앱 버그: 실패해야 정상. 통과하면 버그가 고쳐진 것 → 표시를 지우라고 빨갛게 알린다.
        // (test.fail() 과 같은 뜻이지만 메시지를 우리가 정하고, 요약이 known-bug 를 따로 센다)
        test.info().annotations.push({ type: 'known-bug', description: scenario.knownBug });
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
          throw new Error(
            `known-bug 의 증상이 아닌 실패 — 기대 ${scenario.symptom} / 실제: ${message.split('\n')[0]!.slice(0, 200)}`,
          );
        }
        test
          .info()
          .annotations.push({ type: 'known-bug-error', description: String(failure).split('\n')[0]!.slice(0, 200) });
      });
    }
  });
}
