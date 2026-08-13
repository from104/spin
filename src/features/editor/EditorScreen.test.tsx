// §10.8 화면 스모크 — **드릴 편집 모드**. 자유 전술판과 같은 자리(board)에 같은 컴포넌트
// (EditorWorkspace)로 뜨되, 전술판에 없는 것들(스텝·트랜스포트·자동저장·코트 불변)이 여기서만
// 살아 있는지 확인한다. 판을 그리는 부분 자체는 BoardScreen.test.tsx 가 덮는다.
//
// `../../app/AppShell.tsx` 를 vi.mock 으로 대체한다: EditorScreen 이 필요로 하는 건
// `useStageTarget()` 하나뿐인데 그 실제 파일은 화면 5개를 전부 import 하므로, 이 화면과 무관한
// 이유로 테스트가 깨지는 것을 막는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { DrillId } from '../../core/ids.ts';

// ⚠️ 목은 **참조가 안정적인** 객체를 돌려줘야 한다. 렌더마다 새 객체를 만들면 EditorScreen 의
// `useEffect([target, toast])` 가 매 렌더 재실행 → setState → 재렌더로 무한 루프가 돌아
// 워커가 힙을 다 쓰고 죽는다(실제로 겪었다). 실제 앱에서는 AppShell 의 state 가 이 참조를
// 안정적으로 들고 있으므로 같은 조건이다.
let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <HeaderProvider>
          <AppNavProvider value={nav}>
            <AppHeader />
            {children}
          </AppNavProvider>
        </HeaderProvider>
        <LiveRegion />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

/** 저장소에 드릴 하나를 심고 그것을 여는 드릴 편집 화면을 띄운다. */
async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, drill: created, stage: screen.getByRole('application', { name: '코트 편집 영역' }) };
}

/** [속성]으로 인스펙터를 편다 — 2026-08-12 결정 ③A 로 기본 접힘 오버레이가 됐다.
 *  (2026-08-14: 그 손잡이는 코트 우상단이 아니라 **하단 바**다 — 설계서 §3-ㄴ.) */
async function openInspector(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '속성' }));
  return screen.getByRole('complementary', { name: '드릴 속성' });
}

