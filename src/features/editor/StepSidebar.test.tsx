// PLAN-STEP-EDITING.md 구현 순서 ② — 왼쪽 세로 스텝 바.
//
// 여기서 보는 것: 카드 수·번호·현재 스텝 강조, 탭 선택, [한 장 더 찍기], 썸네일 배수 배선,
// 접힘/오버레이 표시 모드. 드래그·키보드 재정렬 계약은 StepSidebar.reorder.test.tsx 다
// (옛 TransportBar.reorder.test.tsx 의 이사 — 계약 자체는 그대로다).
import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { StepSidebar } from './StepSidebar.tsx';
import { SIDEBAR_GLYPH_SCALE } from '../../render/CourtThumbnail.tsx';
import { THUMB_GLYPH } from '../../render/CourtThumbnail.tsx';
import { createDrill } from '../../model/defaults.ts';
import { duplicateStep } from '../../model/edits.ts';
import { LIMITS } from '../../model/validate.ts';
import type { Drill } from '../../model/drill.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// StepSidebar 의 카드 썸네일(CourtThumbnail)이 aria-label 번역에 useLocale()(→
// SettingsProvider)을 쓴다(C7) — 이 파일 전체를 한 곳에서 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });

function makeDrill(n: number): Drill {
  let d = createDrill({ courtMode: 'full' });
  for (let i = 1; i < n; i++) d = duplicateStep(d, i - 1);
  return d;
}

const noop = () => {};

function renderSidebar(d: Drill, over: Partial<Parameters<typeof StepSidebar>[0]> = {}) {
  const props = {
    drill: d,
    stepId: d.steps[0]!.id,
    onSelectStep: noop,
    onReorderStep: noop,
    onDuplicateStep: noop,
    onToggleCut: noop,
    collapsed: false,
    onMoveSteps: noop,
    onDuplicateSteps: noop,
    onDeleteSteps: noop,
    onDeleteStep: noop,
    ...over,
  };
  return render(<StepSidebar {...props} />);
}

const cards = () => screen.getAllByRole('button', { name: /^스텝 \d+$/ });

describe('카드 목록 — 고정(비접힘) 모드', () => {
  it('현재 스텝 카드에만 aria-current="step" 이 붙는다', () => {
    const d = makeDrill(3);
    renderSidebar(d, { stepId: d.steps[1]!.id });
    const list = cards();
    expect(list[0]).not.toHaveAttribute('aria-current');
    expect(list[1]).toHaveAttribute('aria-current', 'step');
    expect(list[2]).not.toHaveAttribute('aria-current');
  });

  it('카드를 탭하면 그 스텝이 선택된다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onSelectStep });
    await userEvent.click(cards()[2]!);
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[2]!.id);
  });

  // ⚠️ [한 장 더 찍기] 버튼의 세 케이스(있다·정원에서 잠긴다·59장 대조군)가 여기 있었다.
  //    2026-08-30 기현 지시로 그 버튼이 없어졌다 — 스텝을 늘리는 길은 이제 틈의 [+] 뿐이고,
  //    그 정원 가드는 아래 §틈 섹션이 **N+1 개 전부** + 59장 대조군으로 이미 잡고 있다.
  //    같은 것을 두 곳에서 재지 않으려고 옮기지 않고 지웠다.
});

// §복제(기현님 확정 2026-08-17) — 카드 복제 버튼, 틈(gap) + 버튼. 후방 복제가 기본이고,
// 맨 앞 틈(g=0)만 "아래 첫 스텝을 복제해 맨 앞에" 로 예외다(PLAN-STEP-EDITING.md §복제).
// 실제 삽입 결과(리듀서가 계약을 지키는지)는 reducer.test.ts 가 본다 — 여기서는 카드/틈이
// **어떤 id·toIndex** 로 onDuplicateStep 을 부르는지, 정원에서 잠기는지만 본다.
const dupCardBtn = () => screen.getAllByRole('button', { name: /을 아래로 복제$/ });
// 내부 틈은 이제 버튼이 둘(복제 + 사슬)이라 이름으로 좁힌다 — "복제" 를 포함하는 쪽이 [+].
// 사슬 토글은 별도 chainBtn 헬퍼(아래 §사슬 섹션)로 찾는다.
const gapBtn = (container: HTMLElement, g: number) =>
  within(container.querySelector(`[data-gap-index="${g}"]`) as HTMLElement).getByRole('button', { name: /복제/ });

