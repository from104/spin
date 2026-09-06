// **무시된(ignored) 휠체어의 흐림이 네 경로에 다 오는가** (2026-09-06 경로 대조).
//
// 편집 화면만 32% 로 흐리게 그리고 있었다. 같은 스텝을 시연·PNG·인쇄로 내면 **물리 월드에서
// 빠진 유령 선수가 멀쩡한 선수로** 보였다 — 무시는 도구 상태가 아니라 그 스텝의 사실이다
// (`model/drill.ts` 가 `locked`·`cut` 과 같은 부류로 못박는다. 판단의 기록은
// `render/renderPaths.ts` 의 `ignoredDim`·`lockTint` 행).
//
// ⚠️ 값(0.32)을 이 파일에 적지 않는다. **편집 화면을 실제로 렌더해** 그 불투명도를 읽고,
//    나머지 셋이 같은 값을 냈는지만 본다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CURRENT_DRILL_SCHEMA, type Drill, type TeamSide } from '../model/drill.ts';
import type { BallId, ChairId, DrillId, StepId } from '../core/ids.ts';
import { staticFrameOf } from '../model/playback.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { PresentStage } from '../features/present/PresentStage.tsx';
import { CourtStage } from './CourtStage.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PlaybackProvider } from '../store/playback/PlaybackProvider.tsx';

const TEAMS: Record<TeamSide, { label: string; color: string; gkColor: string }> = {
  home: { label: '레드', color: '#d93a3a', gkColor: '#f2c811' },
  away: { label: '블루', color: '#1f6bb8', gkColor: '#22a95b' },
};

const GHOST = 'ch_a' as ChairId;
const LIVE = 'ch_b' as ChairId;

/** 한 대는 무시, 한 대는 평범 — 대조군이 같은 판 안에 있다. */
const DRILL: Drill = {
  schemaVersion: CURRENT_DRILL_SCHEMA,
  id: 'dr_i' as DrillId,
  title: '무시 표시 시험',
  drillType: 'tactical',
  level: '초급',
  durationMin: 5,
  tags: [],
  courtMode: 'full',
  defense: 'home',
  formation: '1-2-1',
  teams: TEAMS,
  cast: {
    chairs: [
      { id: GHOST, team: 'home', number: '1', isGk: false },
      { id: LIVE, team: 'home', number: '2', isGk: false },
    ],
    balls: [{ id: 'bl_1' as BallId }],
    cones: [],
  },
  steps: [
    {
      id: 'st_1' as StepId,
      name: '스텝 1',
      note: '',
      chairs: { [GHOST]: { x: 300, y: 260, angleDeg: 0 }, [LIVE]: { x: 500, y: 260, angleDeg: 0 } },
      balls: { bl_1: { x: 400, y: 260 } },
      cones: {},
      arrows: [],
      notes: [],
      shapes: [],
      ignored: [GHOST],
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

/** 편집 화면이 무시된 칩에 실제로 거는 불투명도. */
function editorOpacity(): number {
  const { container } = render(
    <SettingsProvider>
      <CourtStage
        rot={0}
        mode="full"
        variant="editor"
        writer={createTransformWriter()}
        controller={{ onPointerDown() {}, onPointerMove() {}, onPointerUp() {} }}
        showGrid={false}
        showGridLabels={false}
        showRuleZones={false}
        chairs={DRILL.cast.chairs.map((c) => ({ id: c.id, color: TEAMS[c.team].color, team: c.team, number: c.number, ariaLabel: c.number }))}
        balls={[]}
        cones={[]}
        notes={[]}
        arrows={[]}
        ignored={new Set([GHOST as string])}
        selection={new Set()}
        activeId={null}
      />
    </SettingsProvider>,
  );
  // 무시 껍데기는 칩을 감싼 `<g style="opacity: …">` 하나다(ObjectLayer 의 ghostProps).
  const dimmed = [...container.querySelectorAll('g[style]')].map((g) => (g as SVGElement).style.opacity).filter((o) => o !== '' && o !== '1');
  expect(dimmed, '편집 화면이 무시된 칩을 흐리게 그리지 않았다').toHaveLength(1);
  return Number(dimmed[0]);
}

describe('무시된 휠체어 — 시연·PNG·인쇄가 편집 화면과 같은 농도로 흐리다', () => {
  it('PNG', () => {
    const expected = editorOpacity();
    const svg = buildStaticSvg(staticFrameOf(DRILL, DRILL.steps[0]!), { mode: 'full', teams: TEAMS, defense: 'home' });
    // 개체 `<g id="obj-…">` 의 opacity 속성. 무시된 칩 하나만 1 보다 작아야 한다.
    const ghost = svg.match(new RegExp(`<g id="obj-${GHOST}"[^>]*opacity="([\\d.]+)"`));
    expect(ghost, 'PNG 의 무시된 칩에 opacity 가 없다').not.toBeNull();
    expect(Number(ghost![1])).toBeCloseTo(expected, 6);
    // 대조군 — 무시 안 한 칩은 opacity 속성 자체가 없다(attrOpacity 는 1 이면 안 붙인다).
    expect(svg).toMatch(new RegExp(`<g id="obj-${LIVE}" transform="[^"]+">`));
  });

  it('인쇄', () => {
    const expected = editorOpacity();
    const { container } = render(
      <SettingsProvider>
        <PrintCourt drill={DRILL} step={DRILL.steps[0]!} ariaLabel="코트" view={{ showGrid: false, showGridLabels: false, showRuleZones: false }} />
      </SettingsProvider>,
    );
    expect(Number(container.querySelector(`[data-print-chair="${GHOST}"]`)!.getAttribute('opacity'))).toBeCloseTo(expected, 6);
    // 대조군 — 무시 안 한 칩은 opacity 속성 자체가 없다(PNG 의 attrOpacity 와 같은 규약).
    expect(container.querySelector(`[data-print-chair="${LIVE}"]`)!.getAttribute('opacity')).toBeNull();
  });

  it('시연', () => {
    const expected = editorOpacity();
    const { container } = render(
      <SettingsProvider>
        <PlaybackProvider>
          <PresentStage drill={DRILL} showRuleZones={false} reduceMotion />
        </PlaybackProvider>
      </SettingsProvider>,
    );
    // 시연은 `opacityWriter` 가 칩을 감싼 `<g>` 의 style.opacity 에 프레임 값을 쓴다.
    const dimmed = [...container.querySelectorAll('g[style]')].map((g) => (g as SVGElement).style.opacity).filter((o) => o !== '' && o !== '1');
    expect(dimmed).toHaveLength(1);
    expect(Number(dimmed[0])).toBeCloseTo(expected, 6);
  });
});
