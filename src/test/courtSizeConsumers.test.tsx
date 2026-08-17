// §6.4 — **코트 정의 소비처 전수 열거 게이트 + 나머지 소비처들.**
//
// 5차 검증관의 rg 실측이 이 항목의 출발점이었다: `courtDefFor` 의 프로덕션 소비처가 model/ 안
// 4개 파일뿐이고, 렌더·물리·편집기는 전부 `COURT_DEFS[mode]` 를 직접 읽었다. 그래서 `courtSize`
// 는 저장·마이그레이션·검증·백업까지 왕복하면서 **화면에 한 픽셀도 나타나지 않는 죽은 값**이었다.
//
// 목록 없이 "다 옮겼다" 는 검증 불가다. 그래서 여기서 rg 를 테스트로 굳힌다 —
// **프로덕션 코드에서 `COURT_DEFS` 를 값으로 읽는 파일은 아래 허용 목록뿐이어야 한다.**
// 새 소비처가 생기면 이 테스트가 먼저 빨개지고, 고치는 길은 `courtDefFor(mode, size)` 다.
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

// ── ① 전수 열거 계약 ──────────────────────────────────────────────────────────────────
//
// `COURT_DEFS` 를 값으로 읽어도 되는 프로덕션 파일과 **그 근거**. 근거가 없으면 목록에 없다.
const COURT_DEFS_ALLOWED: Record<string, string> = {
  'src/model/court.ts': '정의 그 자체 + courtDefFor 의 구현부. 여기가 유일한 출처다.',
  'src/render/courtLines/HalfCourtLines.tsx':
    '하프 코트는 크기 3단을 따라가지 않는다(court.ts COURT_DEFS 주석 근거 셋: 규격 부재 · 격자 붕괴 · flat 파급). ' +
    'CourtSurface 가 size prop 을 넘기기는 하지만 이 파일은 그것을 읽지 않는다 — 읽으면 규정에 없는 3단을 ' +
    '훈련용 구획에 만들어 내는 것이고, courtSizeScreens.test.tsx 의 half/flat 대조군이 그것을 막는다.',
  'src/features/editor/FunctionBar.tsx':
    '2026-08-14 재설계로 **코트 형태를 고르는 유일한 UI** 가 여기다(옛 헤더 세그먼트의 후신). ' +
    '세 형태의 이름·설명을 그 정의에서 그대로 읽는다 — 손으로 옮겨 적으면 court.ts 와 화면이 갈라진다. ' +
    '크기 3단은 courtDefFor 로 읽으므로 여기서 COURT_DEFS 를 보는 것은 형태 셋뿐이다.',
};

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** 주석이 아닌 줄에서 `COURT_DEFS` 를 값으로 읽는가. `FULL_COURT_DEFS` 는 제외한다 —
 *  그것은 3단 표 자체이고, defaults.ts 가 **기본 크기를 기준점으로** 쓰는 정당한 소비다. */
function readsCourtDefs(file: string): boolean {
  return readFileSync(file, 'utf8')
    .split('\n')
    .some((raw) => {
      const line = raw.trim();
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return false;
      return /(?<!FULL_)COURT_DEFS/.test(line);
    });
}

describe('§6.4 ① 코트 정의 소비처 전수 열거', () => {
  it('프로덕션 코드에서 COURT_DEFS 를 값으로 읽는 파일은 허용 목록뿐이다', () => {
    const files = walk(SRC)
      // 테스트 헬퍼(src/test/helpers)는 프로덕션이 아니다 — 다만 4.4 에서 함께 courtDefFor 로 옮겼다.
      .filter((f) => !f.includes(`${join('src', 'test')}`))
      .filter(readsCourtDefs)
      .map((f) => relative(process.cwd(), f).replaceAll('\\', '/'))
      .sort();
    expect(files).toEqual(Object.keys(COURT_DEFS_ALLOWED).sort());
  });

  it('대조군: 스캐너가 실제로 파일을 읽고 있고, 허용 목록의 근거가 비어 있지 않다', () => {
    expect(walk(SRC).length).toBeGreaterThan(100); // 파일을 못 찾아 빈 목록으로 통과한 것이 아니다
    expect(readsCourtDefs(join(SRC, 'model', 'court.ts'))).toBe(true);
    expect(readsCourtDefs(join(SRC, 'model', 'grid.ts'))).toBe(false); // 4.4 에서 옮긴 자리
    for (const why of Object.values(COURT_DEFS_ALLOWED)) expect(why.length).toBeGreaterThan(20);
  });
});

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

  it.each(COURT_SIZES)('%s — 같은 상자에서 축척이 그 코트의 것이다', (size) => {
    const def = courtDefFor('full', size);
    const s = courtScale('full', BOX, size);
    const boxW = s.rot === 90 ? def.vbH : def.vbW;
    const boxH = s.rot === 90 ? def.vbW : def.vbH;
    expect(s.pxPerUnit).toBeCloseTo(Math.min(BOX.w / boxW, BOX.h / boxH), 9);
  });

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

// 2026-08-18 — 옛 ④(BoardBar 의 크기별 desc 문장)는 BoardBar 폐차와 함께 은퇴했다(하단 바
// 전면 철거). desc 의 살아 있는 소비처는 기능 바 [코트] 모달이고, 여기서는 **모델 계약**만
// 지킨다: 세 문장이 실제로 서로 달라야 화면 어디서 읽든 구분이 된다.
describe('§6.4 ④ 코트 크기 desc 모델 계약', () => {
  it('세 desc 가 서로 다른 문장이다', () => {
    expect(new Set(COURT_SIZES.map((s) => courtDefFor('full', s).desc)).size).toBe(3);
    // 리터럴 대조 — 모델이 빈 문자열로 망가지면 위 단언이 조용히 통과한다.
    expect(courtDefFor('full', '28x15').desc).toMatch(/농구 코트/);
  });
});

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
        onAddStep={() => {}}
        onDuplicateStep={() => {}}
        onToggleCut={() => {}}
        collapsed={false}
        onMoveSteps={() => {}}
        onDuplicateSteps={() => {}}
        onDeleteSteps={() => {}}
        onDeleteStep={() => {}}
        playback={{ playing: false, canPlay: false, onTogglePlay: () => {}, speed: 1, onCycleSpeed: () => {} }}
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
    );
    const def = courtDefFor('full', size);
    expect(container.querySelector('svg.drill-card-thumb')!.getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
    const box = container.querySelector('svg.drill-card-thumb')!.parentElement as HTMLElement;
    expect(box.style.aspectRatio).toBe(`${def.vbW} / ${def.vbH}`);
  });

  it('대조군: 옛 요약(크기 없음)은 30×18 로 읽힌다 — 빈칸이 곧 기본값이다', () => {
    const summary = buildSummary(createDrill({ courtMode: 'full', title: '옛 카드' }));
    const { courtSize: _drop, ...old } = summary;
    const { container } = render(
      <DrillCard drill={old} onOpen={() => {}} onPresent={() => {}} onDuplicate={() => {}} onDelete={() => {}} onExport={() => {}} />,
    );
    const def = courtDefFor('full', '30x18');
    expect(container.querySelector('svg.drill-card-thumb')!.getAttribute('viewBox')).toBe(`0 0 ${def.vbW} ${def.vbH}`);
  });
});
