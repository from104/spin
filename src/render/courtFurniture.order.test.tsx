// **판의 부속이 네 경로에서 같은 순서로 쌓이는가** (2026-09-06 기현 지시로 생겼다).
//
// > *"드릴 편집 화면, 시연 화면과 png, 인쇄 화면에 객체·코트 요소(격자 및 번호, 골에어리어
// >  강조, 골대 등) 등이 동일하게 나오는지 철저하게 점검. … 골대 밑판 위에 코트 라인이 보임"*
//
// 그 신고의 실체는 **층 순서**였다: 편집 화면은 골대를 개체 층(ObjectLayer)에서 그려 격자·
// 규칙 존·깃발·규칙 표시보다 위에 두는데, 나머지 셋은 골대를 코트 라인 그룹 안에서 그려
// 그 넷보다 아래에 두고 있었다. 그래서 규칙 존의 흰 파선이 받침판 위를 가로질렀다.
//
// ⚠️ **`renderPaths.ts` 는 이 축을 못 잡는다.** 그 표는 *"그 화면이 그것을 그리는가"* 만 말하고
//    (머리말이 스스로 그렇게 적어 두었다), 실제로 그 어긋남이 났을 때 네 칸은 전부 초록이었다.
//    그래서 순서는 여기서 잰다.
//
// ── 어떻게 재는가 ─────────────────────────────────────────────────────────────────────
// **기준은 편집 화면이다**(이번 지시의 정본). 편집 화면을 실제로 렌더해 부속 넷이 나타나는
// 순서를 읽고, 시연·인쇄·PNG 가 **그 순서와 같은지**만 본다 — 기대값을 이 파일에 숫자나
// 목록으로 적지 않는다. 손으로 적으면 그것이 다섯 번째 사본이 되고, 편집 화면을 고친 날
// 이 파일만 옛 순서를 지키게 된다(AGENTS §3 *"두 벌 두지 않는다"*).
//
// 부속을 알아보는 표식은 **색·속성**이다(class 는 PNG 에 없다 — 자립 SVG 규약). 넷을 고른
// 이유: 격자·규칙 존·깃발·골대가 신고에 등장한 것들이고, 넷 다 사용자가 순서를 뒤집을 수
// 없는 **판의 부속**이다(개체 7종은 `model/zOrder.ts` 가 스텝마다 정하므로 이 축이 아니다).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GOAL_BASE_FILL } from '../core/colors.ts';
import { CURRENT_DRILL_SCHEMA, type Drill, type TeamSide } from '../model/drill.ts';
import type { BallId, ChairId, DrillId, StepId } from '../core/ids.ts';
import { courtDefFor, goalBaseDir } from '../model/court.ts';
import { staticFrameOf } from '../model/playback.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { PresentStage } from '../features/present/PresentStage.tsx';
import { CourtStage } from './CourtStage.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { createRuleOverlay } from './ruleOverlay.ts';
import { RING_CASING_W, RULE_ZONE_FILL } from './ruleOverlay.ts';
import { FLAG_STROKE } from './sideFlags.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PlaybackProvider } from '../store/playback/PlaybackProvider.tsx';

const TEAMS: Record<TeamSide, { label: string; color: string; gkColor: string }> = {
  home: { label: '레드', color: '#d93a3a', gkColor: '#f2c811' },
  away: { label: '블루', color: '#1f6bb8', gkColor: '#22a95b' },
};

