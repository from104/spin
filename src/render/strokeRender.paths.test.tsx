// §3.5 자유 그리기 획이 **다섯 경로 전부**에 실리는가 (2026-09-03).
//
// 왜 한 파일에 다섯 화면을 모았나: `renderPaths.test.ts` 는 표와 소스에 **이름의 흔적**이
// 있는지만 본다(그 파일 머리말의 ⚠️ — 문자열 증거라 완벽하지 않다). 여기서는 다섯 경로를
// 실제로 렌더해 `<path>` 가 나오는지, 그리고 **굵기·색이 획에서 파생됐는지**를 본다.
// 경로마다 파일을 나누면 "네 곳은 고쳤는데 한 곳을 안 들렀다" 를 잡아 줄 자리가 다시
// 흩어진다 — 그 흩어짐이 renderPaths.ts 머리말의 사고 네 번을 만든 원인이다.
//
// ⚠️ **값을 베끼지 않는다.** 굵기 첨자 2(=5.2)를 골라 쓴 것은 그래서다: 기본 굵기(3.4)로
//    재면 `strokeWidthOf` 를 안 부르고 화살표 상수를 그대로 쓴 구현도 통과한다.
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ARROW_COLORS } from '../core/colors.ts';
import { ARROW_STYLE } from '../model/arrow.ts';
import type { ArrowId, NoteId, StrokeId } from '../core/ids.ts';
import type { Drill, DrillStep } from '../model/drill.ts';
import { createDrill } from '../model/defaults.ts';
import type { ThumbSpec } from '../model/thumb.ts';
import { STROKE_WIDTHS, strokeCenter, strokeHandlePoints, strokePath, type Stroke } from '../model/stroke.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { ObjectLayer } from './ObjectLayer.tsx';
import { StrokeHandles } from './StrokeHandles.tsx';
import { CourtThumbnail, THUMB_GLYPH } from './CourtThumbnail.tsx';
import { STROKE_CASING_PAD, arrowMarkerId } from './arrowHeadGeom.ts';
import { PresentStrokeLayer } from '../features/present/PresentObjects.tsx';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { MARKER_UID, buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { TEAMS, makeFrame } from '../features/export/sceneFixture.ts';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

const STROKE_ID = 'fh_1' as StrokeId;
/** 굵은 획(첨자 2) · 팔레트 두 번째 색 · 끝 촉 'wide'. 셋 다 **기본값이 아닌** 값이라,
 *  파생을 건너뛴 구현은 어느 것 하나로도 걸린다. */
const WIDE: Stroke = {
  id: STROKE_ID,
  points: [
    { x: 100, y: 100 },
    { x: 160, y: 140 },
    { x: 220, y: 110 },
    { x: 280, y: 180 },
  ],
  color: ARROW_COLORS[1],
  width: 2,
  headTo: 'wide',
};
const W = STROKE_WIDTHS[2];

/** 다섯 경로에 공통인 질문 — "그 획의 색선이 있고, 굵기·모양이 획에서 나왔는가". */
function expectStrokeDrawn(paths: readonly SVGPathElement[], scale = 1): void {
  const body = paths.find((p) => p.getAttribute('stroke') === ARROW_COLORS[1]);
  expect(body, `색 ${ARROW_COLORS[1]} 인 획의 본선이 없다`).toBeTruthy();
  expect(Number(body!.getAttribute('stroke-width'))).toBeCloseTo(W * scale, 3);
  // 케이싱 — 본선과 **같은 d**, 굵기만 상수만큼 두껍다.
  const casing = paths.find((p) => p.getAttribute('d') === body!.getAttribute('d') && p.getAttribute('stroke') !== ARROW_COLORS[1] && p.hasAttribute('stroke-width'));
  expect(casing, '케이싱(검정 밑선)이 없다').toBeTruthy();
  expect(Number(casing!.getAttribute('stroke-width'))).toBeGreaterThan(W * scale);
}

describe('획 렌더 — 다섯 경로가 전부 그린다', () => {
  it('편집(ObjectLayer): 획이 화살표 **바로 위 순서가 아니라 아래**에 나오고 굵기가 파생된다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ObjectLayer
          writer={writer}
          chairs={[]}
          balls={[]}
          cones={[]}
          notes={[]}
          arrows={[{ id: 'ar_1' as ArrowId, from: { x: 0, y: 0 }, ctrl: { x: 5, y: 5 }, to: { x: 10, y: 10 } }]}
          strokes={[WIDE]}
          markerUid="uid"
          selection={new Set()}
          activeId={null}
        />
      </svg>,
    );
    const g = container.querySelector(`#obj-${STROKE_ID}`);
    expect(g).toBeTruthy();
    expectStrokeDrawn(Array.from(g!.querySelectorAll('path')));
    // z-order — 획 그룹이 화살표 그룹보다 **앞**에 온다(SVG 는 뒤에 그린 것이 위다).
    const ids = Array.from(container.querySelectorAll('[id^="obj-"]')).map((e) => e.id);
    expect(ids.indexOf(`obj-${STROKE_ID}`)).toBeLessThan(ids.indexOf('obj-ar_1'));
  });

  it('편집: 획 본체의 `d` 를 모델의 `strokePath` 가 만든다 — 곡선을 렌더러가 다시 짜지 않는다', () => {
    const writer = createTransformWriter();
    const { container } = render(
      <svg>
        <ObjectLayer writer={writer} chairs={[]} balls={[]} cones={[]} notes={[]} arrows={[]} strokes={[WIDE]} markerUid="uid" selection={new Set()} activeId={null} />
      </svg>,
    );
    const d = container.querySelector(`#obj-${STROKE_ID} path`)!.getAttribute('d')!;
    expect(d).toBe(strokePath(WIDE));
    // 네 점짜리 획은 3차 베지에다 — 직선(L)로 이으면 판에서만 각진 획이 된다.
    expect(d).toContain('C');
  });

  it('시연(PresentStrokeLayer): 프레임의 획을 그리고 opacity 를 그대로 싣는다', () => {
    const { container } = render(
      <svg>
        <PresentStrokeLayer strokes={[{ ...WIDE, opacity: 0.4 }]} markerUid="uid" />
      </svg>,
    );
    const g = container.querySelector(`#obj-${STROKE_ID}`);
    expect(g).toBeTruthy();
    expectStrokeDrawn(Array.from(g!.querySelectorAll('path')));
    expect(g!.parentElement!.getAttribute('opacity')).toBe('0.4');
  });

  it('PNG(buildStaticSvg): 획을 굽고, 켠 화살촉이 **실제로 있는 마커**를 가리킨다', () => {
    const svg = buildStaticSvg(makeFrame({ strokes: [{ ...WIDE, opacity: 1 }] }), { mode: 'full', teams: TEAMS });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror'), 'SVG 가 XML 로 파싱되지 않는다').toBeNull();
    const g = doc.querySelector(`#obj-${STROKE_ID}`);
    expect(g).toBeTruthy();
    expectStrokeDrawn(Array.from(g!.querySelectorAll('path')) as SVGPathElement[]);
    // 마커 참조가 허공을 가리키면 화살촉은 **소리 없이** 사라진다 — 그 실종을 여기서 잡는다.
    const ref = Array.from(g!.querySelectorAll('path'))
      .map((p) => p.getAttribute('marker-end'))
      .find((v): v is string => typeof v === 'string');
    expect(ref, '끝 촉을 켠 획인데 marker-end 가 없다').toBeTruthy();
    const id = ref!.slice('url(#'.length, -1);
    expect(doc.querySelector(`marker[id="${id}"]`), `마커 ${id} 가 정의돼 있지 않다`).toBeTruthy();
    // id 는 **굵기까지** 담아야 한다 — 안 담으면 굵은 획이 기본 굵기용 촉을 참조해, 촉의
    // 검은 테가 굵기 배율을 타고 1.5배로 그려진다(그것이 굵기 축을 만든 이유다).
    expect(id).toBe(arrowMarkerId(MARKER_UID, ARROW_COLORS[1], 'wide', W));
    expect(id).not.toBe(arrowMarkerId(MARKER_UID, ARROW_COLORS[1], 'wide', ARROW_STYLE.width));
  });

  it('인쇄(PrintCourt): 종이에도 획이 실린다', () => {
    const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
    const step: DrillStep = {
      ...base.steps[0]!,
      chairs: {},
      balls: {},
      cones: {},
      arrows: [],
      notes: [{ id: 'nt_1' as NoteId, x: 500, y: 400, text: '메모' }],
      strokes: [WIDE],
    };
    const drill: Drill = { ...base };
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" view={{ showGrid: false, showGridLabels: false, showRuleZones: false }} />);
    const g = container.querySelector(`[data-print-stroke="${STROKE_ID}"]`);
    expect(g).toBeTruthy();
    expectStrokeDrawn(Array.from(g!.querySelectorAll('path')));
  });

  it('썸네일(CourtThumbnail): 요약의 첨자를 굵기·색으로 펼친다', () => {
    const thumb: ThumbSpec = {
      mode: 'full',
      chairs: [],
      balls: [],
      cones: [],
      arrows: [],
      // 요약이 담는 것은 평탄한 좌표 열 + **첨자**다(model/thumb.ts).
      strokes: [{ p: [100, 100, 160, 140, 220, 110, 280, 180], c: 1, w: 2 }],
    };
    const { container } = render(<CourtThumbnail mode="full" thumb={thumb} />);
    expectStrokeDrawn(Array.from(container.querySelectorAll('path')), THUMB_GLYPH.strokeScale);
  });
});

