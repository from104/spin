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
import { createSession, addDrillToSession, getSession, putSession } from '../../storage/sessionRepo.ts';
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
  return { back: vi.fn(), go: vi.fn() };
}

let seq = 0;

// 과제⑦(기현님 확정 2026-08-17) — 스텝 이름 필드는 폐기됐다: 새 규약은 스텝 텍스트를
// note 에 직접 쓴다(name 은 항상 ''). 두 스텝을 note 내용만으로 구분한다.
const STEP1_NOTE = '준비 자세 — 시작 위치에서 대기합니다.';
const STEP2_NOTE = '전개 — 두 번째 스텝입니다.';

/** 2 스텝짜리 드릴 하나를 만든다 — 스텝 note 로 전환을 확인할 수 있게 한다. */
async function makeTwoStepDrill(title?: string): Promise<Drill> {
  const tag = `#${++seq}`;
  const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: title ?? `테스트 드릴 ${tag}`, durationMin: 5 });
  const step1 = { ...base.steps[0]!, id: newId('st'), note: STEP1_NOTE };
  const step2 = {
    ...base.steps[0]!,
    id: newId('st'),
    note: STEP2_NOTE,
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
    expect(nav.back).toHaveBeenCalledWith('drills');
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
  it('첫 스텝을 보여주고, [다음 스텝]으로 전환하면 메모·진행 표시가 바뀐다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });

    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
    expect(screen.getByText('STEP 1/2')).toBeInTheDocument();
    // 음의 대조군(검증 결함 수정, 2026-08-17): 과제⑦ 이전엔 이름 헤드라인이
    // `{name || '이름 없음'}` 으로 상시 노출됐다 — name 은 항상 ''이므로 옛 코드가 되살아나면
    // 이 자리표시자가 어디서든 다시 나타난다. 헤드라인 자체가 없다는 것을 이걸로 잡는다.
    expect(screen.queryByText('이름 없음')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '다음 스텝' }));
    await waitFor(() => expect(screen.getByText(STEP2_NOTE)).toBeInTheDocument());
    expect(screen.getByText('STEP 2/2')).toBeInTheDocument();
    expect(screen.queryByText('이름 없음')).toBeNull();
  });

  it('스텝 진행바 버튼을 클릭하면 해당 스텝으로 바로 이동한다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '2번 스텝으로 이동' }));
    await waitFor(() => expect(screen.getByText(STEP2_NOTE)).toBeInTheDocument());
  });

  it('재생 버튼을 누르면 라벨이 일시정지로 바뀐다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(await screen.findByRole('button', { name: '일시정지' })).toBeInTheDocument();
  });

  // 2026-08-20 §F — 끝 스텝에서 [재생] = 처음으로 되감고 재생. loop 설정과 무관하다(loop 는
  // "재생 중 끝에 닿았을 때" 만 맡는다 — 둘이 안 겹친다).
  it('끝 스텝에서 [재생] 을 누르면 처음 스텝으로 되감고 재생한다(loop 꺼짐, §F)', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '2번 스텝으로 이동' }));
    await waitFor(() => expect(screen.getByText(STEP2_NOTE)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(await screen.findByRole('button', { name: '일시정지' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
  });

  it('끝 스텝에서 [재생] — 반복이 켜져 있어도 같은 되감기가 일어난다(loop 켜짐, §F)', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    const loopBtn = screen.getByRole('button', { name: /^반복/ });
    if (loopBtn.getAttribute('aria-pressed') !== 'true') await userEvent.click(loopBtn);
    expect(screen.getByRole('button', { name: /^반복/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: '2번 스텝으로 이동' }));
    await waitFor(() => expect(screen.getByText(STEP2_NOTE)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '재생' }));
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
  });

  it('→ 키로 다음 스텝, ← 키로 이전 스텝으로 이동한다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByText(STEP2_NOTE)).toBeInTheDocument());

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
  });

  it("Esc 는 뒤로(back), 헤더 [편집으로]는 그 드릴 편집으로 **명시 이동**한다 (C12)", async () => {
    // 2026-08-19 기현님 실기 지적 — [편집으로]가 back 이라 목록에서 들어오면 목록으로
    // 되돌아갔다. 이제 라벨이 약속한 목적지(그 드릴의 편집 화면)로 간다.
    // 2026-08-20 후속(기현님 지시 — "시연 모드에서 오른쪽 기능바에서 x버튼 지우기") — 우상단
    // [시연 종료] 버튼이 없어졌다. 나가는 길은 이제 Esc 뿐이다(fullscreen.state==='off' 인
    // 테스트 환경에서는 키다운 핸들러가 바로 exit() 를 부른다).
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    expect(nav.back).toHaveBeenCalledWith('board'); // 종료는 여전히 "들어온 자리로"

    await userEvent.click(screen.getByRole('button', { name: '편집으로' }));
    expect(nav.go).toHaveBeenCalledWith('board', { kind: 'drill', id: drill.id });
    expect(nav.back).toHaveBeenCalledTimes(1); // 편집으로 가는 길은 back 이 아니다
  });

  it('Shift+? 로 도움말 오버레이가 열리고 Esc 로 닫힌다', async () => {
    const drill = await makeTwoStepDrill();
    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.keyboard('{Shift>}?{/Shift}');
    const dialog = await screen.findByRole('dialog', { name: '시연 단축키' });
    expect(within(dialog).getByText('다음 스텝')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '시연 단축키' })).not.toBeInTheDocument());
  });
});

