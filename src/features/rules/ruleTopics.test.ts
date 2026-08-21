// 주제별 콘텐츠 모델(2026-08-22 재설계) 불변식 — docs/PLAN-RULES-REDESIGN.md §6.
import { describe, expect, it } from 'vitest';
import { ruleTopicsFor, RULE_TOPIC_KEYS, MISCONDUCT_CARDS } from './ruleTopics.ts';
import { RESTART_COLUMNS, RESTART_ROW_LABELS } from './restartTable.ts';
import { RULE_SCENE_IDS } from './ruleScenes.ts';
import { RULE_FIGURE_IDS } from './figures/ids.ts';

const TOPICS = ruleTopicsFor('ko');

describe('ruleTopicsFor', () => {
  it('주제는 정확히 8개이고 key 가 유일하다', () => {
    expect(TOPICS).toHaveLength(8);
    expect(new Set(TOPICS.map((t) => t.key)).size).toBe(8);
    expect(TOPICS.map((t) => t.key)).toEqual(RULE_TOPIC_KEYS);
  });

  it('모든 주제가 title·tagline·blocks 를 최소 1개씩 가진다', () => {
    for (const topic of TOPICS) {
      expect(topic.title.length, topic.key).toBeGreaterThan(0);
      expect(topic.tagline.length, topic.key).toBeGreaterThan(0);
      expect(topic.blocks.length, topic.key).toBeGreaterThan(0);
    }
  });

  it('scene 블록의 sceneId 가 전부 RULE_SCENE_IDS 에 실존한다', () => {
    for (const topic of TOPICS) {
      for (const block of topic.blocks) {
        if (block.kind !== 'scene') continue;
        expect(RULE_SCENE_IDS, `${topic.key}: ${block.sceneId}`).toContain(block.sceneId);
      }
    }
  });

  it('figure 블록의 figureId 가 전부 RULE_FIGURE_IDS 에 실존한다', () => {
    for (const topic of TOPICS) {
      for (const block of topic.blocks) {
        if (block.kind !== 'figure') continue;
        expect(RULE_FIGURE_IDS, `${topic.key}: ${block.figureId}`).toContain(block.figureId);
      }
    }
  });

  it('restart-table·card-list·law-index 블록은 주제당 최대 1개다', () => {
    for (const topic of TOPICS) {
      for (const kind of ['restart-table', 'card-list', 'law-index'] as const) {
        const count = topic.blocks.filter((b) => b.kind === kind).length;
        expect(count, `${topic.key}: ${kind}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('21개 장면 전부가 최소 하나의 주제에 배치된다(고아 장면 없음)', () => {
    const placed = new Set(TOPICS.flatMap((t) => t.blocks.filter((b) => b.kind === 'scene').map((b) => b.sceneId)));
    // 표(restart-table)가 참조하는 재개 7종 장면도 배치로 친다 — restarts 주제는 scene 블록이
    // 아니라 표 블록으로 그 장면들을 연다.
    for (const col of RESTART_COLUMNS) placed.add(col.sceneId);
    for (const id of RULE_SCENE_IDS) {
      expect(placed, id).toContain(id);
    }
    expect(placed.size).toBe(RULE_SCENE_IDS.length);
  });

  it('rulebook 주제만 law-index 블록을 가진다', () => {
    for (const topic of TOPICS) {
      const has = topic.blocks.some((b) => b.kind === 'law-index');
      expect(has, topic.key).toBe(topic.key === 'rulebook');
    }
  });

  it('restarts 주제만 restart-table 블록을 가진다', () => {
    for (const topic of TOPICS) {
      const has = topic.blocks.some((b) => b.kind === 'restart-table');
      expect(has, topic.key).toBe(topic.key === 'restarts');
    }
  });
});

describe('restartTable', () => {
  it('7열 × 5행이고, 열 순서는 재개 7종 정본 순서다', () => {
    expect(RESTART_COLUMNS).toHaveLength(7);
    expect(RESTART_ROW_LABELS).toHaveLength(5);
    expect(RESTART_COLUMNS.map((c) => c.key)).toEqual(['kickoff', 'kick-in', 'corner', 'goal-kick', 'dfk', 'ifk', 'penalty']);
  });

  it('모든 열의 sceneId 가 RULE_SCENE_IDS 에 실존하고, 재개 7종 장면과 정확히 1:1이다', () => {
    const SET_PIECE_SCENES = ['kickoff', 'kick-in', 'corner', 'goal-kick', 'dfk', 'ifk', 'penalty'];
    const sceneIds = RESTART_COLUMNS.map((c) => c.sceneId);
    expect(new Set(sceneIds).size).toBe(7);
    for (const id of sceneIds) expect(RULE_SCENE_IDS, id).toContain(id);
    expect(sceneIds.sort()).toEqual([...SET_PIECE_SCENES].sort());
  });

  it('모든 칸이 채워져 있다(빈 문자열 없음)', () => {
    for (const col of RESTART_COLUMNS) {
      expect(col.cells.when.length, `${col.key}.when`).toBeGreaterThan(0);
      expect(col.cells.ball.length, `${col.key}.ball`).toBeGreaterThan(0);
      expect(col.cells.distance.length, `${col.key}.distance`).toBeGreaterThan(0);
      expect(col.cells.directGoal.label.length, `${col.key}.directGoal`).toBeGreaterThan(0);
      expect(col.cells.notes.length, `${col.key}.notes`).toBeGreaterThan(0);
    }
  });

  it('"특이" 행에 투터치를 반복하지 않는다(전 재개 공통 규칙은 표 위 산문에서만 말한다)', () => {
    for (const col of RESTART_COLUMNS) {
      expect(col.cells.notes, col.key).not.toMatch(/투터치|두 번째로/);
    }
  });
});

describe('MISCONDUCT_CARDS', () => {
  it('경고 7종 + 퇴장 8종 = 15개다', () => {
    expect(MISCONDUCT_CARDS.filter((c) => c.kind === 'caution')).toHaveLength(7);
    expect(MISCONDUCT_CARDS.filter((c) => c.kind === 'sendingOff')).toHaveLength(8);
  });
});