describe('카드 복제 버튼', () => {
  it('카드 수만큼 있고, 누르면 그 카드의 id 로 onDuplicateStep 이 나간다(toIndex 없음 = 기본 자리)', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { onDuplicateStep });
    const btns = dupCardBtn();
    expect(btns).toHaveLength(3);
    await userEvent.click(btns[1]!);
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[1]!.id);
  });

  it('복제 버튼을 눌러도 카드 선택(onSelectStep)은 안 딸려온다', async () => {
    const onSelectStep = vi.fn();
    const onDuplicateStep = vi.fn();
    renderSidebar(makeDrill(2), { onSelectStep, onDuplicateStep });
    await userEvent.click(dupCardBtn()[0]!);
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onSelectStep).not.toHaveBeenCalled();
  });

  it('정원(60장)에서는 잠기고 이유를 말한다', () => {
    renderSidebar(makeDrill(LIMITS.maxSteps));
    dupCardBtn().forEach((b) => {
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute('title', expect.stringContaining(String(LIMITS.maxSteps)));
    });
  });

  // 잠김이 '배선 자체가 없어서' 통과하는 것이 아님을 보이는 대조군이다.
  it('대조군: 59장에서는 열려 있고 실제로 발화한다', async () => {
    const onDuplicateStep = vi.fn();
    renderSidebar(makeDrill(LIMITS.maxSteps - 1), { onDuplicateStep });
    const btn = dupCardBtn()[0]!;
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
  });
});

describe('틈(gap)의 + 버튼', () => {
  it('틈 g(g≥1) 은 위 스텝(g-1)의 id 로, toIndex 없이 onDuplicateStep 을 부른다', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    const { container } = renderSidebar(d, { onDuplicateStep });
    await userEvent.click(gapBtn(container, 2)); // 카드 1(B) 과 카드 2(C) 사이
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[1]!.id);

    // 맨 끝 틈(카드 수만큼의 index) 도 같은 일반 규칙이다 — 마지막 스텝을 복제해 뒤에 넣는다.
    await userEvent.click(gapBtn(container, 3));
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[2]!.id);
  });

  it('맨 앞 틈(g=0) 은 첫 스텝의 id 와 toIndex:0 으로 onDuplicateStep 을 부른다', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    const { container } = renderSidebar(d, { onDuplicateStep });
    await userEvent.click(gapBtn(container, 0));
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
    expect(onDuplicateStep).toHaveBeenCalledWith(d.steps[0]!.id, 0);
  });

  // 잠기는 것은 [+](정원 가드)뿐이다 — 사슬 토글은 스텝을 늘리지 않으니 정원과 무관하게
  // 항상 눌린다(내부 틈 대조: 아래 §사슬 섹션 '정원에서도 사슬은 안 잠긴다').
  it('정원(60장)에서는 카드 수+1 개 틈의 [+] 가 전부 잠긴다', () => {
    const d = makeDrill(LIMITS.maxSteps);
    const { container } = renderSidebar(d);
    const gaps = container.querySelectorAll('[data-gap-index]');
    expect(gaps).toHaveLength(LIMITS.maxSteps + 1);
    gaps.forEach((gap) => {
      expect(within(gap as HTMLElement).getByRole('button', { name: /복제/ })).toBeDisabled();
    });
  });

  it('대조군: 59장에서는 열려 있고 실제로 발화한다', async () => {
    const onDuplicateStep = vi.fn();
    const d = makeDrill(LIMITS.maxSteps - 1);
    const { container } = renderSidebar(d, { onDuplicateStep });
    const btn = gapBtn(container, 0);
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onDuplicateStep).toHaveBeenCalledTimes(1);
  });
});