const DRILL: Drill = {
  schemaVersion: CURRENT_DRILL_SCHEMA,
  id: 'dr_o' as DrillId,
  title: '층 순서 시험',
  drillType: 'tactical',
  level: '초급',
  durationMin: 5,
  tags: [],
  courtMode: 'full',
  defense: 'home',
  formation: '1-2-1',
  teams: TEAMS,
  cast: {
    chairs: [{ id: 'ch_a' as ChairId, team: 'home', number: '1', isGk: false }],
    balls: [{ id: 'bl_1' as BallId }],
    cones: [],
  },
  steps: [
    {
      id: 'st_1' as StepId,
      name: '스텝 1',
      note: '',
      chairs: { ch_a: { x: 400, y: 260, angleDeg: 0 } },
      balls: { bl_1: { x: 400, y: 260 } },
      // 공의 3 m 링 — 규칙 **표시** 층의 표식이 되라고 켠다(없으면 그 층이 아예 안 그려져
      // "골대가 규칙 표시보다 위인가" 를 잴 수 없다).
      ballRings: { bl_1: '3m' },
      cones: {},
      arrows: [],
      notes: [],
      shapes: [],
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

/** 부속을 알아보는 네 표식. 값은 전부 **그리는 쪽의 상수**에서 온다 — 여기 색을 손으로
 *  적으면 색을 바꾼 날 이 검사가 조용히 아무것도 안 세게 된다. */
const MARKS = [
  { id: 'grid', attr: 'shape-rendering', value: 'crispEdges' },
  { id: 'ruleZones', attr: 'fill', value: RULE_ZONE_FILL },
  { id: 'sideFlags', attr: 'stroke', value: FLAG_STROKE },
  // 규칙 표시(공 거리 링)의 검정 케이싱 굵기 — 링 층을 알아보는 표식이다.
  { id: 'ruleMarks', attr: 'stroke-width', value: String(RING_CASING_W) },
  { id: 'goalPosts', attr: 'fill', value: GOAL_BASE_FILL },
] as const;

/** DOM 문서 순서에서 각 표식이 **처음** 나타나는 자리. 못 찾으면 그 경로가 그 부속을 안 그린
 *  것이므로 곧바로 실패시킨다(순서만 재고 존재를 안 재면 "다 없어서 통과" 가 된다). */
function orderInDom(root: Element, label: string): string[] {
  const all = [...root.querySelectorAll('*')];
  return MARKS.map((m) => {
    const i = all.findIndex((el) => el.getAttribute(m.attr) === m.value);
    expect(i, `${label} 에 ${m.id}(${m.attr}=${m.value})가 없다`).toBeGreaterThanOrEqual(0);
    return { id: m.id, i };
  })
    .sort((a, b) => a.i - b.i)
    .map((x) => x.id);
}

/** 자립 SVG 문자열에서 같은 것을 잰다 — 순서는 곧 문자열 안 위치다. */
function orderInMarkup(svg: string, label: string): string[] {
  return MARKS.map((m) => {
    const i = svg.indexOf(`${m.attr}="${m.value}"`);
    expect(i, `${label} 에 ${m.id}(${m.attr}=${m.value})가 없다`).toBeGreaterThanOrEqual(0);
    return { id: m.id, i };
  })
    .sort((a, b) => a.i - b.i)
    .map((x) => x.id);
}

function renderEditorSvg(): Element {
  const def = courtDefFor('full');
  const { container } = render(
    <SettingsProvider>
      <CourtStage
        rot={0}
        mode="full"
        variant="editor"
        writer={createTransformWriter()}
        controller={{ onPointerDown() {}, onPointerMove() {}, onPointerUp() {} }}
        showGrid
        showGridLabels
        showRuleZones
        chairs={[]}
        balls={['bl_1' as BallId]}
        cones={[]}
        notes={[]}
        arrows={[]}
        goals={def.goalPosts.map((_p, i) => `goal_${i}`)}
        goalBaseDirs={def.goalPosts.map((_p, i) => goalBaseDir(def, i))}
        ruleOverlay={{
          rules: createRuleOverlay({ say() {} }),
          roster: [],
          ballRings: { bl_1: '3m' },
          teams: { home: { label: '레드' }, away: { label: '블루' } },
          teamStyles: TEAMS,
          defense: 'home',
        }}
        selection={new Set()}
        activeId={null}
      />
    </SettingsProvider>,
  );
  return container.querySelector('svg')!;
}

const editorOrder = (): string[] => orderInDom(renderEditorSvg(), '편집 화면');

describe('판의 부속 — 정적 세 경로가 편집 화면과 같은 순서로 쌓는다', () => {
  it('시연(PresentStage)', () => {
    const expected = editorOrder();
    const { container } = render(
      <SettingsProvider>
        <PlaybackProvider>
          <PresentStage drill={DRILL} showRuleZones showGrid showGridLabels reduceMotion />
        </PlaybackProvider>
      </SettingsProvider>,
    );
    expect(orderInDom(container.querySelector('svg')!, '시연')).toEqual(expected);
  });

  it('인쇄(PrintCourt)', () => {
    const expected = editorOrder();
    const { container } = render(
      <SettingsProvider>
        <PrintCourt drill={DRILL} step={DRILL.steps[0]!} ariaLabel="코트" view={{ showGrid: true, showGridLabels: true, showRuleZones: true }} />
      </SettingsProvider>,
    );
    expect(orderInDom(container.querySelector('svg')!, '인쇄')).toEqual(expected);
  });

  it('PNG(buildStaticSvg)', () => {
    const expected = editorOrder();
    const svg = buildStaticSvg(staticFrameOf(DRILL, DRILL.steps[0]!), {
      mode: 'full',
      teams: TEAMS,
      defense: 'home',
      showGrid: true,
      showGridLabels: true,
      showRuleZones: true,
    });
    expect(orderInMarkup(svg, 'PNG')).toEqual(expected);
  });

  it('규칙 존은 경로마다 **한 벌씩만** 그려진다 (2026-09-06: 종이에만 두 겹이었다)', () => {
    // 인쇄가 `<RuleZones>` 와 `ruleMarkup` 양쪽에서 같은 사각형을 구워, 종이에서만 면이
    // 두 겹(fill-opacity .22 × 2 ≈ .39)이었다 — 화면보다 확연히 진하다. 개수의 기준도
    // **편집 화면에서 가져온다**: 코트 종류마다 존이 1개(하프)·2개(풀)라 손으로 적을 값이 아니다.
    const zoneRects = (root: Element): number => [...root.querySelectorAll(`rect[fill="${RULE_ZONE_FILL}"]`)].length;
    const expected = zoneRects(renderEditorSvg());
    expect(expected).toBeGreaterThan(0); // 대조군 — 0 을 0 과 비교한 것이 아니다

    const present = render(
      <SettingsProvider>
        <PlaybackProvider>
          <PresentStage drill={DRILL} showRuleZones showGrid showGridLabels reduceMotion />
        </PlaybackProvider>
      </SettingsProvider>,
    );
    expect(zoneRects(present.container.querySelector('svg')!), '시연').toBe(expected);

    const print = render(
      <SettingsProvider>
        <PrintCourt drill={DRILL} step={DRILL.steps[0]!} ariaLabel="코트" view={{ showGrid: true, showGridLabels: true, showRuleZones: true }} />
      </SettingsProvider>,
    );
    expect(zoneRects(print.container.querySelector('svg')!), '인쇄').toBe(expected);

    const png = buildStaticSvg(staticFrameOf(DRILL, DRILL.steps[0]!), {
      mode: 'full',
      teams: TEAMS,
      defense: 'home',
      showGrid: true,
      showRuleZones: true,
    });
    expect(png.split(`fill="${RULE_ZONE_FILL}"`).length - 1, 'PNG').toBe(expected);
  });

  it('대조군 — 이 자가 실제로 순서를 잰다(골대를 코트 라인 쪽으로 되돌리면 빨개진다)', () => {
    // 편집 화면의 순서가 "격자·존·깃발이 먼저, 골대가 마지막" 이라는 것을 한 번 못박는다.
    // 이 줄이 없으면 네 경로가 **다 같이 옛 순서로 되돌아가도** 위 세 검사가 초록이다.
    const order = editorOrder();
    expect(order[order.length - 1]).toBe('goalPosts');
    expect(order.indexOf('ruleZones')).toBeLessThan(order.indexOf('goalPosts'));
    expect(order.indexOf('ruleMarks')).toBeLessThan(order.indexOf('goalPosts'));
  });
});
