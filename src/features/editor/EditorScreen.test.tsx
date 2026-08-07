// §10.8 화면 스모크 — CourtPicker → 드릴 생성 → 편집기 3영역 렌더까지 실제 경로로 확인한다.
//
// `../../app/AppShell.tsx` 를 vi.mock 으로 대체한다: EditorScreen 이 필요로 하는 건
// `useEditorTarget()` 하나뿐인데, 그 실제 파일은 형제 Wave4 모듈(screen-settings 의
// SettingsScreen.tsx)을 함께 import 한다 — 그 모듈이 아직 없는 동안(§9 "Wave4 는 병렬 진행,
// 형제 산출물이 없으면 import 가 막힌다")에는 실제 모듈을 그대로 불러오면 이 화면과 무관한
// 이유로 테스트가 깨진다. §8 통합 시점에는 이 모킹을 걷어내도 그대로 통과해야 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { loadPrefs, makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';

vi.mock('../../app/AppShell.tsx', () => ({
  useEditorTarget: () => ({ kind: 'new' as const }),
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'editor', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppNavProvider value={nav}>{children}</AppNavProvider>
        <LiveRegion />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('EditorScreen', () => {
  it('새 드릴 대상이면 코트 선택부터 시작해, 고르면 편집기 3영역이 렌더된다', async () => {
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });

    expect(screen.getByRole('heading', { name: '어떤 코트로 진행하십니까?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));

    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    expect(screen.getByRole('application', { name: '코트 편집 영역' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^선택/ })).toHaveAttribute('aria-pressed', 'true');
  });

  // §7.5d 회귀 — 배치 도구 활성 + 코트 포커스일 때 ArrowLeft/Right 는 배치 커서만 움직여야
  // 한다(useEditorKeyboard 의 전역 스텝 이동과 이중 발화 금지). 감사 evidence 재현: 스텝 3개 +
  // 공 도구 선택 + 코트 포커스 상태에서 ArrowRight 1회 → 스텝 표시는 그대로, 커서만 이동한다.
  it('배치 도구 + 코트 포커스에서 ArrowRight 는 스텝을 넘기지 않고 배치 커서만 이동한다(§7.5d)', async () => {
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());

    // 스텝 3개로 만든다(기본 1개 + 추가 2회).
    await user.click(screen.getByRole('button', { name: '스텝 추가' }));
    await user.click(screen.getByRole('button', { name: '스텝 추가' }));

    // 공 도구를 켠다(배치 도구). 도구 레일로 범위를 좁힌다 — 스텝 추가로 놓인 기본 공
    // 개체도 SVG 상에서 동일한 aria-label="공" 을 갖는다.
    const toolRail = screen.getByRole('navigation', { name: '도구' });
    await user.click(within(toolRail).getByRole('button', { name: '공' }));

    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    stage.focus();
    expect(stage).toHaveFocus();

    expect(screen.getByText(/^스텝 1 ·/)).toBeInTheDocument();

    fireEvent.keyDown(stage, { key: 'ArrowRight' });

    // 스텝은 그대로(§7.5d) — 전역 useEditorKeyboard 의 ArrowRight→onNextStep 이 새지 않았다.
    expect(screen.getByText(/^스텝 1 ·/)).toBeInTheDocument();
    // 대신 배치 커서가 실제로 움직였다(라이브 리전에 '칸' 안내가 찍힌다).
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent ?? '').toContain('칸');
  });

  // 감사 2026-08-08 minor #6 회귀 — 이전에는 EditorWorkspace 가 showGrid/showRuleZones 를
  // 로컬 state 로만 들고 있어 prefs 로 되돌아가지 않았다(다른 화면 갔다 오면 리셋).
  it('편집기 격자·규칙존 토글이 prefs 에 반영된다(다른 화면 갔다 와도 유지, minor #6)', async () => {
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());

    expect(loadPrefs().showGrid).toBe(true);
    expect(loadPrefs().showRuleZones).toBe(true);

    await user.click(screen.getByRole('button', { name: '격자 표시 전환' }));
    expect(loadPrefs().showGrid).toBe(false);

    await user.click(screen.getByRole('button', { name: '골 지역 가이드 전환' }));
    expect(loadPrefs().showRuleZones).toBe(false);
  });

  // 감사 2026-08-08 minor #4 회귀 — prefs.defaultCourtMode 가 완전히 죽은 필드였다. 이제
  // CourtPicker 가 그 값을 "기본값" 배지로 강조한다(§6.8 "1회 선택" 원칙은 유지 — 클릭은 여전히
  // 필요하다).
  it('설정의 기본 코트 모드가 코트 선택 화면에서 "기본값" 배지로 강조된다(minor #4)', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'half' }));
    render(<EditorScreen />, { wrapper: Wrapper });

    // 정확히 "하프 코트"인 라벨 텍스트로 카드를 찾는다 — flat 의 설명문("하프 코트에서 라인을
    // 제거한...")에도 부분 문자열로 "하프 코트" 가 들어 있어 느슨한 정규식으로는 두 카드가 모두
    // 매치된다(exact getByText 는 온전한 텍스트가 같아야 매치되므로 그 문제가 없다).
    const halfCard = screen.getByText('하프 코트').closest('button')!;
    expect(within(halfCard).getByText('기본값')).toBeInTheDocument();
    const fullCard = screen.getByText('풀 코트').closest('button')!;
    expect(within(fullCard).queryByText('기본값')).toBeNull();
  });
});

describe('격자 칸 라벨 배선 사슬 (major 회귀: prefs → EditorWorkspace → EditorStage → CourtStage → GridOverlay)', () => {
  // 재감사가 지적한 커버리지 공백을 메운다: GridOverlay 단위 테스트와 SettingsScreen 쓰기
  // 테스트는 있었지만 사슬 중간이 끊겨도 둘 다 통과했다(CourtStage.test 는 false 를 하드코딩).
  // 여기서는 prefs 를 심고 실제 EditorScreen 을 띄워 화면 끝에서 라벨 개수를 센다.
  async function mountWithGridLabels(showGridLabels: boolean) {
    const user = userEvent.setup();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), showGrid: true, showGridLabels }));
    const { container } = render(<EditorScreen />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    return container;
  }

  it('prefs.showGridLabels 가 켜져 있으면 풀 코트에 칸 라벨 30개가 렌더된다', async () => {
    const container = await mountWithGridLabels(true);
    const labels = container.querySelectorAll('.grid-cell-label');
    expect(labels.length).toBe(30); // 6열 × 5행
  });

  it('꺼져 있으면 칸 라벨은 0개이되 격자선은 그대로 남는다', async () => {
    const container = await mountWithGridLabels(false);
    expect(container.querySelectorAll('.grid-cell-label').length).toBe(0);
    // 격자선까지 사라지면 토글의 의미가 달라진다 — 라벨만 꺼져야 한다
    expect(container.querySelectorAll('.grid-line').length).toBeGreaterThan(0);
  });
});
