// 주제별 콘텐츠 모델(2026-08-22 재설계) 불변식 — docs/PLAN-RULES-REDESIGN.md §6.
// 주제 구성 자체의 정본은 2026-08-31 부터 docs/PLAN-RULES-9CARDS.md 다(8주제 → 9카드).
import { describe, expect, it } from 'vitest';
import { ruleTopicsFor, RULE_TOPIC_KEYS, misconductCardsFor } from './ruleTopics.ts';
import { RESTART_COLUMNS, RESTART_ROW_LABELS } from './restartTable.ts';
import { RULE_SCENE_IDS } from './ruleScenes.ts';
import { RULE_FIGURE_IDS } from './figures/ids.ts';

const TOPICS = ruleTopicsFor('ko');

describe('ruleTopicsFor', () => {
  it('주제는 정확히 9개이고 key 가 유일하다', () => {
    // 8 → 9: 앞에 intro·purpose 를 세우고 contested 를 restarts 로 흡수했다(9CARDS §1.1).
    expect(TOPICS).toHaveLength(9);
    // 유일성 단언에는 하드넘버를 쓰지 않는다 — 개수는 위 한 줄이 이미 못박는다.
    expect(new Set(TOPICS.map((t) => t.key)).size).toBe(TOPICS.length);
    expect(TOPICS.map((t) => t.key)).toEqual(RULE_TOPIC_KEYS);
  });

  it('첫 카드는 intro 다', () => {
    // 순서 단언을 여기 하나 못박아 둔다 — 다른 테스트들이 제목 리터럴 대신 `TOPICS[i].title`
    // 자기참조로 바뀌면서(개편 때마다 깨지지 않게) **순서를 뒤집어도 전부 통과하게** 됐다.
    // 입구 카드(intro)를 맨 앞에 세우는 것이 이번 9카드 개편의 핵심 결정이라(9CARDS §1.1),
    // 그 결정만은 자기참조가 아닌 하드코딩으로 지킨다.
    expect(RULE_TOPIC_KEYS[0]).toBe('intro');
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

  it('튜토리얼 앵커 rules-card·rules-appendix 가 각각 정확히 한 주제에만 붙는다', () => {
    // RULES_TUTORIAL_STEPS 3단계 중 2·3단계가 이 앵커를 `document.querySelector` 로 찾는다
    // (tutorialSteps.ts). 앵커가 0개면 그 단계가 조용히 대상을 못 찾고, 2개 이상이면 어느
    // 카드를 가리킬지가 카드 배열 순서에 좌우된다 — 어느 쪽도 CI 가 못 잡던 침묵이었다.
    // 앵커는 카드에 붙는 데이터(RuleTopic.tutorialAnchor)이므로 여기서 지킨다.
    const anchored = (anchor: string) => TOPICS.filter((t) => t.tutorialAnchor === anchor).map((t) => t.key);
    expect(anchored('rules-card')).toEqual(['basics']);
    expect(anchored('rules-appendix')).toEqual(['rulebook']);
  });

  it('scene-slot 은 intro·purpose 에만 있고 각각 1개다', () => {
    // scene-slot 은 "기현님이 만들 장면이 들어올 자리"를 지키는 빈 블록이다(9CARDS §5).
    // 자리가 없으면 카드 1·2 는 산문만 남고, 장면이 도착해도 어디에 넣을지가 다시 논쟁이 된다.
    // 반대로 아무 카드에나 늘어나면 "미완성 자리"가 화면 곳곳에 흩어지므로 두 카드로 못박는다.
    for (const topic of TOPICS) {
      const count = topic.blocks.filter((b) => b.kind === 'scene-slot').length;
      expect(count, topic.key).toBe(topic.key === 'intro' || topic.key === 'purpose' ? 1 : 0);
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

describe('misconductCardsFor', () => {
  it('경고 7종 + 퇴장 8종 = 15개다', () => {
    // 개수는 **조문 개수**이지 번역 사정이 아니다 — 로케일이 늘어도 7·8 이어야 한다.
    for (const locale of ['ko', 'en'] as const) {
      expect(misconductCardsFor(locale).filter((c) => c.kind === 'caution'), locale).toHaveLength(7);
      expect(misconductCardsFor(locale).filter((c) => c.kind === 'sendingOff'), locale).toHaveLength(8);
    }
  });
});
