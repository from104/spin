// §6.3 완료 판정 — **드릴 시트 = 스텝 n 페이지**. 60스텝까지 60장이다.
import { describe, expect, it } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { PrintDrillSheet } from './PrintDrillSheet.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// PrintDrillSheet 이 useT()/useLocale()(→ SettingsProvider)을 쓴다(C8) — 이 파일 전체를 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

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

  it('메타 줄은 난이도·유형·상황·시간이다 — 폐기된 훈련량은 종이에서도 사라졌다 (v8)', () => {
    const r = render(<PrintDrillSheet drill={{ ...drillOf(2), drillType: 'set-piece', situation: 'kick-in' }} />);
    expect(r.container.textContent).toContain('세트피스');
    expect(r.container.textContent).toContain('킥인');
    // 옛 문서의 훈련량은 마이그레이션이 description 으로 옮겼으니 여기 메타 줄에는 영영 없다.
    expect(r.container.textContent).not.toContain('인터벌');
    // 상황 미지정이면 그 칸 자체가 없다.
    const bare = render(<PrintDrillSheet drill={{ ...drillOf(2), drillType: 'technical' }} />);
    expect(bare.container.textContent).toContain('기술');
    expect(bare.container.textContent).not.toContain('킥인');
  });

  it('변형(Variation)은 목적과 함께 첫 장에만 실린다 (v8)', () => {
    const r = render(<PrintDrillSheet drill={{ ...drillOf(3), variation: '수비 하나를 더 세우면 어려워진다' }} />);
    const pages = Array.from(r.container.querySelectorAll('[data-print-page="step"]'));
    const withVariation = pages.filter((p) => p.textContent?.includes('수비 하나를 더 세우면'));
    expect(withVariation).toHaveLength(1);
    expect(withVariation[0]).toBe(pages[0]);
  });

  // §7 3.4 선수 실명(§0.5 미배송 빚, 2026-08-20) — 시연 범례와 같은 규칙(실명 적은 선수만),
  // 목적·코칭 포인트와 같은 이유로 첫 장에만.
  it('실명을 적은 선수가 있으면 첫 장에만 명단이 실린다', () => {
    const base = drillOf(3);
    const chairs = base.cast.chairs.map((c, i) => (i === 0 ? { ...c, name: '김민수' } : c));
    const drill: Drill = { ...base, cast: { ...base.cast, chairs } };
    const { container } = render(<PrintDrillSheet drill={drill} />);
    const pages = Array.from(container.querySelectorAll('[data-print-page="step"]'));
    const withRoster = pages.filter((p) => p.textContent?.includes('김민수'));
    expect(withRoster).toHaveLength(1);
    expect(withRoster[0]).toBe(pages[0]);
    expect(pages[0]!.textContent).toContain(`${base.cast.chairs[0]!.number}번 김민수`);
  });

  it('아무도 실명을 안 적었으면 명단 줄 자체가 없다', () => {
    const { container } = render(<PrintDrillSheet drill={drillOf(2)} />);
    expect(container.textContent).not.toContain('참가 선수');
  });
});
