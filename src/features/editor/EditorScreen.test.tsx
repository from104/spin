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

describe('키보드 이동 후 물리 동기화 (회귀)', () => {
  /** 코트 위 개체의 translate 좌표를 읽는다. */
  function poseOf(el: Element): { x: number; y: number } {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
    return { x: Number(m?.[1] ?? NaN), y: Number(m?.[2] ?? NaN) };
  }

  /** 무대에 viewBox 와 1:1 인 실측 rect 를 물린다.
   *
   *  jsdom 의 getBoundingClientRect 는 전부 0 이라 computeMetrics 의 pxPerUnit 이 0 이 되고,
   *  clientToWorld 가 0 으로 나눠 월드 좌표가 통째로 NaN 이 된다. 그러면 포인터가 어디를
   *  찍든 히트테스트가 성립하지 않아 "마우스로 잡는" 경로가 조용히 아무 일도 안 한다.
   *  rect 를 viewBox 와 같은 크기·원점 0 으로 주면 pxPerUnit=1, offX=offY=0 이 되어
   *  client = world − viewBox원점 이라는 1:1 대응이 성립한다(→ toClient). */
  function stubStageRect(stage: Element): (w: { x: number; y: number }) => { clientX: number; clientY: number } {
    const [vx, vy, vw, vh] = (stage.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number) as [number, number, number, number];
    stage.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh, toJSON: () => ({}) }) as DOMRect;
    return (w) => ({ clientX: w.x - vx, clientY: w.y - vy });
  }

  it('키보드로 옮긴 개체를 마우스로 잡아도 옛 자리로 되돌아가지 않는다', async () => {
    // 회귀: OBJECT_NUDGE 가 리듀서만 갱신하고 물리 바디는 그대로였다. 그래서 키보드로 옮긴
    // 개체를 잡는 순간 beginDrag 가 world.chairPose() 로 낡은 자세를 읽어와 개체가 튀었다.
    // 키보드 조작은 §7.5 접근성 요건이라 이 경로가 특히 중요하다.
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());

    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    const toClient = stubStageRect(stage);
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    const holder = chair.closest('g[transform]') as SVGGElement;
    const start = poseOf(holder);

    // 키보드로 오른쪽으로 크게(Shift = 25px) 두 번 민다
    chair.focus();
    await user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    const nudged = poseOf(holder);
    expect(nudged.x).toBeGreaterThan(start.x + 40); // 25 × 2 만큼 이동

    // 이제 밀린 자리를 마우스로 정확히 집었다 놓는다 — 낡은 물리 자세를 읽으면 여기서 start 로 튄다.
    // ⚠️ 포인터 사건은 반드시 무대 안쪽 엘리먼트에 쏜다. CourtStage 는 네 핸들러를 전부
    // <svg role="application"> 의 React prop 으로 달아두므로(§6.4), window 에 디스패치하면
    // 버블링이 무대까지 닿지 않아 잡는 동작이 통째로 일어나지 않는다.
    const grab = toClient(nudged);
    chair.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...grab, pointerId: 1 }));
    // 잡기가 진짜로 성립했는지 못을 박는다. 무대에 드래그 커서가 붙는 것이 유일하게 믿을 만한
    // 증거다 — 이건 controller.onPointerDown(=beginDrag)까지 갔어야만 생긴다. (선택 링은
    // 증거가 못 된다: 선택은 개체별 DOM 핸들러가 하므로 드래그가 죽어 있어도 1개가 된다.)
    // 이 단언이 없으면, 잡기 경로가 통째로 죽어도 아래 위치 단언은 키보드 결과를 다시 읽을
    // 뿐이라 초록불이 뜬다 — 실제로 setPointerCapture 예외로 그렇게 죽어 있었다.
    await waitFor(() => expect(stage.getAttribute('style') ?? '').toContain('cursor:'));
    // 오른쪽으로 확실히 끈다. 여기서 개체가 실제로 따라와야 rect 스텁(=유한한 월드 좌표)이
    // 제 일을 한 것이다 — rect 가 0 이면 월드가 NaN 이라 끌어도 제자리에 머문다.
    // ⏱ 물리는 rAF tick 에서만 전진한다(§6.4). 89개 파일을 병렬로 돌리면 jsdom 의 타이머가
    // 굶어 기본 1000ms 안에 몇 틱 못 돈다 — 파일 단독으로는 통과하는데 전체 실행에서만
    // 깨지는 형태가 된다. 넉넉히 준다(테스트 자체 예산 30s).
    const DRAG = 30;
    const SETTLE = { timeout: 10_000 };
    chair.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: grab.clientX + DRAG, clientY: grab.clientY, pointerId: 1 }));
    await waitFor(() => expect(poseOf(holder).x).toBeGreaterThan(nudged.x + DRAG / 2), SETTLE);
    chair.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: grab.clientX + DRAG, clientY: grab.clientY, pointerId: 1 }));
    // 그리고 start 로 튀지 않았다 — 끈 방향(오른쪽)으로 갔지, 옛 자리로 돌아가지 않았다.
    await waitFor(() => expect(poseOf(holder).x).toBeGreaterThan(nudged.x), SETTLE);
  }, 30000);
});

describe('선택 표시와 4개 드래그 존', () => {
  async function openEditor() {
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    return { user, stage: screen.getByRole('application', { name: '코트 편집 영역' }) };
  }

  it('선택 전에는 선택 링·존 커서·핸들이 하나도 없다', async () => {
    const { stage } = await openEditor();
    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(0);
    expect(stage.querySelectorAll('.court-obj rect[style*="cursor"]')).toHaveLength(0);
  });

  it('휠체어를 고르면 선택 링 1개와 존 커서 4개(=4존)가 그 칩에만 생긴다', async () => {
    // 코트에 9대가 있으므로 "선택된 것에만" 이 지켜지는지가 핵심이다 —
    // 전부에 붙으면 어느 칩이 조작 대상인지 흐려진다.
    const { user, stage } = await openEditor();
    // jsdom 은 getBoundingClientRect 가 0 이라 포인터→월드 변환이 성립하지 않는다.
    // 선택 자체는 키보드 경로(§7.5)로 하고, 그 결과 렌더만 본다.
    const chair = stage.querySelectorAll('.court-obj')[0] as SVGGElement;
    chair.focus();
    await user.keyboard('{Enter}');

    expect(stage.querySelectorAll('.sel-ring')).toHaveLength(1);
    const zoneRects = stage.querySelectorAll('.court-obj rect[style*="cursor"]');
    expect(zoneRects).toHaveLength(4); // towRear · translate · spin · towFront
    const cursors = Array.from(zoneRects).map((r) => decodeURIComponent(r.getAttribute('style') ?? ''));

    // 앞뒤 견인은 **일부러 같은 커서**(줄 쥔 손)다 — 마우스 커서는 회전시킬 수 없어서
    // 방향을 그리면 차체가 도는 순간 엉뚱한 쪽을 가리킨다. 방향은 리시와 핸들이 보여 준다.
    expect(cursors[0]).toBe(cursors[3]);
    // 가운데 둘은 서로도, 견인과도 달라야 한다
    expect(new Set(cursors).size).toBe(3);
  });
});
