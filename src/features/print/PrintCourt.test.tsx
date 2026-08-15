// §6.3 인쇄용 코트 그림 — 정적 SVG. writer 가 없으므로 **좌표가 마크업에 그대로** 있어야
// 한다(있어야 할 자리에 없으면 전 개체가 원점에 겹쳐 찍힌다 — PrintCourt.tsx 머리말 ①).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDrill } from '../../model/defaults.ts';
import { COURT_DEFS } from '../../model/court.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { ArrowId, NoteId } from '../../core/ids.ts';
import { PrintCourt } from './PrintCourt.tsx';

function fixture(): { drill: Drill; step: DrillStep } {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const c0 = base.cast.chairs[0]!;
  const c1 = base.cast.chairs[1]!;
  const b0 = base.cast.balls[0]!;
  const cast = { ...base.cast, cones: [{ id: 'co_1' as never, colorIndex: 0 as const }, { id: 'co_2' as never, colorIndex: 1 as const }] };
  const step: DrillStep = {
    ...base.steps[0]!,
    // 8대 중 **2대만** 놓는다 — 나머지는 그려지면 안 된다.
    chairs: { [c0.id]: { x: 120, y: 200, angleDeg: 30 }, [c1.id]: { x: 400, y: 100, angleDeg: -90 } },
    balls: { [b0.id]: { x: 300, y: 250 } },
    cones: { ['co_1' as never]: { x: 50, y: 50 } },
    arrows: [{ id: 'ar_1' as ArrowId, from: { x: 10, y: 10 }, ctrl: { x: 20, y: 20 }, to: { x: 30, y: 30 } }],
    notes: [{ id: 'nt_1' as NoteId, x: 500, y: 400, text: '여기서 압박' }],
  };
  return { drill: { ...base, cast }, step };
}

