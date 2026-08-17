// 3.1 — 스텝 메타(이름·메모·시간) 입력 UI. **리듀서·히스토리 병합은 처음부터 다 있었고
// dispatch 하는 곳만 0** 이었다: 시연이 코치에게 읽어 주는 문장(PresentRunner 의 자막)을 앱
// 안에서 만들 방법이 없었다. 그래서 이 스위트는 화면 끝에서 끝까지 한 줄로 본다 —
//   왼쪽 사이드바 카드로 스텝을 고른다 → 인스펙터 [스텝] 구역에 적는다 → STEP_META 가 나간다
//   → 자동저장이 IDB 에 쓴다 → 시연 화면이 그 문장을 읽는다.
// 단위 테스트로 조각내면 그 사이 어느 이음매가 끊겨도 전부 초록불이다(그게 지금까지의 상태였다).
//
// 2026-08-17 재편(PLAN-STEP-EDITING.md 구현 순서 ②) — 스텝을 고르는 자리가 하단 TransportBar
// 의 가로 칩(role=tab)에서 왼쪽 StepSidebar 의 세로 카드로 옮겨갔다. 카드는 "스텝 정보
// 최소화"(기현님 확정)로 이름을 안 보여준다 — 그래서 "이름을 적으면 즉시 따라오는가" 는
// 이제 카드가 아니라 **인스펙터 자신의 [스텝] 목록**(StepsSection, 이름·메모를 그대로
// 보여준다 — 이 재편이 손대지 않은 자리다)으로 본다. 스텝을 "고르는" 조작만 사이드바 카드로
// 옮겼다.
//
// EditorScreen.test.tsx 와 같은 이유로 `../../app/AppShell.tsx` 를 vi.mock 한다 — EditorScreen 이
// 쓰는 것은 useStageTarget 하나인데 실제 파일은 화면 5개를 전부 import 하므로 무관한 이유로
// 힙이 터진다. PresentRunner 는 AppShell 에서 **타입만** 가져오므로(import type, 런타임 소거)
// 이 목과 무관하게 진짜 컴포넌트가 뜬다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');
const { PresentRunner } = await import('../present/PresentRunner.tsx');

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

/** 드릴 하나를 심고 그 편집 화면을 띄운 뒤 인스펙터를 연다(2.2 로 기본 접힘 오버레이다). */
async function openDrillWithInspector() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  return { user, drillId: created.id, view };
}

const nameInput = () => screen.getByLabelText('스텝 이름') as HTMLInputElement;
const noteInput = () => screen.getByLabelText('스텝 메모') as HTMLTextAreaElement;
const secInput = () => screen.getByLabelText('스텝 시간(초)') as HTMLInputElement;
/** 왼쪽 사이드바 카드(2026-08-17). 카드는 번호만 보여준다 — 스텝을 **고르는** 조작은
 *  이걸로, 이름·메모가 **반영됐는지**는 아래 `stepListSpan` 으로 따로 본다. */
const sidebarCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });
/** 인스펙터 [스텝] 목록(StepsSection, 이 재편이 손대지 않은 자리)의 이름/메모 span.
 *  정확히 그 문장을 담은 span 하나를 찾는다 — 없으면 아직 반영 전이라는 뜻이다. */
const stepListSpan = (text: string) => screen.getByText(text, { selector: 'span' });

