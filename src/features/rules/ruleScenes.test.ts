// 규칙 화면 장면 데이터(2026-08-21 신설) 불변식 — docs/PLAN-RULES-SCREEN.md §E.
import { describe, expect, it } from 'vitest';
import { buildRuleScene, RULE_SCENE_IDS } from './ruleScenes.ts';
import type { RuleSceneId } from './ruleScenes.ts';
import { ruleContentFor } from './ruleContent.ts';
import { validateDrill } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';

/** v9 — 링은 스텝 소유다. 장면 전체에서 쓰인 링의 **집합**을 본다(중복 제거) — 지금 장면들은
 *  전부 "장면 내내 같은 링" 이라, 예전에 `cast.balls` 한 줄을 보던 것과 같은 것을 잰다.
 *  스텝마다 다른 링을 쓰는 장면이 생기면 이 헬퍼가 그 사실을 드러낸다(집합이 둘이 된다). */
const ringsOf = (d: Drill): string[] => [...new Set(d.steps.flatMap((s) => Object.values(s.ballRings ?? {}).filter((r): r is NonNullable<typeof r> => r !== undefined)))];

describe('buildRuleScene', () => {
  it.each(RULE_SCENE_IDS)('%s — validateDrill 을 통과한다(저장 왕복 불변)', (id) => {
    const drill = buildRuleScene(id);
    const result = validateDrill(drill);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.issues)).toBe(true);
  });

  it.each(RULE_SCENE_IDS)('%s — 코트는 28×15 풀 코트다', (id) => {
    const drill = buildRuleScene(id);
    expect(drill.courtMode).toBe('full');
    expect(drill.courtSize).toBe('28x15');
  });

  it('링 3m 은 2-on-1 계열 5종 + 세트볼에만 있다', () => {
    const THREE_METER_SCENES: readonly RuleSceneId[] = [
      'two-on-one',
      'two-on-one-active',
      'two-on-one-gk',
      'two-on-one-open',
      'two-on-one-escape',
      'set-ball',
    ];
    for (const id of RULE_SCENE_IDS) {
      const drill = buildRuleScene(id);
      const rings = ringsOf(drill);
      if (THREE_METER_SCENES.includes(id)) {
        expect(rings, id).toEqual(['3m']);
      } else {
        expect(rings, id).not.toContain('3m');
      }
    }
  });

  it('링 5m 은 재시작 7종(kickoff·kick-in·goal-kick·corner·dfk·ifk·penalty)에만 있다', () => {
    const FIVE_METER_SCENES: readonly RuleSceneId[] = ['kickoff', 'kick-in', 'goal-kick', 'corner', 'dfk', 'ifk', 'penalty'];
    for (const id of RULE_SCENE_IDS) {
      const drill = buildRuleScene(id);
      const rings = ringsOf(drill);
      if (FIVE_METER_SCENES.includes(id)) {
        expect(rings, id).toEqual(['5m']);
      } else {
        expect(rings, id).not.toContain('5m');
      }
    }
  });

  it('컷 스텝(cut:true)이 있는 장면은 최소 2스텝이고, cut 인 스텝은 첫 스텝이 아니다', () => {
    for (const id of RULE_SCENE_IDS) {
      const drill = buildRuleScene(id);
      const cutIndices = drill.steps.map((s, i) => (s.cut ? i : -1)).filter((i) => i >= 0);
      for (const i of cutIndices) {
        expect(i, `${id} 스텝 ${i}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('ruleContent ↔ ruleScenes 연결', () => {
  it('sceneId 가 있는 모든 조항이 buildRuleScene 이 실제로 처리하는 값을 가리킨다', () => {
    const laws = ruleContentFor('ko');
    const withScene = laws.filter((l) => l.sceneId !== undefined);
    expect(withScene.length).toBeGreaterThan(0);
    for (const law of withScene) {
      expect(() => buildRuleScene(law.sceneId as RuleSceneId), `law ${law.law}`).not.toThrow();
      expect(RULE_SCENE_IDS, `law ${law.law}`).toContain(law.sceneId);
    }
  });

  it('RULE_SCENE_IDS 는 정확히 21개다', () => {
    expect(RULE_SCENE_IDS).toHaveLength(21);
  });
});
