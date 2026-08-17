// §6.3 완료 판정 — **드릴 시트 = 스텝 n 페이지**. 60스텝까지 60장이다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { PrintDrillSheet } from './PrintDrillSheet.tsx';

const POSE = { x: 100, y: 100, angleDeg: 0 };

/** 스텝 n 개짜리 드릴. `chairsAt` 은 "그 스텝에 서 있는 cast 인덱스" 다. */
function drillOf(n: number, chairsAt: (i: number) => number[] = () => [0]): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const step0 = base.steps[0]!;
  const steps: DrillStep[] = Array.from({ length: n }, (_, i) => ({
    ...step0,
    id: `${step0.id}_${i}` as DrillStep['id'],
    name: `스텝이름${i}`,
    note: `코칭메모${i}`,
    chairs: Object.fromEntries(chairsAt(i).map((k) => [base.cast.chairs[k]!.id, POSE])) as DrillStep['chairs'],
    balls: {},
    cones: {},
    arrows: [],
    notes: [],
  }));
  return { ...base, title: '전환 드릴', steps };
}

describe('페이지 수 = 스텝 수', () => {
  it('6스텝 드릴은 6장이다', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(6)} />);
    const pages = container.querySelectorAll('[data-print-page="step"]');
    // 하한 단언 — "0장이라서 통과" 를 막는다.
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toHaveLength(6);
  });

  it('1스텝 드릴은 1장이다 — 스텝 수에 실제로 반응하는가(상수 6 이 아닌가)', () => {
    expect(render(<PrintDrillSheet drill={drillOf(1)} />).container.querySelectorAll('[data-print-page]')).toHaveLength(1);
  });

  it('장 순서가 스텝 순서다', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(4)} />);
    const idx = Array.from(container.querySelectorAll('[data-print-page="step"]')).map((el) => el.getAttribute('data-step-index'));
    expect(idx).toEqual(['0', '1', '2', '3']);
  });

  it('장마다 n/N 과 그 스텝의 메모가 실린다 — 종이가 흩어져도 순서를 되찾는다', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(3)} />);
    const pages = Array.from(container.querySelectorAll('[data-print-page="step"]'));
    expect(pages[1]!.textContent).toContain('스텝 2/3');
    expect(pages[1]!.textContent).toContain('코칭메모1');
    // 대조군: 2장에 3장의 메모가 실리면 안 된다.
    expect(pages[1]!.textContent).not.toContain('코칭메모2');
  });

  // 검증 결함 수정(2026-08-17): step.name 은 과제⑦ 이후 로드 경로에서 항상 '' 다. 이
  // 컴포넌트가 혹시라도 name 을 다시 참조하게 되면(회귀) 여기서 잡는다 — fixture 는 일부러
  // name 을 채워서 넘기지만(실제 앱에서는 절대 벌어지지 않는 입력), 화면 어디에도 그 값이
  // 나타나면 안 된다는 음의 대조군이다.
  it('name 필드가 채워져 와도 화면 어디에도 찍히지 않는다(죽은 필드, §스텝 카드)', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(3)} />);
    const pages = Array.from(container.querySelectorAll('[data-print-page="step"]'));
    for (const page of pages) {
      expect(page.textContent).not.toContain('스텝이름');
    }
  });

  it('장마다 코트 그림이 하나씩 있다', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(3)} />);
    for (const page of container.querySelectorAll('[data-print-page="step"]')) {
      expect(page.querySelectorAll('svg')).toHaveLength(1);
    }
  });
});

describe('준비물은 판 전체에서 파생된다 (A-1)', () => {
  it('★ 마지막 스텝에만 나오는 선수도 머리글의 준비물에 든다', () => {
    // 이 드릴은 1~3스텝에 1명, 4스텝에 2명이 선다. 준비물이 "선수 1명" 이면
    // 코치는 사람 한 명을 덜 부른 채 훈련장에 간다.
    const drill = drillOf(4, (i) => (i === 3 ? [0, 5] : [0]));
    const { container } = render(<PrintDrillSheet drill={drill} />);
    expect(container.textContent).toContain('선수 2명');
    expect(container.textContent).not.toContain('선수 1명');
  });

  it('대조군: cast 8대를 그냥 세지 않는다', () => {
    const drill = drillOf(3, () => [0, 1]);
    expect(drill.cast.chairs).toHaveLength(8);
    const { container } = render(<PrintDrillSheet drill={drill} />);
    expect(container.textContent).toContain('선수 2명');
    expect(container.textContent).not.toContain('선수 8명');
  });
});

describe('드릴 전체 정보는 첫 장에만', () => {
  it('목적·코칭 포인트가 30장에 30번 반복되지 않는다', () => {
    const base = drillOf(5);
    const drill: Drill = { ...base, objective: '전환 속도를 올린다', coachingPoints: ['첫 패스를 빠르게'] };
    const { container } = render(<PrintDrillSheet drill={drill} />);
    const pages = Array.from(container.querySelectorAll('[data-print-page="step"]'));
    const withObjective = pages.filter((p) => p.textContent?.includes('전환 속도를 올린다'));
    expect(withObjective).toHaveLength(1);
    expect(withObjective[0]).toBe(pages[0]);
    expect(pages[0]!.textContent).toContain('첫 패스를 빠르게');
  });

  it('훈련량은 0(미지정)이면 아예 안 적는다 — 정하지 않은 "1회 × 1세트" 를 사실인 양 찍지 않는다', () => {
    const zero = render(<PrintDrillSheet drill={{ ...drillOf(2), reps: 0, sets: 0, intervalSec: 0 }} />);
    expect(zero.container.textContent).not.toContain('세트');
    const set = render(<PrintDrillSheet drill={{ ...drillOf(2), reps: 3, sets: 2, intervalSec: 30 }} />);
    expect(set.container.textContent).toContain('3회 × 2세트');
    expect(set.container.textContent).toContain('인터벌 30초');
  });
});