describe('3.1 스텝 메타 입력 — 카드에서 고르고 인스펙터에서 적는다', () => {
  it('이름·메모를 적으면 STEP_META 가 나가 인스펙터 스텝 목록이 즉시 따라온다', async () => {
    const { user } = await openDrillWithInspector();
    // 대조군 — 적기 전에는 기본 이름이고, 그 문장은 화면 어디에도 없다.
    expect(stepListSpan('스텝 1')).toBeInTheDocument();
    expect(screen.queryByText('벌려서 받는다')).toBeNull();

    await user.clear(nameInput());
    await user.type(nameInput(), '측면 전개');

    // (1) 인스펙터 스텝 목록 = step.name. **포커스를 떼기 전에** 본다 — blur 를 기다려야
    //     반영된다면 "적는 동안 판이 따라온다" 가 거짓이고, 700ms 병합창도 열리지 않는다.
    expect(stepListSpan('측면 전개')).toBeInTheDocument();
    expect(screen.queryByText('스텝 1', { selector: 'span' })).toBeNull();

    await user.type(noteInput(), '벌려서 받는다');
    // 여기도 아직 textarea 에 포커스가 있는 상태다.
    expect(stepListSpan('측면 전개')).toBeInTheDocument();
    // (2) 인스펙터 스텝 목록 = step.note. 두 소비자(이름/메모)를 **따로** 찌른다 — 하나만
    //     봐도 통과하면 name/note 중 한쪽만 배선된 상태가 초록불이 된다.
    //     (textarea 도 같은 글자를 갖고 있으므로 selector 로 목록 쪽만 집는다 — React 는
    //      defaultValue 변경을 node.defaultValue 에 계속 써 넣고, 그게 곧 textarea 의 textContent 다.)
    expect(stepListSpan('벌려서 받는다')).toBeInTheDocument();
  });

  it('시간은 초로 적는다 — 상한을 넘겨 적으면 손을 뗄 때 실제 저장값으로 되비친다', async () => {
    const { user } = await openDrillWithInspector();
    await user.type(secInput(), '999');
    await user.click(nameInput()); // 포커스를 뗀다(= blur)

    // 비제어라 화면과 모델이 갈라질 수 있는 유일한 자리가 클램프다. 되비치지 않으면 화면은
    // "999초" 라고 말하는데 재생은 60초로 도는 상태가 된다.
    expect(secInput().value).toBe('60');

    // 대조군 — 범위 안의 값은 손대지 않는다(무조건 되쓰는 것이 아니다).
    await user.clear(secInput());
    await user.type(secInput(), '3');
    await user.click(nameInput());
    expect(secInput().value).toBe('3');
  });

  it('스텝을 넘기면 입력이 그 스텝 값으로 갈아 끼워진다 — 옛 글자가 남지 않는다 (key={step.id})', async () => {
    const { user } = await openDrillWithInspector();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' })); // 2장째를 찍고 그 장이 선택된다
    expect(sidebarCards()).toHaveLength(2);

    await user.clear(nameInput());
    await user.type(nameInput(), '전개');
    await user.type(noteInput(), '두 번째 장');

    await user.click(sidebarCards()[0]!); // ← 1장째로 돌아간다

    // input 과 textarea 를 **따로** 본다. key 는 요소마다 붙는 것이라 한쪽만 빠뜨릴 수 있고,
    // 완료 판정이 지목한 것도 textarea 쪽이다.
    expect(nameInput().value).toBe('스텝 1');
    expect(noteInput().value).toBe('');

    // 그리고 다시 2장째로 가면 적어 둔 값이 그대로 있다(= 값이 사라진 게 아니라 갈아 끼워졌다).
    await user.click(sidebarCards()[1]!);
    expect(nameInput().value).toBe('전개');
    expect(noteInput().value).toBe('두 번째 장');
  });
});

describe('3.1 되돌리기 — 연속 타이핑은 한 칸이다 (COALESCE_TYPES)', () => {
  it('여러 글자를 이어 쳐도 되돌리기 한 번에 통째로 돌아간다', async () => {
    const { user } = await openDrillWithInspector();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    await user.clear(nameInput());
    await user.type(nameInput(), '측면 전개');
    expect(stepListSpan('측면 전개')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    // 한 칸으로 **통째로** 돌아간다('스텝 2' 는 STEP_ADD 가 새 장에 붙이는 기본 이름이다).
    // 글자마다 커밋이면 여기서 '측면 전' 처럼 잘린 이름이 남는다.
    expect(stepListSpan('스텝 2')).toBeInTheDocument();
    // 그리고 그 한 칸이 타이핑만 먹었다 — 스텝 추가까지 함께 지워지면 안 된다(AND 분리).
    expect(sidebarCards()).toHaveLength(2);
  });

  it('대조군: 스텝이 다르면 합쳐지지 않는다 — 한 칸은 방금 그 스텝만 지운다', async () => {
    const { user } = await openDrillWithInspector();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));

    await user.click(sidebarCards()[0]!);
    await user.clear(nameInput());
    await user.type(nameInput(), '가나');

    await user.click(sidebarCards()[1]!);
    await user.clear(nameInput());
    await user.type(nameInput(), '다라');

    expect(stepListSpan('가나')).toBeInTheDocument();
    expect(stepListSpan('다라')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    // 병합 키가 `STEP_META:${스텝 id}` 라서 두 스텝의 타이핑은 서로 다른 칸이다.
    expect(stepListSpan('스텝 2')).toBeInTheDocument();
    expect(stepListSpan('가나')).toBeInTheDocument();
  });
});

describe('3.1 여기서 적은 문장을 시연이 읽는다', () => {
  it('자동저장 → IDB 왕복 → PresentRunner 자막', async () => {
    const { user, drillId, view } = await openDrillWithInspector();
    await user.clear(nameInput());
    await user.type(nameInput(), '측면 전개');
    await user.type(noteInput(), '오른쪽으로 벌린다');
    await user.type(secInput(), '3');

    // 화면 전환 = 이 훅의 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.
    view.unmount();

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      // 저장 → 다시 읽기. validate.ts 화이트리스트 조립부를 실제로 통과한 값만 여기 남는다 —
      // 세 필드를 따로 단언한다(하나만 보면 나머지가 조용히 증발해도 초록불이다).
      expect(saved?.steps[0]?.name).toBe('측면 전개');
      expect(saved?.steps[0]?.note).toBe('오른쪽으로 벌린다');
      expect(saved?.steps[0]?.durationMs).toBe(3000);
    });

    render(<PresentRunner target={{ kind: 'drill', drillId }} nav={{ back: vi.fn() }} />, { wrapper: Wrapper });
    expect(await screen.findByText('측면 전개')).toBeInTheDocument();
    expect(screen.getByText('오른쪽으로 벌린다')).toBeInTheDocument();
  });
});
