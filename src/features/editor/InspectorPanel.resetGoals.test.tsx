// §5.4 [골대 원위치] — **찾을 수 있는 자리에 있는가.**
//
// 이 항목의 신고는 "기능이 없다" 가 아니라 **"못 찾겠다"** 였다(2026-08-13 기현님:
// *"골대 원위치 버튼 어디있나?"*). 4.7 이 예산 때문에 이 버튼을 [코트 비우기] 확인 모달 안으로
// 내렸고, 6차 검증관은 *"기능은 살아 있다"* 로 확인하고 넘어갔다 — 아무도 *"찾을 수 있는가"* 를
// 안 물은 것이다. 그래서 이 파일이 무는 것은 **자리**다.
//
// ── 찌르는 축을 열거한다(헛통과 5형태 중 "어느 축을 안 찔렀나") ──────────────────────────
//   · 모드: 자유 전술판(showSteps=false) · 드릴 편집(showSteps=true)   ← 둘 다
//   · 코트: full · half · flat × 크기 3단('30x18'·'28x15'·'25x14')      ← 9칸 전수
//   · 상태: 눌렀다 / 안 눌렀다(대조군) · 활성 / 비활성
// 화면 끝(BoardScreen·EditorScreen)에서의 배선은 EditorWorkspace.resetGoals.test.tsx 가 본다 —
// 여기는 패널 단독이라 스파이가 정확히 보인다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InspectorPanel } from './InspectorPanel.tsx';
import { createDrill } from '../../model/defaults.ts';
import { COURT_MODES, COURT_SIZES, courtDefFor } from '../../model/court.ts';
import type { CourtMode, CourtSize } from '../../model/court.ts';

function panel(opts: { showSteps?: boolean; courtMode?: CourtMode; courtSize?: CourtSize; onResetGoals?: () => void; dispatch?: () => void } = {}) {
  const courtMode = opts.courtMode ?? 'full';
  const drill = { ...createDrill({ courtMode, formation: '1-2-1' }), courtSize: opts.courtSize };
  const dispatch = vi.fn(opts.dispatch);
  render(
    <InspectorPanel
      drill={drill}
      step={drill.steps[0]!}
      stepIndex={0}
      dispatch={dispatch}
      selection={new Set()}
      pendingPlayerId={null}
      onArmPlayer={() => {}}
      onEraseIds={() => {}}
      onResetGoals={opts.onResetGoals ?? (() => {})}
      showSteps={opts.showSteps ?? false}
    />,
  );
  return { drill, dispatch };
}

const goalButton = () => screen.getByRole('button', { name: '골대 원위치' });

describe('[골대 원위치] 가 인스펙터에 있다 (2026-08-13 기현님 신고)', () => {
  it.each([
    ['자유 전술판', false],
    ['드릴 편집기', true],
  ] as const)('%s 에 버튼이 있다', (_label, showSteps) => {
    panel({ showSteps });
    expect(goalButton()).toBeInTheDocument();
  });

  it('버튼은 `<aside aria-label="드릴 속성">` **안**에 있다 — 여기 밖이면 첫 화면 예산에 든다', () => {
    panel();
    const aside = screen.getByRole('complementary', { name: '드릴 속성' });
    expect(within(aside).getByRole('button', { name: '골대 원위치' })).toBe(goalButton());
  });

  it('자리는 [드릴 정보] 구역 안이다 — 코트·포메이션을 읽은 그 자리다', () => {
    panel();
    // 구역을 문서 순서로 특정한다: 같은 컨테이너 안에 '코트' 라벨과 버튼이 함께 있어야 한다.
    const section = goalButton().closest('div[style*="padding"]')!.parentElement!.parentElement!;
    expect(section.textContent).toContain('드릴 정보');
    expect(section.textContent).toContain('포메이션');
  });
});