describe('드릴 편집 모드', () => {
  it('저장된 드릴을 열면 도구·코트가 뜨고, [속성]으로 인스펙터를 붙일 수 있다', async () => {
    const { stage, user } = await openDrill();
    expect(stage).toBeInTheDocument();
    // 기본 접힘 — 판을 덮지 않는다.
    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
    expect(await openInspector(user)).toBeInTheDocument();
  });

  // 2026-08-14(설계서 §5-P2): 뷰 컨트롤이 코트 위에서 **하단 바**로 내려왔다. 하단 바는
  // 화면마다 다른 컴포넌트다(전술판 BoardBar / 드릴 편집 TransportBar) — BoardScreen 쪽만
  // 확인하면 **드릴 편집에서만 손잡이가 없는** 갈래를 못 본다(5차 검증관이 '시연 화면만
  // 놓쳤던' 것과 같은 형태의 헛통과다).
  it('뷰 컨트롤 두 손잡이가 트랜스포트 바 안에 있다 — 판을 그리는 화면이 둘이다', async () => {
    await openDrill();
    const barRow = screen.getByRole('button', { name: '재생' }).closest('div')!.parentElement!;
    for (const name of ['보기', '속성']) {
      expect(barRow.contains(screen.getByRole('button', { name })), name).toBe(true);
    }
    // 코트 위 묶음은 해체됐다 — 격자·가이드·도움말은 팝오버를 열어야 나온다.
    expect(screen.queryByRole('button', { name: '격자 표시 전환' })).toBeNull();
    expect(screen.getByRole('group', { name: '확대' })).toBeInTheDocument();
  });

  it('전술판과 달리 스텝 UI 가 있다', async () => {
    // 재편의 갈림점 — 같은 컴포넌트지만 여기서만 스텝이 산다(EditorWorkspace 의 mode prop).
    const { user } = await openDrill();
    // 2.10 재편: 하단 바가 **스텝 사진 뭉치**다(옛 "스텝 1 · 이름" 라벨줄은 칩 안으로 들어갔다).
    // 인스펙터를 열지 않아도 스텝 조작이 화면에 있어야 한다 — 그것이 P2-3 의 목적이다.
    expect(screen.getByRole('tablist', { name: '스텝' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^스텝 1/);
    expect(screen.getByRole('button', { name: '한 장 더 찍기' })).toBeInTheDocument();
    await openInspector(user);
    expect(screen.getByRole('button', { name: '스텝 추가' })).toBeInTheDocument();
  });

  // §4.4 P2-3 — "[한 장 더 찍기] 1버튼". 인스펙터(오버레이)를 열고 26×22 버튼을 찾아 누르던
  // 경로가 하단 바의 44px 버튼 **한 번**이 됐는지, 그리고 찍은 뒤 그 장이 손에 들리는지 본다.
  // 찍고도 옛 장이 선택돼 있으면 다음 조작이 엉뚱한 판에 들어간다.
  it('[한 장 더 찍기] 한 번으로 새 장이 뒤에 쌓이고 그 장이 선택된다', async () => {
    const { user } = await openDrill();
    expect(screen.getAllByRole('tab')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^스텝 2/);

    // 대조군 — 인스펙터의 [스텝 추가]는 이 경로가 아니다(목록이 통째로 보이는 자리라 선택을
    // 옮기지 않는다). 여기가 함께 움직이면 두 경로가 한 배선을 공유하게 된 것이다.
    await openInspector(user);
    await user.click(screen.getByRole('button', { name: '스텝 추가' }));
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^스텝 2/);
  });

  it('코트 형태는 드릴 레벨 불변이다 (D12) — 잠긴 채로 뜬다', async () => {
    // 전술판에서 열리는 그 세그먼트가 드릴에서는 절대 열리면 안 된다. 열리는 순간
    // full↔half 전환이 배치를 날린다(D12: 어떤 아핀 변환으로도 같은 전술이 안 된다).
    const { user } = await openDrill();
    // 헤더는 useAppHeader 의 effect 로 채워지므로 첫 페인트 직후에는 아직 비어 있다.
    const locked = await screen.findByRole('radiogroup', { name: '코트 형태(변경 불가)' });
    expect(screen.queryByRole('radiogroup', { name: '코트 형태' })).toBeNull();

    await user.click(within(locked).getByRole('radio', { name: /하프/ }));
    expect(within(locked).getByRole('radio', { name: /풀/ })).toHaveAttribute('aria-checked', 'true');
  });

  // §7.5d 회귀 — 배치 도구 활성 + 코트 포커스일 때 ArrowLeft/Right 는 배치 커서만 움직여야
  // 한다(useEditorKeyboard 의 전역 스텝 이동과 이중 발화 금지). 감사 evidence 재현: 스텝 3개 +
  // 공 도구 선택 + 코트 포커스 상태에서 ArrowRight 1회 → 스텝 표시는 그대로, 커서만 이동한다.
  it('배치 도구 + 코트 포커스에서 ArrowRight 는 스텝을 넘기지 않고 배치 커서만 이동한다(§7.5d)', async () => {
    const { user, stage } = await openDrill();

    // 스텝 3개로 만든다(기본 1개 + 추가 2회). 스텝 추가는 인스펙터 안에 있다.
    await openInspector(user);
    await user.click(screen.getByRole('button', { name: '스텝 추가' }));
    await user.click(screen.getByRole('button', { name: '스텝 추가' }));
    // 시트를 닫아 코트를 원래대로 되돌린다 — 이 테스트가 보려는 것은 키 입력 경로다.
    await user.click(screen.getByRole('button', { name: '속성 닫기' }));

    // 공 도구를 켠다(배치 도구). 도구 레일로 범위를 좁힌다 — 스텝 추가로 놓인 기본 공
    // 개체도 SVG 상에서 동일한 aria-label="공" 을 갖는다.
    const toolRail = screen.getByRole('navigation', { name: '도구' });
    await user.click(within(toolRail).getByRole('button', { name: '공' }));

    stage.focus();
    expect(stage).toHaveFocus();
    // 2.10 이후 '지금 몇 번째 스텝인가' 의 출처는 라벨줄이 아니라 선택된 사진 칩이다.
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^스텝 1/);

    fireEvent.keyDown(stage, { key: 'ArrowRight' });

    // 스텝은 그대로(§7.5d) — 전역 useEditorKeyboard 의 ArrowRight→onNextStep 이 새지 않았다.
    expect(screen.getByRole('tab', { selected: true })).toHaveAccessibleName(/^스텝 1/);
    // 대신 배치 커서가 실제로 움직였다(라이브 리전에 '칸' 안내가 찍힌다).
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent ?? '').toContain('칸');
  }, 30000);

  // §4.3 P1-2 [A-3] — Esc = 선택 해제(전역). 2단 히트(1.6) 이후 붐비는 코트에서 "빈 곳 탭 →
  // 해제" 가 사라지므로, 포커스가 어디에 있든 통하는 해제 수단이 있어야 한다. EditorStage
  // 컨테이너의 Esc(§7.5c)는 **코트에 포커스가 있을 때만** 듣는다 — 여기서는 포커스를 코트
  // 밖으로 빼서 EditorWorkspace 의 전역 배선(useEditorKeyboard.onSelectionClear)만 남긴다.
  it('Esc 는 포커스가 코트 밖에 있어도 선택을 해제한다 ([A-3] 전역 경로)', async () => {
    const { stage } = await openDrill();
    const chair = stage.querySelector('.court-obj') as SVGGElement;

    chair.focus();
    fireEvent.keyDown(chair, { key: 'Enter' }); // §7.5c SELECT_TOGGLE
    expect(chair).toHaveAttribute('aria-pressed', 'true');

    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(chair).toHaveAttribute('aria-pressed', 'false');
  }, 30000);
});
