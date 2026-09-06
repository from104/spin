// 개체 표시 순서(z-order) — **다섯 렌더 경로가 같은 순서를 그린다**(2026-09-06,
// `docs/PLAN-Z-ORDER.md` 결정 12).
//
// 왜 경로별로 한 벌씩 재는가: 이 저장소에서 "요소를 새로 만든 사람이 경로 하나를 안 들렀다"
// 사고가 네 번 났고(render/renderPaths.ts 머리말), 순서는 그 다섯째가 되기 딱 좋은 축이다 —
// 판에서 도형을 맨 앞으로 올려 놓고 인쇄하면 종이에서만 도형이 칩 뒤로 숨는 식이다. 그래서
// 파일 하나에서 경로마다 **한 단언씩**만 재고, 판(ObjectLayer)의 세부 규칙은
// `ObjectLayer.test.tsx` 가 따로 진다(`strokeRender.paths.test.tsx` 와 같은 꼴).
//
// 고른 배치는 **도형이 맨 위**다. 그 자리가 2026-09-06 이전에는 표현 자체가 불가능했기
// 때문이다(도형은 개체 층 밖에 깔려 있어 칩·메모 위로 올라갈 수 없었다).
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { PlaybackProvider } from '../store/playback/PlaybackProvider.tsx';
import { createDrill } from '../model/defaults.ts';
import { sceneOrder } from '../model/zOrder.ts';
import { staticFrameOf } from '../model/playback.ts';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { PresentStage } from '../features/present/PresentStage.tsx';
import { CourtThumbnail } from './CourtThumbnail.tsx';
import { buildStepThumb } from '../model/thumb.ts';
import type { Drill, DrillStep } from '../model/drill.ts';
import type { NoteId } from '../core/ids.ts';
import type { Shape } from '../model/shape.ts';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const NOTE = 'nt_1' as NoteId;
const SHAPE = 'sh_1' as Shape['id'];

/** 메모 → 휠체어 → 도형(맨 위). 기본층이라면 정반대(도형이 맨 아래, 메모가 맨 위)다 —
 *  그래서 이 셋의 앞뒤만 봐도 `zOrder` 가 실제로 읽혔는지 갈린다. */
function fixture(): { drill: Drill; step: DrillStep; chairId: string } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const chair = base.cast.chairs[0]!;
  const step: DrillStep = {
    ...base.steps[0]!,
    chairs: { [chair.id]: { x: 300, y: 250, angleDeg: 0 } },
    balls: {},
    cones: {},
    arrows: [],
    notes: [{ id: NOTE, x: 300, y: 250, text: '여기' }],
    shapes: [{ id: SHAPE, kind: 'rect', x: 300, y: 250, w: 120, h: 80, rot: 0 }],
    zOrder: [NOTE, chair.id, SHAPE],
  };
  return { drill: { ...base, steps: [step] }, step, chairId: chair.id };
}

/** DOM 에 나타난 차례대로 id 를 뽑는다. 개체는 `id="obj-…"`, 도형은 `data-shape-id`,
 *  인쇄의 칩·메모는 `data-print-*` 라 표식이 갈린다 — 셋을 한 번에 훑는다. */
function domIds(root: HTMLElement): string[] {
  const sel = '[id^="obj-"], [data-shape-id], [data-print-chair], [data-print-note]';
  return Array.from(root.querySelectorAll(sel)).map(
    (el) => el.getAttribute('data-shape-id') ?? el.getAttribute('data-print-chair') ?? el.getAttribute('data-print-note') ?? el.id.replace(/^obj-/, ''),
  );
}

/** **상대 순서**만 본다. 시연은 이 스텝에 없는 캐스트 개체까지 전부 마운트한 채로 두므로
 *  (숨기는 것은 opacityWriter 다) 전체 목록을 통째로 비교하면 그 사정에 걸린다. */
