// §4.4 P2-1 배선 — 컨트롤러의 판정(`{ pan: true }`)이 실제로 **판을 미는 세션**이 되는가.
//
// 판정 자체(경기면 안/밖)는 features/editor/framePan.test.tsx 가 잰다. 여기서 재는 것은
// 그 판정을 받은 CourtStage 가 (1) 고무줄 대신 이동을 열고, (2) 물리 틱(rAF)을 열지 않고,
// (3) pointerup 을 컨트롤러에 짝 맞춰 돌려주는가 — 셋이다. 판정과 배선을 한 파일에서 재면
// 둘 중 하나가 죽어도 다른 하나가 대신 통과한다.
import { describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { createTransformWriter } from './transformWriter.ts';
import { CourtStage, type CourtStageHandle, type CourtStagePointerController, type PointerDownResult } from './CourtStage.tsx';
import type { StageRot } from './useStageMetrics.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { CHAIR } from '../core/constants.ts';

/** 기본 rect 는 풀 코트 viewBox 와 같은 825×525 — client↔world 가 1:1 이라 좌표가 읽힌다. */
function stubSvgLayout(container: HTMLElement, rect: Partial<DOMRect> = {}): SVGSVGElement {
  const svg = container.querySelector('svg')!;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 825,
    height: 525,
    right: 825,
    bottom: 525,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
  if (!svg.setPointerCapture) svg.setPointerCapture = () => {};
  if (!svg.releasePointerCapture) svg.releasePointerCapture = () => {};
  return svg;
}

interface Spy extends CourtStagePointerController {
  moves: number;
  ups: Array<{ x: number; y: number } | null>;
  /** 다음 pointerdown 부터 돌려줄 판정. 세션마다 달라질 수 있어야 "낡은 세션이 남았는가" 를 잰다. */
  verdict: PointerDownResult | void;
}

/** `verdict` 가 곧 컨트롤러의 판정이다 — 이 파일은 판정의 **결과**만 본다. */
function makeController(verdict: PointerDownResult | void): Spy {
  const ups: Array<{ x: number; y: number } | null> = [];
  let moves = 0;
  return {
    ups,
    verdict,
    get moves() {
      return moves;
    },
    onPointerDown() {
      return this.verdict;
    },
    onPointerMove() {
      moves++;
    },
    onPointerUp(client) {
      ups.push(client);
    },
  };
}

/** `rot` 은 2026-08-14 §4.2 로 **prop** 이 됐다(옛 코드는 무대가 svg rect 를 재서 스스로 정했다).
 *  그래서 세로 판을 재려면 rect 스텁만이 아니라 이 값도 함께 넘겨야 한다 — 두 곳이 갈라지면
 *  좌표 변환과 그림이 어긋나므로, 그 어긋남이 테스트에서도 보이게 일부러 따로 받는다. */
function mount(controller: CourtStagePointerController, ref?: React.RefObject<CourtStageHandle | null>, rot: StageRot = 0) {
  return render(
    <CourtStage
      ref={ref}
      allowPan
      mode="full"
      rot={rot}
      variant="editor"
      writer={createTransformWriter()}
      controller={controller}
      showGrid={false}
      showGridLabels={false}
      showRuleZones={false}
      chairs={[]}
      balls={[]}
      cones={[]}
      notes={[]}
      arrows={[]}
      selection={new Set()}
      activeId={null}
    />,
    { wrapper: SettingsProvider },
  );
}

const viewOf = (svg: SVGSVGElement): number[] => svg.getAttribute('viewBox')!.split(' ').map(Number);

function pointer(svg: SVGSVGElement, type: string, x: number, y: number, pointerId = 1): void {
  svg.dispatchEvent(new window.PointerEvent(type, { pointerId, clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
}

/** 실제 rAF 한 프레임을 흘려 보낸다 — 물리 틱이 도는지/안 도는지를 재려면 필요하다. */
async function frame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
}

describe('컨트롤러가 pan 을 판정하면 끌기가 판을 민다', () => {
  it('오른쪽으로 끌면 창이 왼쪽으로 간다 — 손이 잡은 것은 판이다', () => {
    const { container } = mount(makeController({ pan: true }));
    const svg = stubSvgLayout(container);
    expect(viewOf(svg)[0]).toBe(0);

    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointermove', 120, 250));
    expect(viewOf(svg)[0]).toBeCloseTo(-20, 6);

    act(() => pointer(svg, 'pointermove', 130, 250));
    // 판을 미는 상한은 `CHAIR.hullRadiusPx` 만큼의 여백이다(useStageMetrics) — 실측으로
    // 32.5 → 27.8567766 이 됐다. 상수를 읽어 두면 다음 실측에서 또 안 깨진다.
    expect(viewOf(svg)[0]).toBeCloseTo(-CHAIR.hullRadiusPx, 6);
  });

  it('세로도 같이 민다 — 두 축이 각각 걸린다', () => {
    const { container } = mount(makeController({ pan: true }));
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 400, 250));
    act(() => pointer(svg, 'pointermove', 400, 270));
    const [x, y] = viewOf(svg);
    expect(y).toBeCloseTo(-20, 6);
    expect(x).toBe(0); // 안 민 축은 그대로다
  });

  it('고무줄 판정에서는 같은 끌기가 판을 밀지 않는다 (대조군)', () => {
    // 이 대조군이 없으면 "판이 밀렸다" 가 '아무 판정에서나 밀린다' 로도 통과한다.
    const { container } = mount(makeController({ edgePan: true }));
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointermove', 200, 250));
    expect(viewOf(svg)).toEqual([0, 0, 825, 525]);
  });
});

describe('판을 미는 세션은 물리 틱을 열지 않는다 (§6.1 규칙 1)', () => {
  it('pan 판정이면 rAF 가 돌아도 onPointerMove 가 한 번도 불리지 않는다', async () => {
    const c = makeController({ pan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointermove', 140, 250));
    await frame();
    expect(c.moves).toBe(0);
    act(() => pointer(svg, 'pointerup', 140, 250));
  });

  it('고무줄 판정이면 같은 프레임에서 onPointerMove 가 돈다 (대조군 — 스파이가 살아 있다)', async () => {
    // "0회 불렸다" 는 스파이가 아예 안 걸린 경우로도 통과한다. 같은 대기 길이로 반대쪽을 잰다.
    const c = makeController({ edgePan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointermove', 140, 250));
    await frame();
    expect(c.moves).toBeGreaterThan(0);
    act(() => pointer(svg, 'pointerup', 140, 250));
  });
});

describe('컨트롤러에 down 을 전달했으면 up 도 전달한다', () => {
  it('판을 실제로 민 뒤에는 좌표 없이(=탭이 아니다) 돌려준다', () => {
    const c = makeController({ pan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointermove', 140, 250));
    act(() => pointer(svg, 'pointerup', 140, 250));
    expect(c.ups).toEqual([null]);
  });

  it('제자리에서 톡 치면 좌표를 실어 돌려준다 — 빈 곳 탭과 같은 해제 경로다', () => {
    const c = makeController({ pan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointerup', 100, 250));
    expect(c.ups).toEqual([{ x: 100, y: 250 }]);
  });

  it('더블클릭 무장 이동은 컨트롤러를 통하지 않으므로 up 도 가지 않는다 (기존 계약)', () => {
    // 무장 이동은 pointerdown 자체를 컨트롤러에 넘기지 않는다 — 짝이 안 맞는 up 이 가면
    // 컨트롤러가 있지도 않은 세션을 정리한다.
    const c = makeController({ edgePan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250));
    act(() => pointer(svg, 'pointerup', 100, 250));
    c.ups.length = 0; // 첫 클릭의 up 은 정상 경로다 — 여기서부터가 더블클릭이다
    act(() => pointer(svg, 'pointerdown', 100, 250)); // 350ms 안 · 12px 안 = 더블클릭
    act(() => pointer(svg, 'pointermove', 120, 250));
    act(() => pointer(svg, 'pointerup', 120, 250));
    expect(c.ups).toEqual([]);
    expect(viewOf(svg)[0]).toBeCloseTo(-20, 6); // 더블클릭 팬은 그대로 남는다(P2-1 "남기는 것")
  });
});

describe('두 번째 손가락이 내려오면 이동 세션이 남지 않는다', () => {
  it('핀치로 끊긴 뒤 다음 끌기는 다시 고무줄이다', () => {
    // 세션이 남으면 활성 포인터만 사라진 채 이동이 살아 있어 **다음 드래그가 선택 대신
    // 이동이 된다**(손을 뗄 때 그것을 지울 주인이 없다).
    const c = makeController({ pan: true });
    const { container } = mount(c);
    const svg = stubSvgLayout(container);
    act(() => pointer(svg, 'pointerdown', 100, 250, 1));
    act(() => pointer(svg, 'pointerdown', 300, 250, 2)); // 핀치 전환
    act(() => pointer(svg, 'pointerup', 300, 250, 2));
    act(() => pointer(svg, 'pointerup', 100, 250, 1));

    // 새 세션의 판정은 **고무줄**이다 — 판이 밀리면 그것은 낡은 세션이 살아남았다는 뜻이다.
    c.verdict = { edgePan: true };
    const before = viewOf(svg);
    act(() => pointer(svg, 'pointerdown', 400, 250, 3));
    act(() => pointer(svg, 'pointermove', 440, 250, 3));
    expect(viewOf(svg)).toEqual(before);
    act(() => pointer(svg, 'pointerup', 440, 250, 3));

    // 대조군 — 같은 자리에서 판정을 이동으로 되돌리면 실제로 밀린다(무대가 죽은 게 아니다).
    c.verdict = { pan: true };
    act(() => pointer(svg, 'pointerdown', 400, 250, 4));
    act(() => pointer(svg, 'pointermove', 420, 250, 4));
    expect(viewOf(svg)[0]).toBeCloseTo(-20, 6);
    act(() => pointer(svg, 'pointerup', 420, 250, 4));
  });
});

describe('panByScreen — 키보드 팬(§4.4 P2-1)이 회전을 통과한다', () => {
  it('가로 화면: 오른쪽으로 밀면 창이 오른쪽으로 간다(창이 키 방향으로 간다)', () => {
    const ref = createRef<CourtStageHandle>();
    const { container } = mount(makeController(undefined), ref);
    const svg = stubSvgLayout(container);
    act(() => ref.current!.zoomBy(2)); // 배율 2 — 화면 64px = 월드 32px
    const before = viewOf(svg);
    act(() => ref.current!.panByScreen(64, 0));
    const after = viewOf(svg);
    expect(after[0]).toBeCloseTo(before[0]! + 32, 6);
    expect(after[1]).toBeCloseTo(before[1]!, 6);
  });

  it('세로 화면(rot 90): 같은 호출이 월드 −y 로 간다 — screenDeltaToWorld 를 지났다', () => {
    // 이 변환을 빠뜨리면 세로 태블릿에서 오른쪽 키가 판을 아래로 내려보낸다.
    const ref = createRef<CourtStageHandle>();
    // 세로 상자 + 위에서 내려온 rot 90(코트 긴 축을 화면 긴 축에 맞춘다). 예전에는 rect 만
    // 스텁하면 무대가 스스로 90 을 골랐다 — 그 자기결정이 §4.2 쌍안정의 원인이라 뒤집혔다.
    const { container } = mount(makeController(undefined), ref, 90);
    const svg = stubSvgLayout(container, { width: 525, height: 825, right: 525, bottom: 825 });
    act(() => ref.current!.zoomBy(2));
    expect(svg.getAttribute('viewBox')).toBe('0 0 262.5 412.5'); // 돌아간 상자다

    const g = svg.querySelector('g[transform]')!;
    const read = (): number[] => /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(g.getAttribute('transform')!)!.slice(1, 3).map(Number);
    const before = read();
    act(() => ref.current!.panByScreen(64, 0));
    const after = read();
    // translate 첫 인자 = view.y + view.h → view.y 가 32 만큼 줄었다(월드 −y).
    expect(after[0]).toBeCloseTo(before[0]! - 32, 6);
    // 둘째 인자 = −view.x → 가로는 한 톨도 안 움직였다.
    expect(after[1]).toBeCloseTo(before[1]!, 6);
  });

  it('판 끝에서는 더 가지 않는다 — panView 와 같은 범위 클램프를 쓴다', () => {
    const ref = createRef<CourtStageHandle>();
    const { container } = mount(makeController(undefined), ref);
    const svg = stubSvgLayout(container);
    act(() => ref.current!.panByScreen(99999, 0));
    const far = viewOf(svg)[0]!;
    act(() => ref.current!.panByScreen(99999, 0));
    expect(viewOf(svg)[0]).toBeCloseTo(far, 6);
    expect(Number.isFinite(far)).toBe(true);
  });
});
