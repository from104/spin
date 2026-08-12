// 3.10 [B-2] — **실제 조립(EditorScreen)** 에서 스텝 전환이 트윈되는지 고정한다.
//
// 순수 조각(tween.test.ts)만으로는 부족하다는 것을 이 작업이 실측으로 증명했다: poseFrame/
// startTween 은 처음부터 옳았지만, EditorStage 가 스텝 전환 커밋마다 initialFrame 을 다시
// writeFrame 해 트윈 시작점 스냅샷이 도착 프레임으로 덮였고(자식 layout effect 가 부모보다
// 먼저 돈다), 실제 앱에서는 **아무것도 트윈되지 않았다**. 여기서는 그 조립 전체 — 재생과 같은
// 경로인 STEP_SELECT(다음 스텝 버튼) — 를 통과시켜 다음을 고정한다:
//   · 휠체어(대조군 — 원래 트윈 대상)가 중간값을 지나 도착한다
//   · 화살표 세 점(from/ctrl/to)의 d 가 보간된다, id 로 짝지어(3.10 핵심)
//   · 메모 transform 이 보간된다
//   · 한쪽에만 있는 화살표·메모는 페이드로 등장/퇴장한다(시연 interpolateSteps 와 같은 그림)
//   · reduce-motion 이면 전부 즉시 스냅이고 페이드도 없다(EditorProvider 와 같은 규칙)
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { newId } from '../../core/ids.ts';
import type { ArrowId, DrillId, NoteId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';

// EditorScreen.test.tsx 와 같은 이유의 목 — EditorScreen 이 쓰는 건 useStageTarget 하나뿐이다.
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

// rAF 수동 큐 — usePhysicsRenderLoop.test.tsx 와 같은 관용구. 시간을 우리가 굴려야
// "전환 100ms 시점" 같은 중간 프레임을 붙잡을 수 있다.
let queue: FrameRequestCallback[] = [];
let now = 0;
function flush(dtMs: number): void {
  now += dtMs;
  const q = queue;
  queue = [];
  for (const cb of q) cb(now);
}

beforeEach(() => {
  localStorage.clear();
  queue = [];
  now = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

/** EditorWorkspace.narrow.test.tsx 의 stubMedia 와 같은 이유 — jsdom 에는 matchMedia 가 없다.
 *  reduce-motion 질의에만 true 를 준다(뭉뚱그리면 좁은 창·세로 경로가 덤으로 켜진다). */
function stubReduceMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

/** 두 스텝 드릴: 휠체어 이동 + 양쪽 화살표(끝점 이동) + 퇴장 화살표 + 양쪽 메모(이동) + 등장 메모. */
async function seedDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  const arBoth = newId('ar') as ArrowId;
  const arExit = newId('ar') as ArrowId;
  const ntBoth = newId('nt') as NoteId;
  const ntEnter = newId('nt') as NoteId;
  const s0 = {
    ...created.steps[0]!,
    arrows: [
      { id: arBoth, kind: 'move' as const, from: { x: 100, y: 100 }, ctrl: { x: 150, y: 125 }, to: { x: 200, y: 100 } },
      { id: arExit, kind: 'pass' as const, from: { x: 60, y: 60 }, ctrl: { x: 80, y: 80 }, to: { x: 100, y: 60 } },
    ],
    notes: [{ id: ntBoth, text: '둘 다', x: 120, y: 220 }],
  };
  const s1 = {
    ...structuredClone(s0),
    id: newId('st'),
    name: '둘',
    chairs: Object.fromEntries(Object.entries(s0.chairs).map(([id, p]) => [id, { ...p!, x: p!.x + 180 }])),
    arrows: [{ id: arBoth, kind: 'move' as const, from: { x: 100, y: 100 }, ctrl: { x: 150, y: 125 }, to: { x: 300, y: 180 } }],
    notes: [
      { id: ntBoth, text: '둘 다', x: 240, y: 300 },
      { id: ntEnter, text: '새 메모', x: 400, y: 120 },
    ],
  };
  const drill: Drill = { ...created, steps: [s0, s1] };
  await repo.putDrill(drill);
  stageTarget = { kind: 'drill', drillId: created.id };
  return { drill, arBoth, arExit, ntBoth, ntEnter, chairId: Object.keys(s0.chairs)[0]! };
}

async function mountEditor(settleId: string) {
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  // 마운트 직후 초기 기록이 화면에 닿기까지는 (a) 드릴 비동기 로드 → (b) 칩 렌더 → (c) rAF
  // 프레임의 세 단계가 있다. 원래 여기 있던 고정 flush(16) 2회는 (a)가 위 waitFor 안에 이미
  // 끝났다는 가정인데, 병렬 전체 실행으로 기계가 밀리면 (a)가 그 뒤로 넘어와 두 프레임이
  // 빈 큐에 헛돌고, 뒤늦게 큐에 든 초기 기록 프레임은 아무도 안 굴려 transform 이 빈 채
  // 남았다(전체 실행에서만 간헐 빨간불이던 그 플레이크 — 단독 실행은 늘 초록불). 재시도마다
  // 한 프레임씩 굴리며 초기 transform 이 실제로 쓰일 때까지 기다린다 — 시한 초과면 행(hang)이
  // 아니라 단언 실패로 죽는다.
  await waitFor(
    () => {
      flush(16);
      expect(document.getElementById(`obj-${settleId}`)?.getAttribute('transform') ?? '').toMatch(/translate\(/);
    },
    { timeout: 3000 },
  );
}

const objEl = (id: string): SVGGElement => document.getElementById(`obj-${id}`) as unknown as SVGGElement;
const tfOf = (id: string): string => objEl(id).getAttribute('transform') ?? '';
const dOf = (id: string): string => objEl(id).querySelector('path')!.getAttribute('d')!;
const txOf = (id: string): number => Number(/translate\((-?[\d.]+)/.exec(tfOf(id))![1]);
/** `M… Q… tx,ty` 의 끝점 x. */
const toXOf = (id: string): number => Number(/ (-?[\d.]+),-?[\d.]+$/.exec(dOf(id))![1]);
/** 페이드 래퍼(항상 있는 부모 <g>)의 클래스. SVG 의 className 은 SVGAnimatedString 이라 속성으로 읽는다. */
const fadeClassOf = (id: string): string => objEl(id).parentElement!.getAttribute('class') ?? '';

describe('3.10 — 편집기 스텝 전환(실조립)', () => {
  it('휠체어·화살표·메모가 중간값을 지나 도착한다 — 화살표는 id 로 짝지은 세 점 보간', async () => {
    const { arBoth, ntBoth, ntEnter, chairId, drill } = await seedDrill();
    await mountEditor(chairId);

    const chairX0 = txOf(chairId);
    expect(dOf(arBoth)).toBe('M100,100 Q150,125 200,100');
    expect(txOf(ntBoth)).toBeCloseTo(120, 1);

    fireEvent.click(screen.getByRole('button', { name: '다음 스텝' }));

    // 클릭 직후(첫 rAF 이전): 트윈 시작 프레임(e=0)이 동기로 쓰여 아직 **이전 스텝 값**이다.
    // 이게 최종값이면 트윈이 다시 죽은 것이다(이 작업이 고친 회귀 그 자체).
    expect(txOf(chairId)).toBeCloseTo(chairX0, 1);
    expect(toXOf(arBoth)).toBeCloseTo(200, 1);
    expect(txOf(ntBoth)).toBeCloseTo(120, 1);
    // 등장 메모는 첫 페인트 전에 자기 자리(도착값)에 서 있어야 한다 — 원점 플래시 방지.
    expect(txOf(ntEnter)).toBeCloseTo(400, 1);

    // 전환 600ms 중 200ms 지점(rafLoop 이 dt 를 50ms 로 클램프하므로 프레임 단위로 굴린다) —
    // 셋 다 중간값이어야 한다(AND 를 조건마다 따로 찌른다). 휠체어는 easeStandard 위에
    // interpChair 의 Hermite 가 한 번 더 얹혀 초반이 매우 느리다 — 창을 넉넉히 잡는다.
    flush(50);
    flush(50);
    flush(50);
    flush(50);
    const chairMid = txOf(chairId);
    expect(chairMid).toBeGreaterThan(chairX0 + 5);
    expect(chairMid).toBeLessThan(chairX0 + 175);
    const arMid = toXOf(arBoth);
    expect(arMid).toBeGreaterThan(205);
    expect(arMid).toBeLessThan(295);
    const ntMid = txOf(ntBoth);
    expect(ntMid).toBeGreaterThan(126);
    expect(ntMid).toBeLessThan(234);

    // 완주 — 도착값. 화살표 d 는 React 가 렌더한 문자열과 한 글자도 안 어긋난다.
    for (let i = 0; i < 10; i++) flush(50);
    expect(txOf(chairId)).toBeCloseTo(chairX0 + 180, 1);
    expect(dOf(arBoth)).toBe('M100,100 Q150,125 300,180');
    expect(txOf(ntBoth)).toBeCloseTo(240, 1);
    expect(drill.steps).toHaveLength(2); // 드릴 자체는 안 변했다(재생일 뿐)
  });

  it('한쪽에만 있는 화살표·메모는 페이드로 퇴장/등장한다(edits.ts D6 크로스페이드 전제)', async () => {
    const { arExit, ntEnter, chairId } = await seedDrill();
    await mountEditor(chairId);

    expect(fadeClassOf(arExit)).toBe(''); // 전환 전에는 페이드가 없다(대조군)

    fireEvent.click(screen.getByRole('button', { name: '다음 스텝' }));

    // 퇴장 화살표는 새 스텝에 없지만 전환 동안 **남아서** 사라진다. 값은 이전 스텝 그대로다.
    expect(objEl(arExit)).toBeTruthy();
    expect(fadeClassOf(arExit)).toBe('court-fade-out');
    expect(dOf(arExit)).toBe('M60,60 Q80,80 100,60');
    // 등장 메모는 떠오른다.
    expect(fadeClassOf(ntEnter)).toBe('court-fade-in');
    // 지속시간은 위치 트윈과 같은 시계(stepTransitionMs)다.
    expect((objEl(arExit).parentElement as unknown as HTMLElement).style.animationDuration).toBe('600ms');

    // 전환이 끝나면(실제 setTimeout 600ms) 퇴장 개체는 DOM 에서 빠지고 등장 개체의 클래스도 걷힌다.
    await waitFor(() => expect(document.getElementById(`obj-${arExit}`)).toBeNull(), { timeout: 1500 });
    expect(fadeClassOf(ntEnter)).toBe('');
  });

  it('reduce-motion 이면 즉시 스냅이고 페이드도 없다(트윈 ms=0 과 같은 규칙)', async () => {
    stubReduceMotion();
    const { arBoth, arExit, ntBoth, chairId } = await seedDrill();
    await mountEditor(chairId);
    const chairX0 = txOf(chairId);

    fireEvent.click(screen.getByRole('button', { name: '다음 스텝' }));

    // 클릭 직후, rAF 한 번 없이 이미 도착값 — 조건마다 따로.
    expect(txOf(chairId)).toBeCloseTo(chairX0 + 180, 1);
    expect(dOf(arBoth)).toBe('M100,100 Q150,125 300,180');
    expect(txOf(ntBoth)).toBeCloseTo(240, 1);
    // 퇴장 화살표는 페이드 없이 즉시 사라진다.
    expect(document.getElementById(`obj-${arExit}`)).toBeNull();
    expect(document.querySelector('.court-fade-in, .court-fade-out')).toBeNull();
  });
});