function expectBelow(ids: string[], lower: string, upper: string): void {
  const at = (id: string): number => {
    const i = ids.indexOf(id);
    expect(i, `${id} 가 그려지지 않았다`).toBeGreaterThanOrEqual(0);
    return i;
  };
  expect(at(lower), `${lower} 가 ${upper} 보다 아래여야 한다`).toBeLessThan(at(upper));
}

describe('z-order — 다섯 경로가 스텝의 `zOrder` 를 그대로 그린다', () => {
  it('인쇄(PrintCourt): 종이가 판과 같은 순서다', () => {
    // 지우면 새는 버그: 판에서 도형을 맨 앞으로 올려 놓고 인쇄하면 종이에서만 도형이 칩 뒤로
    // 숨는다. 코치가 손에 든 종이를 못 믿게 되는 자리다.
    const { drill, step, chairId } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" view={{ showGrid: false, showGridLabels: false, showRuleZones: false }} />);
    const ids = domIds(container);
    expectBelow(ids, NOTE, chairId);
    expectBelow(ids, chairId, SHAPE);
  });

  it('PNG(buildStaticSvg): 구운 그림이 판과 같은 순서다', () => {
    // 지우면 새는 버그: 내보낸 그림만 다른 판이 된다(2026-08-2x 의 "PNG 에 도형이 안 실렸다"
    // 와 같은 종류의 축 누락 — 그때는 요소 자체가, 여기서는 순서가 빠진다).
    const { drill, step, chairId } = fixture();
    const svg = buildStaticSvg(staticFrameOf(drill, step), { mode: 'full', teams: drill.teams, shapes: step.shapes }, sceneOrder(step, drill.cast));
    const ids = Array.from(svg.matchAll(/id="obj-([^"]+)"/g)).map((m) => m[1]!);
    expectBelow(ids, NOTE, chairId);
    expectBelow(ids, chairId, SHAPE);
  });

  it('시연(PresentStage): 관객 화면이 판과 같은 순서다', () => {
    // 지우면 새는 버그: 코치가 판에서 본 그림과 팀에게 보여 주는 그림이 갈린다.
    const { drill, chairId } = fixture();
    const { container } = rtlRender(
      <SettingsProvider>
        <PlaybackProvider>
          <PresentStage drill={drill} showRuleZones={false} reduceMotion />
        </PlaybackProvider>
      </SettingsProvider>,
    );
    // ⚠️ 메모만 뺀다 — 시연의 메모 칩(`PresentNoteMark`)은 판·인쇄와 달리 id·data 표식이
    //    없어 DOM 에서 집을 수가 없다. 휠체어 아래에 도형이 오는 **기본층의 정반대**를 재는
    //    것으로 "순서를 읽었다" 는 이미 갈린다.
    expectBelow(domIds(container), chairId, SHAPE);
  });

  it('썸네일(CourtThumbnail): 목록 카드가 판과 같은 순서다', () => {
    // 지우면 새는 버그: 순서를 바꾼 스텝의 카드에서만 도형이 칩 밑으로 숨는다 — 요약(`thumb.z`)이
    // 순서를 안 싣거나 카드가 그 순열을 안 읽으면 다른 네 경로가 전부 초록인 채 카드만 옛 그림이다.
    // 요약은 id 를 안 담으므로 여기서는 표식이 아니라 **요소 종류**로 앞뒤를 본다(픽스처의 원은
    // 휠체어 하나뿐 — 공이 없다).
    const { drill } = fixture();
    const { container } = render(<CourtThumbnail mode="full" thumb={buildStepThumb(drill, 0)} />);
    const els = Array.from(container.querySelectorAll('[data-shape-id], circle'));
    const chairAt = els.findIndex((el) => el.tagName === 'circle');
    const shapeAt = els.findIndex((el) => el.hasAttribute('data-shape-id'));
    expect(chairAt, '휠체어가 카드에 없다').toBeGreaterThanOrEqual(0);
    expect(shapeAt, '도형(맨 위)이 휠체어보다 뒤에 그려져야 한다').toBeGreaterThan(chairAt);
  });
});
