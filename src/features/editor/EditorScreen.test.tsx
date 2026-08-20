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
import { makeDefaultPrefs, savePrefs } from '../../storage/prefs.ts';
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
  // 드릴 편집 튜토리얼이 자동 시작하면(§0.5, tutorialsSeen 미지정) 스포트라이트가 Esc·
  // 화살표를 가로채 아래 키보드 배선 테스트가 깨진다 — 여긴 튜토리얼을 보는 테스트가
  // 아니므로 "이미 봤다" 상태로 시작한다.
  savePrefs({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true } });
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

describe('드릴 편집 모드', () => {
  it('저장된 드릴을 열면 도구·코트가 뜨고, [속성]·인스펙터는 어디에도 없다 (2026-08-18 폐기)', async () => {
    const { stage } = await openDrill();
    expect(stage).toBeInTheDocument();
    // 기현님 지시(*"속성 버튼 및 그 안의 내용 폐기"*) — 손잡이도 패널도 DOM 에 없다.
    // 옛 openInspector 헬퍼([속성] 클릭 → complementary)는 이 it 과 함께 은퇴했다.
    expect(screen.queryByRole('button', { name: '속성' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
  });

  // 2026-08-14(설계서 §5-P2): 뷰 컨트롤이 코트 위에서 **하단 바**로 내려왔다. 하단 바는
  // 화면마다 다른 컴포넌트다(전술판 BoardBar / 드릴 편집 TransportBar) — BoardScreen 쪽만
  // 확인하면 **드릴 편집에서만 손잡이가 없는** 갈래를 못 본다(5차 검증관이 '시연 화면만
  // 놓쳤던' 것과 같은 형태의 헛통과다).
  it('★ 드릴 이름은 헤더에 있다 — 2026-08-20 재설계로 넓은 창에도 헤더가 서면서 사이드바의 옛 이름 편집기는 철거됐다', async () => {
    // 옛 기록(2026-08-18): 이름 편집을 헤더에만 배선했다가 넓은 창(헤더 없음)에서 이름이
    // 어디에도 안 보였다 — 기현님 실기 지적("드릴 이름은 어디 있음?"). 그래서 그때는
    // 사이드바 맨 위로 옮겼다. 2026-08-20(§A, 기현님 지시 "편집·시연 화면이 비슷한
    // 레이아웃이어야 ux가 좋아진다")로 드릴 편집이 넓은 창에서도 헤더를 도로 얻으면서 그
    // 전제가 사라졌고, 사이드바의 이름 편집기는 같은 것을 고치는 칸이 둘이 되어 철거됐다
    // (StepSidebar.tsx §G) — 헤더가 다시 유일한 자리다.
    await openDrill();
    const header = document.querySelector('header')!;
    const name = await screen.findByRole('button', { name: /^드릴 이름: .+\. 눌러서 수정$/ });
    expect(header.contains(name), '이름이 헤더 밖이다').toBe(true);
    const sidebar = screen.getByRole('navigation', { name: '스텝 목록' });
    expect(sidebar.contains(name), '이름 편집기가 사이드바에도 중복으로 남아 있다').toBe(false);
  });

  it('★ 하단 바는 없다 — 재생·배속은 코트 아래 공용 재생 묶음이고, [보기]와 줌은 오른쪽 기둥이다 (2026-08-20)', async () => {
    // 옛 계약(2026-08-15 재설계 ②): *"하단 바에 남은 조작은 [속성] 하나."* 2026-08-18 하단
    // 철거로 그 바 자체가 사라지며 재생 버튼이 왼쪽 스텝 바 안으로 들어갔었다. 2026-08-20
    // (§D, 편집·시연 공용 PlaybackControls)에 재생 묶음이 스텝 바를 나와 코트 아래(노트
    // 옆, 최우측)로 다시 옮겼다 — 스텝 목록 자체는 사이드바에 남지만 재생은 이제 그 밖이다.
    await openDrill();
    const sidebar = screen.getByRole('navigation', { name: '스텝 목록' });
    const play = screen.getByRole('button', { name: '재생' });
    const speed = screen.getByRole('button', { name: /^재생 속도/ });
    expect(sidebar.contains(play), '재생이 여전히 스텝 바 안에 있다').toBe(false);
    expect(sidebar.contains(speed), '배속이 여전히 스텝 바 안에 있다').toBe(false);

    // [보기]는 이제 기둥 안이다 — 하단 바가 아니라.
    const bar = screen.getByRole('navigation', { name: '판 조작' });
    expect(bar.contains(screen.getByRole('button', { name: '보기' })), '[보기]가 기둥 밖에 있다').toBe(true);
    // 줌도 기둥이다. 옛 트레이 묶음(role=group '확대')은 **사라졌다** — 그 이사가 ①이다.
    for (const name of ['확대', '축소', '배율 100%']) {
      expect(bar.contains(screen.getByRole('button', { name })), name).toBe(true);
    }
    expect(screen.queryByRole('group', { name: '확대' }), '트레이의 옛 줌 묶음이 남아 있다').toBeNull();
    // 코트 위 묶음은 해체된 그대로다 — 격자·가이드는 [보기] 서랍을 열어야 나온다.
    expect(screen.queryByRole('button', { name: '격자 표시 전환' })).toBeNull();
    // ⚠️ 2026-08-16 — [도움말]만은 예외다. 서랍 밖으로 나와 **기둥 상시 칸**이 됐다(기현 지시):
    // 길을 잃었을 때 여는 문이 다른 메뉴 안에 있으면 길찾기를 한 번 더 시키는 셈이다.
    expect(bar.contains(screen.getByRole('button', { name: '도움말' })), '[도움말]이 기둥 밖이다').toBe(true);
  });

  /** 사이드바 카드. 이름은 안 보여주므로(§"스텝 정보 최소화") aria-label 은 순번뿐이다 —
   *  현재 스텝은 aria-current="step" 으로 찾는다. 인스펙터의 옛 [스텝] 목록도 이름이 기본값
   *  '스텝 N' 일 때는 같은 접근성 이름을 내므로, 사이드바 `<nav>` 안으로 **좁혀서** 찾는다. */
  const stepCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });
  const currentStepCard = () => stepCards().find((c) => c.getAttribute('aria-current') === 'step')!;

  it('전술판과 달리 스텝 UI 가 있다', async () => {
    // 재편의 갈림점 — 같은 컴포넌트지만 여기서만 스텝이 산다(EditorWorkspace 의 mode prop).
    await openDrill();
    // 2026-08-17 재편(구현 순서 ②): 스텝 목록은 왼쪽 세로 사이드바다. 인스펙터를 열지 않아도
    // 스텝 조작이 화면에 있어야 한다 — 그것이 이 항목의 목적이다.
    expect(screen.getByRole('navigation', { name: '스텝 목록' })).toBeInTheDocument();
    expect(stepCards()).toHaveLength(1);
    expect(currentStepCard()).toHaveAccessibleName('스텝 1');
    expect(screen.getByRole('button', { name: '한 장 더 찍기' })).toBeInTheDocument();
  });

  // §4.4 P2-3 — "[한 장 더 찍기] 1버튼". 인스펙터(오버레이)를 열고 26×22 버튼을 찾아 누르던
  // 경로가 사이드바의 44px 버튼 **한 번**이 됐는지, 그리고 찍은 뒤 그 장이 손에 들리는지 본다.
  // 찍고도 옛 장이 선택돼 있으면 다음 조작이 엉뚱한 판에 들어간다.
  // ⚠️ 2026-08-17 재편(PLAN-STEP-EDITING.md §스텝 카드, 기현님 확정) — 여기 있던 대조군
  // ("인스펙터의 [스텝 추가]는 선택을 안 옮긴다")은 그 두 번째 경로 자체(StepsSection)가
  // 철거되며 함께 사라졌다. [한 장 더 찍기]가 이제 스텝을 늘리는 유일한 버튼이다.
  it('[한 장 더 찍기] 한 번으로 새 장이 뒤에 쌓이고 그 장이 선택된다', async () => {
    const { user } = await openDrill();
    expect(stepCards()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));

    expect(stepCards()).toHaveLength(2);
    expect(currentStepCard()).toHaveAccessibleName('스텝 2');
  });

  it('코트 형태는 드릴 레벨 불변이다 (D12) — 잠긴 채로 뜬다', async () => {
    // 전술판에서 열리는 그 세그먼트가 드릴에서는 절대 열리면 안 된다. 열리는 순간
    // full↔half 전환이 배치를 날린다(D12: 어떤 아핀 변환으로도 같은 전술이 안 된다).
    const { user } = await openDrill();
    // ⚠️ 2026-08-15 (재설계 ②) — 세그먼트가 **헤더에서 기능 바 [코트] 팝오버로** 옮겨 갔다.
    //    옛 계약(잠긴 이름 '코트 형태(변경 불가)' + 눌러도 안 바뀜)은 한 글자도 안 바뀌었다 —
    //    바뀐 것은 그 물음을 어디서 하느냐뿐이다.
    expect(screen.queryByRole('radiogroup', { name: /코트 형태/ }), '팝오버를 열기 전에 이미 떠 있다').toBeNull();
    await user.click(screen.getByRole('button', { name: '코트 형태와 크기' }));
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

    // 스텝 3개로 만든다(기본 1개 + [한 장 더 찍기] 2회 — 2026-08-17 재편으로 스텝을 늘리는
    // 유일한 버튼이다). 그 버튼은 찍을 때마다 새 장을 선택하므로(§4.4 P2-3), 이 테스트가
    // 보려는 '스텝 1에서 ArrowRight' 를 재현하려면 다 찍고 나서 첫 카드로 되돌아온다.
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    await user.click(stepCards()[0]!);

    // 공 도구를 켠다(배치 도구). 도구 레일로 범위를 좁힌다 — 스텝 추가로 놓인 기본 공
    // 개체도 SVG 상에서 동일한 aria-label="공" 을 갖는다.
    const toolRail = screen.getByRole('navigation', { name: '도구' });
    await user.click(within(toolRail).getByRole('button', { name: '공' }));

    stage.focus();
    expect(stage).toHaveFocus();
    // '지금 몇 번째 스텝인가' 의 출처는 왼쪽 사이드바의 현재 카드다(aria-current="step").
    expect(currentStepCard()).toHaveAccessibleName('스텝 1');

    fireEvent.keyDown(stage, { key: 'ArrowRight' });

    // 스텝은 그대로(§7.5d) — 전역 useEditorKeyboard 의 ArrowRight→onNextStep 이 새지 않았다.
    expect(currentStepCard()).toHaveAccessibleName('스텝 1');
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
