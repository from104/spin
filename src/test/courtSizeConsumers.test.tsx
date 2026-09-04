// §6.4 — **코트 정의 소비처들이 실제로 코트 크기를 따라가는가.**
//
// 5차 검증관의 rg 실측이 이 항목의 출발점이었다: `courtDefFor` 의 프로덕션 소비처가 model/ 안
// 4개 파일뿐이고, 렌더·물리·편집기는 전부 `COURT_DEFS[mode]` 를 직접 읽었다. 그래서 `courtSize`
// 는 저장·마이그레이션·검증·백업까지 왕복하면서 **화면에 한 픽셀도 나타나지 않는 죽은 값**이었다.
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../store/toast/ToastProvider.tsx';
import { DrillCard } from '../features/library/DrillCard.tsx';
import { StepSidebar } from '../features/editor/StepSidebar.tsx';
import { courtScale } from '../app/chromeBudget.ts';
import { buildSummary } from '../model/summary.ts';
import { createDrill } from '../model/defaults.ts';
import { courtDefFor, COURT_SIZES, type CourtSize } from '../model/court.ts';

afterEach(cleanup);

// ── ② 스텝 사이드바 카드의 가로세로비 ───────────────────────────────────────────────────
//
// 2026-08-17 재편(PLAN-STEP-EDITING.md 구현 순서 ②) — 가로 칩 시절의 순수 함수
// (stepChipAspect 등, `calc(var(--hit) * 비율)`)은 없어졌다. 세로 카드는 폭이 고정
// (SIDEBAR_WIDTH_PX 파생)이고 **높이**가 코트 비율을 따라가며, DrillCard 와 똑같이
// `aspectRatio: '${vbW} / ${vbH}'` 를 카드에 직접 건다 — 따로 뽑을 순수 함수가 없으므로
// 이 항목은 ④-b(호출부)로 합친다.

// ── ③ 크롬 예산표의 축척 ────────────────────────────────────────────────────────────────
describe('§6.4 ③ 코트 축척(chromeBudget.courtScale)이 코트 크기를 따라간다', () => {
  const BOX = { w: 1055, h: 634 }; // 계획서 §3 표의 '1280×800 PC (오버레이)' 행

  it('작은 코트일수록 같은 상자에서 크게 그려진다 — 축척이 실제로 움직인다', () => {
    const big = courtScale('full', BOX, '30x18').pxPerUnit;
    const small = courtScale('full', BOX, '25x14').pxPerUnit;
    expect(small).toBeGreaterThan(big);
  });
});

// ── ④ 하단 바의 코트 설명 ──────────────────────────────────────────────────────────────
const barWrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <ToastProvider>{children}</ToastProvider>
  </SettingsProvider>
);

// ── ④-b 스텝 사이드바 카드(드릴 편집 왼쪽 바) ───────────────────────────────────────────
//
// 옛 ②(순수 함수)가 사라졌으니 여기서 **호출부**만으로 본다: 카드 상자의 aspectRatio 와
// 카드 안 썸네일 viewBox 가 실제로 그 드릴의 코트 크기를 따라가는가. 5차 검증의 교훈이
// 정확히 이것이다 — 함수가 옳아도 호출부가 인자를 안 넘기면 화면은 그대로다.
describe('§6.4 ④-b 스텝 사이드바 카드가 그 드릴의 코트 크기로 그려진다', () => {
  it.each(COURT_SIZES)('%s — 카드 aspectRatio 와 카드 안 썸네일이 그 코트다', (size: CourtSize) => {
    const drill = createDrill({ courtMode: 'full', courtSize: size });
    const { container } = render(
      <StepSidebar
        drill={drill}
        stepId={drill.steps[0]!.id}
        onSelectStep={() => {}}
        onReorderStep={() => {}}
        onDuplicateStep={() => {}}
        onToggleCut={() => {}}
        collapsed={false}
        onMoveSteps={() => {}}
        onDuplicateSteps={() => {}}
        onDeleteSteps={() => {}}
        onDeleteStep={() => {}}
      />,
      { wrapper: barWrapper },
    );
    const def = courtDefFor('full', size);
    const svg = container.querySelector('svg[viewBox]')!;
    expect([...container.querySelectorAll('svg')].map((s) => s.getAttribute('viewBox'))).toContain(`0 0 ${def.vbW} ${def.vbH}`);
    expect(svg).toBeTruthy();
    const card = screen.getByRole('button', { name: '스텝 1' }) as HTMLElement;
    // 2026-08-17 §복제 — 카드 복제 버튼을 형제로 앉히면서(중첩 <button> 은 무효한 HTML)
    // aspectRatio 는 선택 버튼이 아니라 그 둘을 감싸는 위치 기준 wrapper 가 갖는다
    // (StepSidebar.tsx: 선택 버튼은 그 wrapper 에 inset:0 으로 꽉 채운다).
    expect((card.parentElement as HTMLElement).style.aspectRatio).toBe(`${def.vbW} / ${def.vbH}`);
  });
});

// ── ⑤ 목록 카드(요약 → 썸네일) ─────────────────────────────────────────────────────────
describe('§6.4 ⑤ 목록 카드가 그 드릴의 코트 크기로 그려진다', () => {
  it.each(COURT_SIZES)('%s — 요약이 크기를 싣고, 카드 상자·썸네일이 그 비율이다', (size: CourtSize) => {
    const summary = buildSummary(createDrill({ courtMode: 'full', courtSize: size, title: '카드' }));
    expect(summary.courtSize, '요약에 크기가 없다 — 카드는 본문을 열지 않으므로 여기가 유일한 통로다').toBe(size);

    const { container } = render(
      <DrillCard drill={summary} onOpen={() => {}} onPresent={() => {}} onDuplicate={() => {}} onDelete={() => {}} onExport={() => {}} />,
      { wrapper: barWrapper },
    );
    const def = courtDefFor('full', size);
    expect(container.querySelector('svg.drill-card-thumb')!.getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
    const box = container.querySelector('svg.drill-card-thumb')!.parentElement as HTMLElement;
    // 2026-08-19 기현님 2차 — 가로·세로 모두 1/2: 상자 폭이 카드의 50% 이고 비율은 코트
    // 그대로다. 비율이 **코트 크기를 따라간다**는 이 테스트의 요점은 그대로다.
    expect(box.style.aspectRatio).toBe(`${def.vbW} / ${def.vbH}`);
    expect(box.style.width).toBe('50%');
  });

  it('대조군: 옛 요약(크기 없음)은 30×18 로 읽힌다 — 빈칸이 곧 기본값이다', () => {
    const summary = buildSummary(createDrill({ courtMode: 'full', title: '옛 카드' }));
    const { courtSize: _drop, ...old } = summary;
    const { container } = render(
      <DrillCard drill={old} onOpen={() => {}} onPresent={() => {}} onDuplicate={() => {}} onDelete={() => {}} onExport={() => {}} />,
      { wrapper: barWrapper },
    );
    const def = courtDefFor('full', '30x18');
    expect(container.querySelector('svg.drill-card-thumb')!.getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
  });
});