describe('PresentRunner — 세션 시연', () => {
  it('세션 진행 표시 + [세션으로] 헤더, N 키로 다음 드릴 인터스티셜을 보여준다', async () => {
    const d1 = await makeTwoStepDrill('세션 드릴 A');
    const d2 = await makeTwoStepDrill('세션 드릴 B');
    const session = await createSession({ title: `세션 ${++seq}` });
    await addDrillToSession(session.id, d1.id);
    await addDrillToSession(session.id, d2.id);

    const nav = makeNav();
    render(<PresentRunner target={{ kind: 'session', sessionId: session.id }} nav={nav} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '세션으로' })).toBeInTheDocument(); // C12 — 그 세션 편집으로 명시 이동
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
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '2번째 드릴: 전환 드릴 B' }));
    await waitFor(() => expect(screen.getByLabelText('세션 진행 2/2')).toBeInTheDocument(), { timeout: 3000 });
  }, 8000);
});

describe('PresentRunner — 드릴 정보 모달·메모 칩·격자 (C11)', () => {
  it('ⓘ [드릴 정보]가 읽기 전용 모달을 열고, 헤더 [×]로 닫힌다', async () => {
    const d = await makeTwoStepDrill(`정보 드릴 ${++seq}`);
    await idbDrillRepo.putDrill({ ...d, objective: '정보 모달 목적', equipment: '공 3개' }, { touch: false });
    render(<PresentRunner target={{ kind: 'drill', drillId: d.id }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '드릴 정보' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('정보 모달 목적')).toBeInTheDocument();
    expect(within(dialog).getByText('공 3개')).toBeInTheDocument();
    // 읽기 전용 — 입력 요소가 하나도 없다(편집 시트와 갈라지는 지점).
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    // 2차(기현님) — **빈 필드도 줄이 선다**: 이 드릴은 변형·태그를 안 적었지만 라벨은 있다.
    expect(within(dialog).getByText('변형')).toBeInTheDocument();
    expect(within(dialog).getByText('태그')).toBeInTheDocument();
    expect(within(dialog).getByText('경기 상황')).toBeInTheDocument();
    expect(within(dialog).getAllByText('미지정').length).toBeGreaterThanOrEqual(2); // 상황·인원 둘 다

    await user.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('메모가 쪽지 칩 배경과 함께 그려진다 — 글자만 떠 있지 않다', async () => {
    const d = await makeTwoStepDrill(`메모 드릴 ${++seq}`);
    const step1 = { ...d.steps[0]!, notes: [{ id: newId('nt'), x: 200, y: 200, text: '시연 메모' }] };
    await idbDrillRepo.putDrill({ ...d, steps: [step1, d.steps[1]!] }, { touch: false });
    const { container } = render(<PresentRunner target={{ kind: 'drill', drillId: d.id }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText('시연 메모')).toBeInTheDocument());
    // 칩 본체 + 접힘 삼각형 — 편집기·인쇄와 같은 두 path 다.
    const noteG = screen.getByText('시연 메모').closest('g')!;
    expect(noteG.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0); // 대조군
  });

  it('격자는 저장값(prefs.showGrid)을 따른다 — 기본(꺼짐)에는 없다', async () => {
    const d = await makeTwoStepDrill(`격자 드릴 ${++seq}`);
    const { container, unmount } = render(<PresentRunner target={{ kind: 'drill', drillId: d.id }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());
    expect(container.querySelector('[data-grid-overlay]') ?? container.querySelector('g[aria-label="격자"]')).toBeNull();
    unmount();
  });

  // 2026-08-20 §E — 노트 띠는 고정 높이 전폭 띠다: 노트가 없는 스텝으로 넘어가도 이 줄의
  // 키가 안 바뀌어야 코트가 위아래로 안 밀린다(선택모드 출렁임을 고친 것과 같은 원리 —
  // 조건부 마운트가 아니라 높이를 먼저 고정하고 내용만 교체한다).
  it('시연 노트 띠는 노트 유무와 무관하게 높이가 고정이다 — 코트가 안 밀린다', async () => {
    const tag = `#${++seq}`;
    const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: `노트 띠 드릴 ${tag}`, durationMin: 5 });
    const step1 = { ...base.steps[0]!, id: newId('st'), note: STEP1_NOTE };
    const step2 = { ...base.steps[0]!, id: newId('st'), note: '' }; // 노트 없는 스텝
    const drill = await idbDrillRepo.putDrill({ ...base, steps: [step1, step2] }, { touch: false });

    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    const band = () => screen.getByText(/^STEP \d\/\d$/).parentElement!.parentElement!;
    expect(band().style.minHeight).toBe('86px');
    expect(band().style.maxHeight).toBe('86px');
    expect(band().style.overflowY).toBe('auto');

    await userEvent.click(screen.getByRole('button', { name: '2번 스텝으로 이동' }));
    await waitFor(() => expect(screen.queryByText(STEP1_NOTE)).toBeNull());

    // 노트가 없는 스텝인데도 띠의 min/max 는 그대로다 — 조건부로 줄지 않는다.
    expect(band().style.minHeight).toBe('86px');
    expect(band().style.maxHeight).toBe('86px');
  });
});

describe('PresentRunner — 구획 인지 시연 (C9)', () => {
  /** 구획 2개(워밍업 1드릴 · 전술 1드릴) 세션. */
  async function makeTwoPhaseSession() {
    const d1 = await makeTwoStepDrill(`구획드릴A ${++seq}`);
    const d2 = await makeTwoStepDrill(`구획드릴B ${seq}`);
    let session = await createSession({ title: `구획 세션 ${seq}` });
    session = await addDrillToSession(session.id, d1.id);
    session = await addDrillToSession(session.id, d2.id);
    // 두 번째 드릴을 새 '전술' 구획으로 옮긴다.
    const resolved = await getSession(session.id);
    const s = resolved!.session;
    const [first] = s.phases;
    const moved = first!.items[1]!;
    const next = {
      ...s,
      phases: [
        { ...first!, kind: 'warm-up' as const, title: undefined, items: [first!.items[0]!] },
        { id: newId('ph'), kind: 'tactical' as const, items: [moved] },
      ],
    };
    delete (next.phases[0] as Record<string, unknown>).title;
    await putSession(next);
    return { sessionId: session.id, d1, d2 };
  }

  it('현재 구획 라벨이 서고, 구획 경계를 넘는 전환은 쉼 화면이 구획 이름을 알린다', async () => {
    const { sessionId } = await makeTwoPhaseSession();
    render(<PresentRunner target={{ kind: 'session', sessionId }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    // 현재 구획 라벨 — 워밍업 1/2.
    expect(screen.getByText(/워밍업 1\/2/)).toBeInTheDocument();

    // 다음 드릴로 — 구획 경계를 넘는다.
    await userEvent.setup().keyboard('n');
    const status = await screen.findByRole('status');
    expect(within(status).getByText(/다음 구획: 전술/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/전술 2\/2/)).toBeInTheDocument());
  });

  it('구획이 하나뿐이면 구획 라벨·구획 쉼 문구가 없다 — 라벨 소음 방지', async () => {
    const d1 = await makeTwoStepDrill(`단일구획A ${++seq}`);
    const d2 = await makeTwoStepDrill(`단일구획B ${seq}`);
    const session = await createSession({ title: `단일 구획 세션 ${seq}` });
    await addDrillToSession(session.id, d1.id);
    await addDrillToSession(session.id, d2.id);
    render(<PresentRunner target={{ kind: 'session', sessionId: session.id }} nav={makeNav()} />, { wrapper });
    await waitFor(() => expect(screen.getByText(STEP1_NOTE)).toBeInTheDocument());

    expect(screen.queryByText(/1\/1/)).toBeNull();
    await userEvent.setup().keyboard('n');
    const status = await screen.findByRole('status');
    expect(within(status).getByText('다음 드릴')).toBeInTheDocument();
    expect(within(status).queryByText(/다음 구획/)).toBeNull();
  });
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