// ④ 사슬 토글(기현님 확정 2026-08-17) — 내부 틈에만 존재한다. 저장 방향(cut:true 설정 ·
// false 로 키 삭제)은 store/editor/reducer.test.ts 가 본다 — 여기서는 사이드바가 **어느 틈에
// 버튼을 놓는지, 무엇을 onToggleCut 에 싣는지, aria 상태가 props(모델)를 그대로 따라가는지**
// 만 본다.
const chainBtn = (container: HTMLElement, g: number) =>
  within(container.querySelector(`[data-gap-index="${g}"]`) as HTMLElement).getByRole('button', { name: /사슬/ });

describe('틈(gap)의 사슬 토글', () => {
  it('내부 틈(1..N-1)에만 사슬 버튼이 있다 — 맨 앞·맨 뒤 틈은 경계가 없어 없다', () => {
    const d = makeDrill(3); // 틈 0,1,2,3 — 내부는 1,2 뿐
    const { container } = renderSidebar(d);
    expect(within(container.querySelector('[data-gap-index="0"]') as HTMLElement).queryByRole('button', { name: /사슬/ })).toBeNull();
    expect(within(container.querySelector('[data-gap-index="3"]') as HTMLElement).queryByRole('button', { name: /사슬/ })).toBeNull();
    expect(chainBtn(container, 1)).toBeInTheDocument();
    expect(chainBtn(container, 2)).toBeInTheDocument();
  });

  it('기본(연결)은 aria-pressed=false — 눌러도 onDuplicateStep 은 안 딸려온다', async () => {
    const onToggleCut = vi.fn();
    const onDuplicateStep = vi.fn();
    const d = makeDrill(3);
    const { container } = renderSidebar(d, { onToggleCut, onDuplicateStep });
    const btn = chainBtn(container, 1);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    // 틈 1 의 "다음 스텝" = 교리대로 order[1] = d.steps[1]
    expect(onToggleCut).toHaveBeenCalledWith(d.steps[1]!.id, true);
    expect(onDuplicateStep).not.toHaveBeenCalled();
  });

  it('끊긴 경계(cut:true)는 aria-pressed=true 이고, 누르면 false(=키 삭제 명령)를 싣는다', async () => {
    const onToggleCut = vi.fn();
    let d = makeDrill(3);
    d = { ...d, steps: d.steps.map((s, i) => (i === 1 ? { ...s, cut: true } : s)) };
    const { container } = renderSidebar(d, { onToggleCut });
    const btn = chainBtn(container, 1);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btn);
    expect(onToggleCut).toHaveBeenCalledWith(d.steps[1]!.id, false);
  });

  it('aria-pressed 는 모델(props)을 그대로 따라 왕복한다', () => {
    const d = makeDrill(3);
    const { container, rerender } = renderSidebar(d);
    expect(chainBtn(container, 1)).toHaveAttribute('aria-pressed', 'false');

    // 명시적 `: Drill` 주석이 필요하다 — 없으면 삼항의 `cut: true` 리터럴이 문맥 없이 위젯되어
    // (best common type 이 `boolean` 으로 넓힌다) DrillStep.cut(리터럴 true 만 정의역)과 갈린다.
    const cutOn: Drill = { ...d, steps: d.steps.map((s, i) => (i === 1 ? { ...s, cut: true } : s)) };
    rerender(
      <StepSidebar
        drill={cutOn}
        stepId={d.steps[0]!.id}
        onSelectStep={noop}
        onReorderStep={noop}
        onDuplicateStep={noop}
        onToggleCut={noop}
        collapsed={false}
        onMoveSteps={noop}
        onDuplicateSteps={noop}
        onDeleteSteps={noop}
        onDeleteStep={noop}
      />,
    );
    expect(chainBtn(container, 1)).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <StepSidebar
        drill={d}
        stepId={d.steps[0]!.id}
        onSelectStep={noop}
        onReorderStep={noop}
        onDuplicateStep={noop}
        onToggleCut={noop}
        collapsed={false}
        onMoveSteps={noop}
        onDuplicateSteps={noop}
        onDeleteSteps={noop}
        onDeleteStep={noop}
      />,
    );
    expect(chainBtn(container, 1)).toHaveAttribute('aria-pressed', 'false');
  });

  it('정원(60장)에서도 사슬은 안 잠긴다 — [+]와 달리 스텝을 늘리지 않는다', () => {
    const d = makeDrill(LIMITS.maxSteps);
    const { container } = renderSidebar(d);
    expect(chainBtn(container, 1)).toBeEnabled();
  });
});

