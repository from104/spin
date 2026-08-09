// §6.9 시연 화면 — PresentRunner(target/nav 를 prop 으로 받는 테스트 가능한 내부)를 직접
// 검증한다. app-shell 이 export 하지 않는 PresentTargetContext 를 우회하는 이유는 파일 헤더
// 주석(§6.9 화면) 참고.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { PresentRunner } from './PresentRunner.tsx';
import type { PresentNav } from './PresentRunner.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { HeaderProvider, AppHeader } from '../../app/AppHeader.tsx';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession, addDrillToSession } from '../../storage/sessionRepo.ts';
import { newId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import type { DrillId, SessionId } from '../../core/ids.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <ToastProvider>
      <HeaderProvider>
        <AppHeader />
        {children}
      </HeaderProvider>
    </ToastProvider>
  </SettingsProvider>
);

function makeNav(): PresentNav {
  return { back: vi.fn() };
}

let seq = 0;

/** 2 스텝짜리 드릴 하나를 만든다 — 스텝 이름/메모로 전환을 확인할 수 있게 한다. */
async function makeTwoStepDrill(title?: string): Promise<Drill> {
  const tag = `#${++seq}`;
  const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: title ?? `테스트 드릴 ${tag}`, durationMin: 5 });
  const step1 = { ...base.steps[0]!, id: newId('st'), name: '준비 자세', note: '시작 위치에서 대기합니다.' };
  const step2 = {
    ...base.steps[0]!,
    id: newId('st'),
    name: '전개',
    note: '두 번째 스텝입니다.',
    chairs: Object.fromEntries(Object.entries(base.steps[0]!.chairs).map(([id, p]) => [id, { ...p!, x: p!.x + 40 }])),
  };
  return idbDrillRepo.putDrill({ ...base, steps: [step1, step2] }, { touch: false });
}

describe('PresentRunner — 대상 없음/에러', () => {
  it('target 이 null 이면 빈 상태 + [목록으로]', async () => {
    const nav = makeNav();
    render(<PresentRunner target={null} nav={nav} />, { wrapper });
    expect(await screen.findByText('시연할 드릴을 목록에서 선택하세요.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }));
    expect(nav.back).toHaveBeenCalledWith('library');
  });

  it('존재하지 않는 드릴이면 에러 상태를 보여준다', async () => {
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: 'dr_missing' as DrillId }} nav={nav} />, { wrapper });
    expect(await screen.findByText(/드릴을 찾을 수 없습니다/)).toBeInTheDocument();
  });

  it('존재하지 않는 세션이면 에러 상태를 보여준다', async () => {
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'session', sessionId: 'se_missing' as SessionId }} nav={nav} />, { wrapper });
    expect(await screen.findByText(/세션을 찾을 수 없습니다/)).toBeInTheDocument();
  });
});

describe('PresentRunner — 단일 드릴 시연', () => {
  it('첫 스텝을 보여주고, [다음 스텝]으로 전환하면 이름·메모·진행 표시가 바뀐다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });

    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());
    expect(screen.getByText('시작 위치에서 대기합니다.')).toBeInTheDocument();
    expect(screen.getByText('STEP 1/2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다음 스텝' }));
    await waitFor(() => expect(screen.getByText('전개')).toBeInTheDocument());
    expect(screen.getByText('STEP 2/2')).toBeInTheDocument();
  });

  it('스텝 진행바 버튼을 클릭하면 해당 스텝으로 바로 이동한다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '2번 스텝으로 이동' }));
    await waitFor(() => expect(screen.getByText('전개')).toBeInTheDocument());
  });

  it('재생 버튼을 누르면 라벨이 일시정지로 바뀐다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(await screen.findByRole('button', { name: '일시정지' })).toBeInTheDocument();
  });

  it('→ 키로 다음 스텝, ← 키로 이전 스텝으로 이동한다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText('전개')).toBeInTheDocument());

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());
  });

  it('우상단 [시연 종료]·헤더 [편집으로] 모두 nav.back(\'editor\') 를 부른다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '시연 종료' }));
    // 재편으로 편집기가 home 자리로 들어왔다 — 시연을 나가면 그 드릴 편집으로 돌아간다.
    expect(nav.back).toHaveBeenCalledWith('home');

    await userEvent.click(screen.getByRole('button', { name: '편집으로' }));
    expect(nav.back).toHaveBeenCalledTimes(2);
  });

  it('Shift+? 로 도움말 오버레이가 열리고 Esc 로 닫힌다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());

    await userEvent.keyboard('{Shift>}?{/Shift}');
    const dialog = await screen.findByRole('dialog', { name: '시연 단축키' });
    expect(within(dialog).getByText('다음 스텝')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '시연 단축키' })).not.toBeInTheDocument());
  });
});