describe('굵기가 파생되지 않으면 걸린다 — 위 단언이 무엇을 잡는지', () => {
  it('가는 획(첨자 0)과 굵은 획(첨자 2)의 선 굵기가 실제로 다르다', () => {
    const writer = createTransformWriter();
    const thin: Stroke = { ...WIDE, id: 'fh_2' as StrokeId, width: 0 };
    const { container } = render(
      <svg>
        <ObjectLayer writer={writer} chairs={[]} balls={[]} cones={[]} notes={[]} arrows={[]} strokes={[WIDE, thin]} markerUid="uid" selection={new Set()} activeId={null} />
      </svg>,
    );
    const widthOf = (id: string): number =>
      Number(
        Array.from(container.querySelectorAll(`#obj-${id} path`))
          .find((p) => p.getAttribute('stroke') === ARROW_COLORS[1])!
          .getAttribute('stroke-width'),
      );
    expect(widthOf(STROKE_ID)).toBeCloseTo(STROKE_WIDTHS[2], 3);
    expect(widthOf('fh_2')).toBeCloseTo(STROKE_WIDTHS[0], 3);
    expect(widthOf(STROKE_ID)).toBeGreaterThan(widthOf('fh_2'));
  });

  it('케이싱 여유는 굵기와 **무관한 상수**다 — 촉의 검은 테와 두께가 어긋나지 않게', () => {
    const writer = createTransformWriter();
    const thin: Stroke = { ...WIDE, id: 'fh_2' as StrokeId, width: 0 };
    const { container } = render(
      <svg>
        <ObjectLayer writer={writer} chairs={[]} balls={[]} cones={[]} notes={[]} arrows={[]} strokes={[WIDE, thin]} markerUid="uid" selection={new Set()} activeId={null} />
      </svg>,
    );
    const padOf = (id: string, w: number): number => {
      const paths = Array.from(container.querySelectorAll(`#obj-${id} path`));
      const casing = paths.find((p) => p.hasAttribute('stroke-width') && Number(p.getAttribute('stroke-width')) > w && p.getAttribute('stroke') !== 'var(--accent)')!;
      return Number(casing.getAttribute('stroke-width')) - w;
    };
    expect(padOf(STROKE_ID, STROKE_WIDTHS[2])).toBeCloseTo(STROKE_CASING_PAD, 3);
    expect(padOf('fh_2', STROKE_WIDTHS[0])).toBeCloseTo(STROKE_CASING_PAD, 3);
  });
});