describe('PrintCourt — 이 스텝에 놓인 것만, 놓인 자리에 그린다', () => {
  it('휠체어는 pose 가 있는 것만 그린다 (대조군: cast 8대 중 2대)', () => {
    const { drill, step } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" />);
    expect(drill.cast.chairs).toHaveLength(8);
    expect(container.querySelectorAll('[data-print-chair]')).toHaveLength(2);
  });

  it('좌표와 각도가 transform 에 그대로 실린다 — writer 가 없는 트리다', () => {
    const { drill, step } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" />);
    const g = container.querySelector(`[data-print-chair="${drill.cast.chairs[0]!.id}"]`)!;
    expect(g.getAttribute('transform')).toBe('translate(120 200) rotate(30)');
  });

  it('등번호는 역회전 그룹 안에 있다 — 판이 돌아도 번호는 바로 선다 (§3.4)', () => {
    const { drill, step } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" />);
    const g = container.querySelector(`[data-print-chair="${drill.cast.chairs[1]!.id}"]`)!;
    // 차체는 -90°, 번호 그룹은 +90° — 곱이 0 이라야 글자가 바로 선다.
    expect(g.getAttribute('transform')).toContain('rotate(-90)');
    expect(g.querySelector('text')!.parentElement!.getAttribute('transform')).toBe('rotate(90)');
    expect(g.textContent).toBe(drill.cast.chairs[1]!.number);
  });

  it('공·콘·화살표·메모도 놓인 것만 그린다', () => {
    const { drill, step } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" />);
    expect(container.querySelectorAll('[data-print-ball]')).toHaveLength(1);
    // 콘은 cast 2개 중 스텝에 놓인 1개만.
    expect(drill.cast.cones).toHaveLength(2);
    expect(container.querySelectorAll('[data-print-cone]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-print-arrow]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-print-note]')).toHaveLength(1);
    expect(container.textContent).toContain('여기서 압박');
  });

  it('대조군: 빈 스텝이면 개체가 하나도 없다 — "무엇을 넣어도 그린다" 를 막는다', () => {
    const { drill, step } = fixture();
    const blank: DrillStep = { ...step, chairs: {}, balls: {}, cones: {}, arrows: [], notes: [] };
    const { container } = render(<PrintCourt drill={drill} step={blank} ariaLabel="코트" />);
    expect(container.querySelectorAll('[data-print-chair],[data-print-ball],[data-print-cone],[data-print-arrow],[data-print-note]')).toHaveLength(0);
    // 그래도 코트 자체는 그려진다(그림이 통째로 빈 것이 아니다).
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

// ── 5.2 · 5.3: 종이도 같은 코트를 그린다 ────────────────────────────────────────────────────
// PrintCourt 는 `CourtSurface` 를 그대로 쓰므로 규격 변경이 **저절로** 따라온다. 그래도 여기서
// 한 번 실제로 재는 이유는, "저절로 되겠지" 가 화면과 인쇄물이 다른 코트를 그리게 두는 그 가정이기
// 때문이다(내보내기 쪽은 마크업이 손으로 옮겨져 있어 courtLines.contract.test.ts 가 따로 지킨다).
describe('인쇄 코트도 FIPFA 규격을 따른다 (5.2 인크로치먼트 · 5.3 센터 마크)', () => {
  it('인크로치먼트 마크 4개와 센터 마크가 종이에도 실리고, 센터 서클은 없다', () => {
    const { drill, step } = fixture();
    const { container } = render(<PrintCourt drill={drill} step={step} ariaLabel="코트" />);
    const def = COURT_DEFS[drill.courtMode];
    const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    expect(def.encroachMarks).toHaveLength(4); // 대조군: 0개라서 통과하는 길을 막는다
    for (const d of def.encroachMarks) expect(ds).toContain(d);
    expect(ds).toContain(def.centerMark);
    // §9 결정 ⑧ — 규정에 없는 3 m 원은 종이에도 없다.
    expect(container.querySelector('circle[r="75"]')).toBeNull();
    expect(container.querySelector('circle[fill="#ffffff"]')).toBeNull();
    // 대조군: 원 자체는 그려진다(골대 4개 + 공 1개) — 부재 단언이 헛것이 아니다.
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(5);
  });

  // ⚠️ 이 테스트의 제목은 2026-08-12 까지 "…센터 마크가 **없다**" 였고, 마지막 줄은
  //    `expect(COURT_DEFS.half.centerMark).toBeNull()` 이었다. **2026-08-13 기현님 실기
  //    지시로 하프에도 센터 마크가 생겼다** — 지우지 않고 뒤집어 승격시킨다.
  //    종이는 코치가 실제로 들고 나가는 물건이다. 화면에만 X 가 뜨고 종이에 없으면
  //    "판과 종이가 다른 코트" 가 되고, 그것이 이 저장소가 겪은 사고의 형태다.
  it('하프 코트 인쇄물은 마크가 2개이고 **센터 마크가 하프라인 자리에 실린다** — 코트 모드를 실제로 탄다', () => {
    const base = createDrill({ courtMode: 'half', formation: '1-2-1' });
    const { container } = render(<PrintCourt drill={base} step={base.steps[0]!} ariaLabel="코트" />);
    const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    for (const d of COURT_DEFS.half.encroachMarks) expect(ds).toContain(d);
    for (const d of COURT_DEFS.full.encroachMarks) expect(ds).not.toContain(d); // 풀 좌표가 아니다
    expect(ds).not.toContain(COURT_DEFS.full.centerMark); // 풀 코트의 X 를 베낀 것이 아니다
    expect(COURT_DEFS.half.centerMark).not.toBeNull();
    expect(ds).toContain(COURT_DEFS.half.centerMark);
    // 굵기는 present 표(X2.4)다 — 좌표만 맞고 굵기 0 이면 종이에 아무것도 안 남는다.
    expect(container.querySelector(`path[d="${COURT_DEFS.half.centerMark}"]`)).toHaveAttribute('stroke-width', '2.4');
  });

  it('플랫 코트 인쇄물에는 여전히 센터 마크가 없다 — 과잉 수정 대조군', () => {
    // 하프를 뒤집을 때 flat 까지 같이 뒤집는 것이 가장 쉬운 과잉 수정이다(선이 하나도 없는 판).
    const base = createDrill({ courtMode: 'flat', formation: '1-2-1' });
    const { container } = render(<PrintCourt drill={base} step={base.steps[0]!} ariaLabel="코트" />);
    const ds = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
    expect(COURT_DEFS.flat.centerMark).toBeNull();
    expect(ds).not.toContain(COURT_DEFS.half.centerMark);
    expect(ds).not.toContain(COURT_DEFS.full.centerMark);
  });
});

describe('한 문서에 60장이 동시에 있다 — 전역 id 를 쓰면 2장부터 깨진다', () => {
  it('SVG 마다 화살표 마커 id 가 다르다 (§6.6)', () => {
    const { drill, step } = fixture();
    const { container } = render(
      <>
        <PrintCourt drill={drill} step={step} ariaLabel="1" />
        <PrintCourt drill={drill} step={step} ariaLabel="2" />
      </>,
    );
    const markers = Array.from(container.querySelectorAll('marker')).map((m) => m.id);
    expect(markers.length).toBeGreaterThan(1);
    expect(new Set(markers).size).toBe(markers.length);

    // 그리고 각 화살표는 **자기 SVG 의** 마커를 가리켜야 한다.
    const svgs = Array.from(container.querySelectorAll('svg'));
    for (const svg of svgs) {
      // 2026-08-16 — 기본 선은 끝점에만 화살촉이 있고, id 에 종류('-thin')가 붙는다.
      const url = svg.querySelector('[data-print-arrow] path[marker-end]')!.getAttribute('marker-end')!;
      const id = url.slice('url(#'.length, -1);
      expect(svg.querySelector(`marker#${CSS.escape(id)}`), `${id} 가 이 SVG 안에 없다`).not.toBeNull();
    }
  });
});