describe('눌리면 onResetGoals 가 정확히 1회 (그리고 그것뿐이다)', () => {
  it('클릭 1회 → 핸들러 1회', async () => {
    const onResetGoals = vi.fn();
    const { dispatch } = panel({ onResetGoals });

    await userEvent.click(goalButton());

    expect(onResetGoals).toHaveBeenCalledTimes(1);
    // 판 모델은 건드리지 않는다 — 골대는 드릴에 저장되지 않는 코트 정의 소유다(§5.4 GOAL).
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('대조군: 안 누르면 0회다 — 위 단언이 "무조건 1" 로 통과한 것이 아니다', () => {
    const onResetGoals = vi.fn();
    panel({ onResetGoals });
    expect(onResetGoals).not.toHaveBeenCalled();
  });

  it('대조군: 이웃 버튼(명단의 선수 카드)을 눌러도 골대 핸들러는 안 불린다', async () => {
    const onResetGoals = vi.fn();
    panel({ onResetGoals });
    const neighbor = screen.getAllByRole('button', { expanded: false })[0]!;
    expect(neighbor).not.toBe(goalButton()); // 대조군이 같은 버튼을 누른 것이 아니다
    await userEvent.click(neighbor);
    expect(onResetGoals).not.toHaveBeenCalled();
  });

  it('두 번 누르면 두 번이다 — 한 번 쓰고 죽는 버튼이 아니다(막혀서 다시 눌러야 하는 경로)', async () => {
    const onResetGoals = vi.fn();
    panel({ onResetGoals });
    await userEvent.click(goalButton());
    await userEvent.click(goalButton());
    expect(onResetGoals).toHaveBeenCalledTimes(2);
  });
});

// ── §8 점진 공개 금지 ────────────────────────────────────────────────────────────────────
// "밀렸을 때만 나타난다" 로 만들면 표적 좌표가 사용 중에 이동한다. 발 마우스·입 젓가락
// 사용자는 절대 위치로 공간 기억을 만든다 — 그래서 **언제나 같은 자리**에 있고, 바뀌는 것은
// 비활성 여부와 설명뿐이다. 그 판정의 유일한 출처는 `courtDefFor(...).goalPosts` 다.
describe('코트 9칸 전수 — 버튼은 늘 있고, 골대가 없는 코트에서만 비활성이다', () => {
  const cases = COURT_MODES.flatMap((mode) => COURT_SIZES.map((size) => [mode, size] as const));

  it.each(cases)('%s / %s — 버튼은 DOM 에 있다', (mode, size) => {
    panel({ courtMode: mode, courtSize: size });
    expect(goalButton()).toBeInTheDocument();
  });

  it.each(cases)('%s / %s — 비활성 여부가 goalPosts 유무와 정확히 같다', (mode, size) => {
    panel({ courtMode: mode, courtSize: size });
    const hasGoals = courtDefFor(mode, size).goalPosts.length > 0;
    expect((goalButton() as HTMLButtonElement).disabled, `goalPosts=${courtDefFor(mode, size).goalPosts.length}`).toBe(!hasGoals);
  });

  it('대조군: 9칸이 전부 같은 답이 아니다 — 활성도 비활성도 실재한다', () => {
    const answers = new Set(cases.map(([mode, size]) => courtDefFor(mode, size).goalPosts.length > 0));
    expect(answers).toEqual(new Set([true, false]));
  });

  it('플랫 코트는 이유를 적는다 — 눌리지 않는 버튼이 침묵하면 고장으로 읽힌다', () => {
    panel({ courtMode: 'flat' });
    expect(screen.getByText('플랫 코트에는 골대가 없습니다.')).toBeInTheDocument();
  });

  it('골대가 있는 코트는 무엇을 되돌리는지 적는다', () => {
    panel({ courtMode: 'full' });
    expect(screen.getByText(/휠체어에 밀린 골대를 규격 자리로 되돌립니다/)).toBeInTheDocument();
    expect(screen.queryByText('플랫 코트에는 골대가 없습니다.')).toBeNull();
  });

  it('비활성 코트에서는 눌러도 핸들러가 안 불린다', async () => {
    const onResetGoals = vi.fn();
    panel({ courtMode: 'flat', onResetGoals });
    await userEvent.click(goalButton());
    expect(onResetGoals).not.toHaveBeenCalled();
  });
});

describe('버튼 자체의 계약', () => {
  it('높이가 --hit 다 — 발 마우스·입 젓가락 사용자의 표적이다 (§7.3)', () => {
    panel();
    expect(goalButton().style.minHeight).toBe('var(--hit)');
  });

  it('누른 뒤에도 자리를 지킨다 — 포커스가 그대로고 패널도 닫히지 않는다 (§7.6)', async () => {
    panel();
    const btn = goalButton();
    await userEvent.click(btn);
    // 모달과 다른 점이다: 모달은 결과를 보여 주려고 닫히지만, 인스펙터는 판의 동반자라 열린
    // 채로 남는다(InspectorHost 머리말 1). 닫히면 "다시 누르려면 또 열어야 하는" 버튼이 된다.
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(document.activeElement).toBe(btn);
  });
});