describe('획 손잡이 — 보이는 자리와 잡히는 자리가 같다', () => {
  // 이것은 **에이전트 둘의 경계에 걸친 계약**이다: 앵커를 그리는 것은 이 파일 쪽
  // (`StrokeHandles`)이고 누른 것을 가려내는 것은 `physics/hitTest.ts` 인데, 둘이 같은
  // `strokeHandlePoints` 를 봐야 손이 닿는 자리와 눈에 보이는 자리가 겹친다. 한쪽만 다른
  // 식으로 자리를 재면 앵커는 보이는데 안 잡히고, 그 고장은 실기에서만 드러난다.
  it('세 앵커가 모두 strokeHandlePoints 의 좌표에 앉는다', () => {
    const { container } = render(
      <svg>
        <StrokeHandles stroke={WIDE} pxPerUnit={1} />
      </svg>,
    );
    const h = strokeHandlePoints(WIDE);
    const at = (p: { x: number; y: number }): string => `translate(${p.x} ${p.y})`;
    const transforms = Array.from(container.querySelectorAll('g[transform]')).map((e) => e.getAttribute('transform'));
    expect(transforms).toEqual([at(h.from), at(h.to), at(h.rotate)]);
    // 회전 앵커는 **끝점이 아니다** — 끝 접선 방향으로 떨어져 앉는다(그래야 획과 안 겹친다).
    expect(at(h.rotate)).not.toBe(at(h.to));
  });

  it('회전 가이드 실은 **축**(경계상자 중심)에서 나온다 — 앵커가 무엇을 축으로 도는지 말한다', () => {
    const { container } = render(
      <svg>
        <StrokeHandles stroke={WIDE} pxPerUnit={1} />
      </svg>,
    );
    const line = container.querySelector('line')!;
    const axis = strokeCenter(WIDE);
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(axis.x, 6);
    expect(Number(line.getAttribute('y1'))).toBeCloseTo(axis.y, 6);
    // 축은 끝점과 다른 자리다 — 실을 끝점에서 뽑으면 이 단언이 우연히 통과할 수 없다.
    expect(axis.x).not.toBeCloseTo(strokeHandlePoints(WIDE).to.x, 6);
  });
});