describe('PresentRunner — 세션 시연', () => {
  it('세션 진행 표시 + [목록으로] 헤더, N 키로 다음 드릴 인터스티셜을 보여준다', async () => {
    const d1 = await makeTwoStepDrill('세션 드릴 A');
    const d2 = await makeTwoStepDrill('세션 드릴 B');
    const session = await createSession({ title: `세션 ${++seq}` });
    await addDrillToSession(session.id, d1.id);
    await addDrillToSession(session.id, d2.id);

    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'session', sessionId: session.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '목록으로' })).toBeInTheDocument();
    expect(screen.getByLabelText('세션 진행 1/2')).toBeInTheDocument();
    expect(screen.getByLabelText('1번째 드릴: 세션 드릴 A')).toBeInTheDocument();

    await userEvent.keyboard('n');
    expect(await screen.findByText('세션 드릴 B', { selector: 'span' })).toBeInTheDocument();
  }, 8000);

  it('인터스티셜 2초 뒤 실제로 다음 드릴 화면으로 전환된다', async () => {
    const d1 = await makeTwoStepDrill('전환 드릴 A');
    const d2 = await makeTwoStepDrill('전환 드릴 B');
    const session = await createSession({ title: `세션 전환 ${++seq}` });
    await addDrillToSession(session.id, d1.id);
    await addDrillToSession(session.id, d2.id);

    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'session', sessionId: session.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText('준비 자세')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '2번째 드릴: 전환 드릴 B' }));
    await waitFor(() => expect(screen.getByLabelText('세션 진행 2/2')).toBeInTheDocument(), { timeout: 3000 });
  }, 8000);
});

describe('세션 드릴 전환 — 전환 안내 중 코트 상태', () => {
  /** 오브젝트의 transform 을 모아 위치 지문을 만든다. */
  function poseFingerprint(): string {
    return Array.from(document.querySelectorAll('g[transform]'))
      .map((g) => g.getAttribute('transform')!)
      .filter((t) => t.startsWith('translate'))
      .join('|');
  }

  /** 전 개체를 dx 만큼 옮긴 1스텝 드릴 — 두 드릴의 위치가 확실히 다르게 만든다. */
  async function makeShiftedDrill(title: string, dx: number): Promise<Drill> {
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title, durationMin: 5 });
    const s0 = base.steps[0]!;
    const step = {
      ...s0,
      id: newId('st'),
      name: `${title} 스텝`,
      chairs: Object.fromEntries(Object.entries(s0.chairs).map(([id, p]) => [id, { ...p!, x: p!.x + dx }])),
    };
    return idbDrillRepo.putDrill({ ...base, steps: [step] }, { touch: false });
  }

  it('"다음 드릴" 안내가 떠 있는 2초 동안에도 코트는 이미 새 드릴 배치를 보여준다', async () => {
    // 회귀: 예전에는 드릴 교체가 통째로 2초 setTimeout 안에 있어서, 안내가 "다음 드릴: B" 를
    // 알리는 내내 코트가 A 의 위치에 머물렀다. 체육관에서 보면 전환이 실패한 것처럼 보인다.
    const user = userEvent.setup();
    const a = await makeShiftedDrill(`전환A ${++seq}`, 0);
    const b = await makeShiftedDrill(`전환B ${seq}`, 250);
    const session = await createSession({ title: `전환 세션 ${seq}` });
    await addDrillToSession(session.id, a.id);
    await addDrillToSession(session.id, b.id);

    render(<PresentRunner target={{ kind: 'session', sessionId: session.id }} nav={makeNav()} />, { wrapper });
    await screen.findByRole('img', { name: /시연 화면/ });
    await waitFor(() => expect(poseFingerprint().length).toBeGreaterThan(0));
    const atA = poseFingerprint();

    await user.click(screen.getByRole('button', { name: '다음 스텝' }));

    // 안내 오버레이가 아직 떠 있는 시점(2초 이내)에 코트가 이미 바뀌어 있어야 한다.
    await waitFor(() => expect(poseFingerprint()).not.toBe(atA), { timeout: 1500 });
    expect(screen.queryAllByText(new RegExp(`전환B ${seq}`)).length).toBeGreaterThan(0);
  }, 30000);
});