// 2026-08-17 — 카드가 칩보다 훨씬 커서(2026-08-18 축소 뒤에도 ≈134px vs ≈76px) SIDEBAR_GLYPH_SCALE 로
// 보정한다. 배선이 끊기면 화면은 '점 몇 개짜리 빈 코트' 로 조용히 퇴화하고, 크기를 재는 테스트는
// CourtThumbnail 쪽에만 있어 아무도 안 세게 된다 — 그래서 여기서 배수를 확인한다
// (옛 TransportBar.test.tsx "칩 배수로 그린다" 가드의 이사).
describe('카드 썸네일 — SIDEBAR_GLYPH_SCALE 로 그린다', () => {
  it('★ 카드 안 휠체어는 THUMB_GLYPH × SIDEBAR_GLYPH_SCALE 이다', () => {
    const { container } = renderSidebar(makeDrill(1));
    const rs = [...container.querySelectorAll('circle')].map((c) => Number(c.getAttribute('r')));
    expect(rs).toContain(THUMB_GLYPH.chairR * SIDEBAR_GLYPH_SCALE);
    expect(rs).not.toContain(THUMB_GLYPH.chairR); // 배선이 끊겨 축척 1 로 퇴화하면 여기서 걸린다
  });
});

describe('접힘 모드 — 여는 버튼 + 오버레이', () => {
  it('버튼을 누르면 오버레이로 카드 목록이 뜨고 aria-expanded 가 왕복한다', async () => {
    const d = makeDrill(3);
    renderSidebar(d, { collapsed: true });
    const btn = screen.getByRole('button', { name: '스텝 목록 열기' });
    // 처음엔 여는 버튼만 있고 카드 목록은 없다.
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();

    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: '스텝 목록 닫기' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: '스텝 목록' })).toBeInTheDocument();
    expect(cards()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 닫기' }));
    expect(screen.getByRole('button', { name: '스텝 목록 열기' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
  });

  it('바깥(배경)을 탭하면 닫힌다', async () => {
    renderSidebar(makeDrill(2), { collapsed: true });
    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 열기' }));
    expect(screen.getByRole('navigation', { name: '스텝 목록' })).toBeInTheDocument();

    const backdrop = document.querySelector('[data-sidebar-backdrop]') as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.queryByRole('navigation', { name: '스텝 목록' })).toBeNull();
  });

  it('오버레이 안에서도 카드 탭이 그대로 동작한다', async () => {
    const onSelectStep = vi.fn();
    const d = makeDrill(3);
    renderSidebar(d, { collapsed: true, onSelectStep });
    await userEvent.click(screen.getByRole('button', { name: '스텝 목록 열기' }));
    await userEvent.click(cards()[1]!);
    expect(onSelectStep).toHaveBeenCalledWith(d.steps[1]!.id);
  });
});

// 2026-08-20 — 재생 컨트롤(§재생 컨트롤 — 사이드바 하단)과 드릴 이름 인라인 편집
// (§드릴 이름 — 사이드바 맨 위 클릭-편집)은 이 파일에서 은퇴했다. 두 기능 다 사이드바를
// 떠났다 — 재생 묶음은 편집·시연 공용 `ui/PlaybackControls.tsx`(EditorWorkspace 하단 줄)로,
// 드릴 이름은 두 화면 공용 컴팩트 헤더(제목 titleField)로 옮겨 갔다. 그 전제("넓은 창의 드릴
// 편집에는 헤더가 없다")가 이번 재설계로 사라졌기 때문이다(StepSidebar.tsx 옛 title prop
// 주석 참고). 재생 묶음 계약은 `ui/PlaybackControls.test.tsx`, 헤더 제목 편집은
// `AppHeader.test.tsx`/`EditorWorkspace.headerTitle.test.tsx` 가 잇는다.
