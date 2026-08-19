// §6.4 — **코트를 그리는 화면이 몇 개인가.**
//
// 5차 검증에서 "미디어쿼리 축을 촘촘히 열거하고도 *코트를 그리는 화면이 몇 개인가* 를 묻지 않아
// 시연 화면만 강제색에서 팀 구분을 잃은" 사고가 있었다(2233 전건 초록인 채로). 같은 함정이
// 코트 크기 3단에도 그대로 있다 — 편집 판만 고치면 시연·인쇄·PNG·썸네일은 조용히 30×18 로
// 남는다. 그래서 이 파일은 **화면을 목록으로 열거하고 그 목록 전부를 3크기 × 3모드로 찌른다.**
//
// 세는 규칙(애매하면 게이트가 무의미하다):
//  · '화면' = 코트 라인을 그리는 진입점. 지금 다섯이다 —
//      ① 편집 판   CourtStage        (판 위에서 만지는 그것)
//      ② 시연      PresentStage      (전체화면 읽기 전용)
//      ③ 인쇄      PrintCourt        (종이 · PDF)
//      ④ PNG       buildStaticSvg    (카톡·밴드로 보내는 그림)
//      ⑤ 썸네일    CourtThumbnail    (목록 카드 · 스텝 칩)
//  · 새 진입점이 생기면 **이 배열에 행을 더한다.** 더하지 않으면 이 게이트는 그 화면을 모른다.
//  · full 만 크기 3단을 따라간다. half·flat 은 따라가지 않으며(court.ts 근거 셋) 그것도 여기서
//    **대조군으로 단언**한다 — "안 따라간다" 를 안 적으면 누가 따라가게 만들어도 아무도 모른다.
import { describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import { CourtStage } from '../render/CourtStage.tsx';
import { CourtThumbnail } from '../render/CourtThumbnail.tsx';
import { PresentStage } from '../features/present/PresentStage.tsx';
import { PrintCourt } from '../features/print/PrintCourt.tsx';
import { buildStaticSvg } from '../features/export/buildStaticSvg.ts';
import { staticSceneMetrics } from '../features/export/staticSceneLayout.ts';
import { makeFrame, TEAMS } from '../features/export/sceneFixture.ts';
import { PlaybackProvider } from '../store/playback/PlaybackProvider.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { createTransformWriter } from '../render/transformWriter.ts';
import { createDrill } from '../model/defaults.ts';
import { courtDefFor, COURT_MODES, COURT_SIZES, type CourtMode, type CourtSize } from '../model/court.ts';

afterEach(cleanup);

const noopController = { onPointerDown() {}, onPointerMove() {}, onPointerUp() {} };

/** 한 화면이 만들어 낸 SVG 루트. 다섯 화면이 전부 SVG 하나를 뿌리로 갖는다. */
type Screen = { name: string; svg(mode: CourtMode, size: CourtSize | undefined): SVGSVGElement };

function fromMarkup(markup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  expect(doc.querySelector('parsererror'), 'SVG 가 XML 로 파싱되지 않는다').toBeNull();
  return doc.documentElement as unknown as SVGSVGElement;
}

const SCREENS: Screen[] = [
  {
    name: '① 편집 판 CourtStage',
    svg(mode, size) {
      const { container } = render(
        <CourtStage
          rot={0}
          mode={mode}
          size={size}
          variant="editor"
          writer={createTransformWriter()}
          controller={noopController}
          showGrid
          showGridLabels={false}
          showRuleZones
          chairs={[]}
          balls={[]}
          cones={[]}
          notes={[]}
          arrows={[]}
          selection={new Set()}
          activeId={null}
        />,
      );
      return container.querySelector('svg')!;
    },
  },
  {
    name: '② 시연 PresentStage',
    svg(mode, size) {
      const drill = { ...createDrill({ courtMode: mode, courtSize: size }), courtSize: size };
      const { container } = render(
        <SettingsProvider>
          <PlaybackProvider>
            <PresentStage drill={drill} showRuleZones reduceMotion />
          </PlaybackProvider>
        </SettingsProvider>,
      );
      return container.querySelector('svg')!;
    },
  },
  {
    name: '③ 인쇄 PrintCourt',
    svg(mode, size) {
      const base = createDrill({ courtMode: mode, courtSize: size });
      const { container } = render(<PrintCourt drill={{ ...base, courtSize: size }} step={base.steps[0]!} ariaLabel="코트" />);
      return container.querySelector('svg')!;
    },
  },
  {
    name: '④ PNG buildStaticSvg',
    svg(mode, size) {
      return fromMarkup(buildStaticSvg(makeFrame({ chairs: [], balls: [], cones: [], arrows: [], notes: [] }), { mode, size, teams: TEAMS }));
    },
  },
  {
    name: '⑤ 썸네일 CourtThumbnail',
    svg(mode, size) {
      const { container } = render(<CourtThumbnail mode={mode} size={size} />, { wrapper: SettingsProvider });
      return container.querySelector('svg')!;
    },
  },
];

/** 오른쪽 골 지역 선의 `d`. FullCourtLines.tsx 와 buildStaticSvg.ts 의 **같은 식**을 여기 한 번
 *  더 적는 것이 아니라, 두 곳이 같은 식을 쓴다는 사실 자체를 이 테스트가 이용한다 — 식이 갈라지면
 *  다섯 화면 중 갈라진 쪽에서 이 단언이 먼저 빨개진다. */
function rightGoalAreaD(size: CourtSize): string {
  const def = courtDefFor('full', size);
  const S = def.surface;
  const gz = def.ruleZones[1]!;
  return `M${S.x + S.w},${gz.y} L${gz.x},${gz.y} L${gz.x},${gz.y + gz.h} L${S.x + S.w},${gz.y + gz.h}`;
}

/** 그 SVG 안 모든 rect 의 (width,height) 쌍. 코트 외곽선·배경이 여기 들어 있다. */
function rectBoxes(svg: SVGSVGElement): string[] {
  return [...svg.querySelectorAll('rect')].map((r) => `${r.getAttribute('width')}×${r.getAttribute('height')}`);
}

describe('§6.4 코트를 그리는 화면 5개 × 코트 3크기', () => {
  it('대조군: 세 크기의 viewBox·경기면 상자가 애초에 서로 다르다 (같으면 아래가 전부 헛것이다)', () => {
    const vb = COURT_SIZES.map((s) => `${courtDefFor('full', s).vbW}×${courtDefFor('full', s).vbH}`);
    const sf = COURT_SIZES.map((s) => `${courtDefFor('full', s).surface.w}×${courtDefFor('full', s).surface.h}`);
    expect(new Set(vb).size).toBe(3);
    expect(new Set(sf).size).toBe(3);
    // 여섯 상자가 서로 겹치지 않는다 — 아래 '남의 코트 상자가 없다' 단언이 성립하는 근거다.
    expect(new Set([...vb, ...sf]).size).toBe(6);
  });

  it('대조군: 화면 목록이 비어 있지 않고 다섯이다', () => {
    expect(SCREENS).toHaveLength(5);
  });

  describe.each(SCREENS)('$name', (screen) => {
    it.each(COURT_SIZES)('full %s — viewBox 가 그 크기다', (size) => {
      const def = courtDefFor('full', size);
      expect(screen.svg('full', size).getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
    });

    it.each(COURT_SIZES)('full %s — 경기면 외곽선이 그 크기다 (라인이 viewBox 를 안 따라오는 것을 잡는다)', (size) => {
      const svg = screen.svg('full', size);
      const boxes = rectBoxes(svg);
      const def = courtDefFor('full', size);
      const want = `${def.surface.w}×${def.surface.h}`;
      // ④ PNG 는 코트 라인을 path 로 굽지 않고 rect 로 굽는다. ①②③⑤ 도 마찬가지다.
      expect(boxes, `${want} 인 경기면 사각형이 없다`).toContain(want);
      // **남의 코트 상자는 하나도 없다.**
      for (const other of COURT_SIZES) {
        if (other === size) continue;
        const o = courtDefFor('full', other);
        expect(boxes, `${other} 의 경기면 상자가 남아 있다`).not.toContain(`${o.surface.w}×${o.surface.h}`);
        expect(boxes, `${other} 의 viewBox 상자가 남아 있다`).not.toContain(`${o.vbW}×${o.vbH}`);
      }
    });

    it.each(COURT_SIZES)('full %s — 오른쪽 골 지역 선이 그 크기의 자리에 그려진다', (size) => {
      // 골 지역 path 는 **다섯 화면이 전부 같은 식으로** 만든다(FullCourtLines / courtLinesMarkup).
      // 그래서 문자열 전체를 통째로 대조할 수 있다 — 부분 문자열 충돌이 없는 정확한 비교다.
      const paths = [...screen.svg('full', size).querySelectorAll('path')].map((p) => p.getAttribute('d'));
      expect(paths, '경로가 하나도 없다 — 대조군이 성립하지 않는다').not.toHaveLength(0);
      expect(paths, `${size} 의 오른쪽 골 지역 선이 없다`).toContain(rightGoalAreaD(size));
      for (const other of COURT_SIZES) {
        if (other === size) continue;
        expect(paths, `${other} 의 골 지역 선이 ${size} 판에 남아 있다`).not.toContain(rightGoalAreaD(other));
      }
    });

    it('size 를 생략하면 30×18 이다 — 크기를 모르는 옛 호출부가 그대로 돈다', () => {
      const def = courtDefFor('full', '30x18');
      expect(screen.svg('full', undefined).getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
    });

    it.each(['half', 'flat'] as const)('대조군: %s 는 크기 3단을 따라가지 않는다 (세 크기가 같은 판)', (mode) => {
      const seen = COURT_SIZES.map((s) => screen.svg(mode, s).getAttribute('viewBox'));
      expect(new Set(seen).size).toBe(1);
      expect(seen[0]).toBe(`0 0 ${courtDefFor(mode).vbW} ${courtDefFor(mode).vbH}`);
    });
  });

  it('대조군: 세 크기의 골 지역 선이 애초에 서로 다른 문자열이다', () => {
    expect(new Set(COURT_SIZES.map(rightGoalAreaD)).size).toBe(3);
  });

  it('세 코트 모드 전부가 화면 목록을 지난다 (모드 축을 빠뜨리지 않았다)', () => {
    expect([...COURT_MODES]).toEqual(['full', 'half', 'flat']);
  });
});

describe('§6.4 PNG 출력 픽셀도 코트 크기를 따라간다', () => {
  it.each(COURT_SIZES)('full %s — width/height 가 그 코트의 비율이다', (size) => {
    const def = courtDefFor('full', size);
    const m = staticSceneMetrics({ mode: 'full', size, teams: TEAMS });
    expect(m.vbW).toBe(def.vbW);
    expect(m.vbH).toBe(def.vbH);
    // 긴 변이 목표 픽셀에 정확히 닿는다 — 크기가 안 따라오면 짧은 변이 남거나 잘린다.
    expect(Math.max(m.widthPx, m.heightPx)).toBe(2048);
    // 정수 픽셀로 반올림하므로 비율은 소수 둘째 자리까지만 같다(2048 px 에서 오차 1 px 미만).
    expect(m.widthPx / m.heightPx).toBeCloseTo(def.vbW / (def.vbH + m.captionH), 2);
  });

  it('세 크기의 출력 픽셀 조합이 서로 다르다 (같으면 위 단언이 헛것이다)', () => {
    const seen = COURT_SIZES.map((s) => {
      const m = staticSceneMetrics({ mode: 'full', size: s, teams: TEAMS });
      return `${m.widthPx}×${m.heightPx}`;
    });
    expect(new Set(seen).size).toBe(3);
  });
});
