// 개체 메뉴 — 잠김 · 무시 · 빼기/삭제 (2026-08-14 기현 지시).
//
// 세 층을 따로 잰다. 하나로 뭉치면 둘이 죽어도 초록이다:
//   ① **손짓** — 오른쪽 클릭 / 긴 터치로 메뉴가 뜨는가(useLongPressMenu, 순수 타이머).
//   ② **화면** — 메뉴 항목이 상태에 따라 갈리는가, 무시는 칩에만 뜨는가.
//   ③ **효과** — 잠그면 정말 안 움직이는가, 무시하면 정말 물리에서 빠지는가.
// ③ 이 이 기능의 본문이다. ①②만 초록이고 ③ 이 끊긴 것이 "메뉴는 뜨는데 아무 일도 안 나는"
// 상태이고, 그것이 이 저장소가 배선에서 실제로 겪어 온 실패다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { ObjectMenu } from './ObjectMenu.tsx';
import { cues } from '../../ui/cues.ts';
import { LONG_PRESS_MS, MOVE_CANCEL_PX, useLongPressMenu } from './useLongPressMenu.ts';
import { setStepFlag } from '../../model/edits.ts';
import { createDrill } from '../../model/defaults.ts';

// ── ① 손짓 ──────────────────────────────────────────────────────────────────────────

describe('여는 손짓 — 오른쪽 클릭과 긴 터치', () => {
  afterEach(() => vi.useRealTimers());

  it('오른쪽 클릭은 **즉시** 연다 — 마우스에는 정확한 손짓이 이미 있다', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useLongPressMenu(open));
    act(() => result.current.onContextMenu('ch_1', { preventDefault: () => {}, clientX: 10, clientY: 20 }));
    expect(open).toHaveBeenCalledWith('ch_1', 10, 20);
  });

  it('터치는 길게 눌러야 열린다 — 탭으로는 안 열린다', () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useLongPressMenu(open));
    act(() => result.current.onPointerDown('ch_1', { pointerType: 'touch', clientX: 5, clientY: 5 } as never));

    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS - 20));
    expect(open, '아직 열리면 안 된다 — 탭이 메뉴를 연다').not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(40));
    expect(open).toHaveBeenCalledWith('ch_1', 5, 5);
  });

  it('★ 마우스로 누르고 있어도 안 열린다 — 안 그러면 끌기 전 망설임이 메뉴를 연다', () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useLongPressMenu(open));
    act(() => result.current.onPointerDown('ch_1', { pointerType: 'mouse', clientX: 5, clientY: 5 } as never));
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 3));
    expect(open).not.toHaveBeenCalled();
  });

  it('★ 손가락이 움직이면 접는다 — 끌기가 이긴다', () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useLongPressMenu(open));
    act(() => result.current.onPointerDown('ch_1', { pointerType: 'touch', clientX: 100, clientY: 100 } as never));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + MOVE_CANCEL_PX + 5, clientY: 100 }));
    });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(open, '끌고 있는데 메뉴가 떴다').not.toHaveBeenCalled();
  });

  it('대조군: 미세한 흔들림으로는 안 접힌다 — 누르고 있는 손은 완전히 정지하지 않는다', () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const { result } = renderHook(() => useLongPressMenu(open));
    act(() => result.current.onPointerDown('ch_1', { pointerType: 'touch', clientX: 100, clientY: 100 } as never));
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + MOVE_CANCEL_PX - 3, clientY: 100 }));
    });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS + 20));
    expect(open).toHaveBeenCalled();
  });
});

// ── ③ 효과 (순수 규칙) ──────────────────────────────────────────────────────────────

describe('플래그 저장 — 스텝마다 따로다 (기현 결정)', () => {
  it('한 스텝에 잠가도 다른 스텝은 그대로다', () => {
    const d0 = createDrill({ courtMode: 'full' });
    const two = { ...d0, steps: [d0.steps[0]!, { ...d0.steps[0]!, id: 'st_2' as never }] };
    const d = setStepFlag(two, 0, 'locked', 'ch_x', true);
    expect(d.steps[0]!.locked).toEqual(['ch_x']);
    expect(d.steps[1]!.locked, '스텝 2까지 잠겼다 — 드릴 전체 플래그가 됐다').toBeUndefined();
  });

  it('끄면 키가 **사라진다** — 빈 배열이 저장본에 눌러앉지 않는다', () => {
    const d0 = createDrill({ courtMode: 'full' });
    const on = setStepFlag(d0, 0, 'locked', 'ch_x', true);
    const off = setStepFlag(on, 0, 'locked', 'ch_x', false);
    expect('locked' in off.steps[0]!).toBe(false);
  });

  it('같은 값을 다시 넣으면 **같은 참조**다 — 되돌리기가 한 칸도 안 쌓인다', () => {
    const d0 = createDrill({ courtMode: 'full' });
    const on = setStepFlag(d0, 0, 'locked', 'ch_x', true);
    expect(setStepFlag(on, 0, 'locked', 'ch_x', true)).toBe(on);
    expect(setStepFlag(d0, 0, 'locked', 'ch_x', false)).toBe(d0);
  });
});

// ── ②③ 화면 끝 ─────────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>{children}</AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

async function openBoardWithChair() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  // 트레이에서 선수 하나를 코트에 놓는다 — 빈 판에는 메뉴를 열 개체가 없다.
  await user.click(screen.getAllByRole('button', { name: /선수 배치$/ })[0]!);
  const stage = screen.getByRole('application', { name: '코트 편집 영역' });
  await user.pointer([{ target: stage, keys: '[MouseLeft]', coords: { clientX: 40, clientY: 40 } }]);
  const chair = await waitFor(() => {
    const el = document.querySelector('.court-obj[id^="obj-ch_"]');
    if (!el) throw new Error('휠체어가 안 놓였다');
    return el as SVGGElement;
  });
  return { user, stage, chair };
}

const menu = () => screen.queryByRole('menu', { name: '개체 메뉴' });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('메뉴 — 화면 끝', () => {
  it('휠체어를 오른쪽 클릭하면 잠금 · 무시 · 빼기가 뜬다', async () => {
    const { chair } = await openBoardWithChair();
    expect(menu()).toBeNull(); // 대조군
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await waitFor(() => expect(menu()).not.toBeNull());
    for (const name of ['잠금', '무시', '빼기']) {
      expect(screen.getByRole('menuitem', { name }), name).toBeInTheDocument();
    }
  });

  it('★ 잠그면 보라 덮개가 얹힌다', async () => {
    // ⚠️ **끌기 차단은 여기서 못 잰다.** jsdom 에는 레이아웃이 없어 좌표가 전부 0 이라,
    // 차단이 있든 없든 개체가 안 움직인다 — 실제로 차단을 지우고 돌려 보니 그대로
    // 초록이었다(2026-08-14 반증). 아무것도 안 지키는 단언은 없느니만 못하므로 뺐다.
    // 차단은 `lockedDrag.test.tsx` 가 컨트롤러를 직접 불러 잰다.
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '잠금' }));
    // ⚠️ 처음에는 **붉은 테두리**였다(기현 첫 지시). 실기에서 선택 테두리와 겹쳐서
    // 보라 반투명 덮개로 바뀌었다 — 링 둘이 같은 픽셀을 다투던 것이 원인이라, 면으로
    // 바꾼 것이 수리다(LockTint.tsx 머리말).
    await waitFor(() => expect(chair.querySelector('.lock-tint'), '보라 덮개가 없다').not.toBeNull());
    expect(chair.querySelector('.lock-ring'), '옛 붉은 테두리가 되살아났다').toBeNull();
  });

  it('★ 잠김 덮개와 선택 테두리가 **함께 떠도** 서로 다른 요소다 — 겹침이 이 수리의 이유였다', async () => {
    // 기현님 실측: *"붉은 테두리로 정했는데 선택 테두리와 겹친다."* 잠긴 것을 고를 수 있어야
    // 하므로 **둘이 동시에 뜨는 것이 정상 상태**인데, 둘 다 개체 둘레의 링이라 같은 픽셀을
    // 다퉜다. 덮개는 면이라 축이 다르다 — 이 단언이 그 분리를 지킨다.
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '잠금' }));
    await user.pointer([{ target: chair, keys: '[MouseLeft]', coords: { clientX: 40, clientY: 40 } }]);

    await waitFor(() => expect(chair.querySelector('.sel-ring'), '선택 테두리가 없다').not.toBeNull());
    const tint = chair.querySelector('.lock-tint')!;
    expect(tint, '덮개가 없다').not.toBeNull();
    // 덮개는 **채워진 면**이고 테두리는 선이다 — 같은 표현이면 다시 겹친다.
    expect(tint.getAttribute('fill'), '덮개가 면이 아니다').toBeTruthy();
    expect(tint.getAttribute('stroke'), '덮개가 선을 그리고 있다 — 다시 링과 겹친다').toBeNull();
  });

  it('잠금은 **선택은 막지 않는다** — 못 고르면 잠금을 풀 길이 없다', async () => {
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '잠금' }));

    await user.pointer([{ target: chair, keys: '[MouseLeft]', coords: { clientX: 40, clientY: 40 } }]);
    await waitFor(() => expect(chair.getAttribute('aria-pressed')).toBe('true'));
    // 그리고 메뉴는 '잠금 해제' 로 바뀐다.
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    expect(await screen.findByRole('menuitem', { name: '잠금 해제' })).toBeInTheDocument();
  });

  it('★ 무시하면 흐려진다 (물리에서 빠지는 것은 physics 테스트가 잰다)', async () => {
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '무시' }));

    await waitFor(() => {
      const ghost = chair.parentElement as HTMLElement;
      expect(Number(ghost.style.opacity), '안 흐려졌다').toBeLessThan(0.5);
    });
  });

  it('★ 무시해도 **손이 닿는다** — 안 닿으면 무시를 풀 방법이 없다 (기현 신고 2026-08-14)', async () => {
    // 처음에는 껍데기에 `pointerEvents:'none'` 을 걸었다. 흐리고 안 만져지는 것이 '무시' 의
    // 그림에 맞아 보였지만, 그러면 **되돌리는 문까지 함께 잠긴다.** 잠김에서 "선택은 막지
    // 않는다" 로 이미 피했던 함정을 무시에서 되풀이한 것이다.
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '무시' }));
    await waitFor(() => expect(Number((chair.parentElement as HTMLElement).style.opacity)).toBeLessThan(0.5));

    // 손이 막혀 있으면 이 줄부터 안 된다.
    expect((chair.parentElement as HTMLElement).style.pointerEvents, '무시인데 손이 막혔다').not.toBe('none');
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    const undo = await screen.findByRole('menuitem', { name: '무시 해제' });

    await user.click(undo);
    await waitFor(() => expect(Number((chair.parentElement as HTMLElement).style.opacity || '1')).toBe(1));
  });

  it('빼면 칩이 코트에서 사라진다 — 그러나 **트레이로 돌아온다**', async () => {
    // 2026-08-16 — 라벨이 '삭제' 에서 '빼기' 로 바뀐 근거를 여기서 잰다. 코트에서 없어진
    // 것만 보면 '삭제' 도 통과한다 — **돌아왔는가**가 두 말을 가르는 유일한 관측이다.
    // 트레이는 나가 있는 선수를 `aria-hidden` 인 빈 자리(span)로 그리고, 돌아오면 다시
    // 끌 수 있는 **버튼**으로 그린다(ToolRail 의 `c.placed` 분기). 그 전환을 본다.
    const { user, chair } = await openBoardWithChair();
    const slots = () => screen.queryAllByRole('button', { name: /선수 배치$/ });
    const before = slots().length;

    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '빼기' }));
    await waitFor(() => expect(document.querySelector('.court-obj[id^="obj-ch_"]')).toBeNull());

    // 명단에서 지워졌다면 이 수가 그대로이거나 줄어든다. 늘어난다는 것은 **그 선수가
    // 트레이에 다시 섰다**는 뜻이다.
    await waitFor(() => expect(slots().length).toBe(before + 1));
  });

  it('메뉴로 뺄 때도 트레이 복귀 소리가 난다 — 끌어서 빼는 것과 같은 동작이다', async () => {
    // 두 길이 같은 액션인데 한쪽만 울리면 "메뉴로는 다른 일이 일어났나" 가 된다.
    // §4.3 P1-4 의 소리는 눈을 안 쓰고도 '놓았다' 와 '뺐다' 를 가르는 신호다.
    const play = vi.spyOn(cues, 'play').mockImplementation(() => {});
    try {
      const { user, chair } = await openBoardWithChair();
      play.mockClear();
      fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
      await user.click(await screen.findByRole('menuitem', { name: '빼기' }));
      await waitFor(() => expect(play.mock.calls.map((c) => c[0])).toContain('trayReturn'));
    } finally {
      play.mockRestore();
    }
  });

  // ── 마지막 항목의 말 — '빼기' 냐 '삭제' 냐 ────────────────────────────────────────
  // 기준은 **트레이에 다시 꺼낼 자리가 있는가** 다(기현 지시 2026-08-16). 모델이 cast 에서
  // 지우는지가 아니다 — 공·콘은 cast 에서도 사라지지만 트레이에 소스가 늘 있어 코치가 겪는
  // 일은 '뺐다' 이지 '지웠다' 가 아니다.
  describe('마지막 항목은 개체 종류에 따라 말이 갈린다', () => {
    const base = { x: 10, y: 10, locked: false, ignored: false, canIgnore: true, editable: null, selectSame: null };
    const noop = () => {};

    // 2026-08-16 — 예전에는 `returnsToTray` 를 대상에 실어 보냈다. 지금은 **id 에서 계산한다**
    // (ObjectMenu 의 그 필드 주석) — 그래서 테스트도 진짜 id 를 준다. 값을 따로 실을 수 있으면
    // "칩인데 삭제라고 적힌" 대상을 테스트가 만들어 낼 수 있고, 그건 제품에 없는 상태다.
    const openWith = (returnsToTray: boolean) =>
      render(
        <ObjectMenu
          target={{ ...base, ids: [returnsToTray ? 'ch_1' : 'ar_1'] }}
          onClose={noop}
          onToggleLock={noop}
          onToggleIgnore={noop}
          onRemove={noop}
          onSelect={noop}
          onDuplicate={noop}
          onEdit={noop}
        />,
        { wrapper: SettingsProvider },
      );

    it('다시 꺼낼 자리가 있으면 [빼기] 다 — 칩·공·콘', () => {
      openWith(true);
      expect(screen.getByRole('menuitem', { name: '빼기' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: '삭제' })).toBeNull();
    });

    it('다시 꺼낼 자리가 없으면 [삭제] 다 — 화살표·메모·도형', () => {
      openWith(false);
      expect(screen.getByRole('menuitem', { name: '삭제' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: '빼기' })).toBeNull();
    });

    it('둘 다 붉다 — 색의 근거는 되돌릴 수 있는가가 아니라 판에서 사라지는가다', () => {
      // 색까지 갈라 버리면 "빼기는 안전한 항목" 으로 읽혀 잠금·무시와 한 덩어리가 된다.
      for (const returnsToTray of [true, false]) {
        cleanup();
        openWith(returnsToTray);
        const item = screen.getByRole('menuitem', { name: returnsToTray ? '빼기' : '삭제' });
        expect(item.style.color, String(returnsToTray)).toBe('rgb(255, 107, 107)');
      }
    });
  });

  it('Esc 로 닫힌다', async () => {
    const { chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await waitFor(() => expect(menu()).not.toBeNull());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(menu()).toBeNull());
  });
});

// ── [복제] (기현 지시 2026-08-18: *"보드의 작도 객체, 메모 객체에 오른쪽 버튼 메뉴에 복제
//    기능을 넣자. 복제하여 오른쪽 아래 1m 위치에 놓는거다"*) ─────────────────────────────

describe('[복제] — 항목은 도형·메모에만 뜬다', () => {
  const base = { x: 10, y: 10, locked: false, ignored: false, canIgnore: false, editable: null, selectSame: null };
  const noop = () => {};
  const openWith = (ids: string[], onDuplicate: (ids: string[]) => void = noop) =>
    render(
      <ObjectMenu
        target={{ ...base, ids }}
        onClose={noop}
        onToggleLock={noop}
        onToggleIgnore={noop}
        onRemove={noop}
        onSelect={noop}
        onDuplicate={onDuplicate}
        onEdit={noop}
      />,
      { wrapper: SettingsProvider },
    );

  it('도형·메모·화살표(섞여도)면 뜬다 — 여럿이면 개수가 붙는다', () => {
    // 화살표는 2026-08-18 후속 지적("화살표에는 왜 복제 메뉴가 안 뜨나?")으로 합류 —
    // 처음 뺀 근거가 원리 아니라 지시문의 열거였다(ObjectMenu 의 canDuplicate 주석).
    openWith(['sh_1']);
    expect(screen.getByRole('menuitem', { name: '복제' })).toBeInTheDocument();
    cleanup();
    openWith(['ar_1']);
    expect(screen.getByRole('menuitem', { name: '복제' })).toBeInTheDocument();
    cleanup();
    openWith(['sh_1', 'nt_1', 'ar_1']);
    expect(screen.getByRole('menuitem', { name: '3개 복제' })).toBeInTheDocument();
  });

  it('칩·공·콘에는 안 뜬다 — 하나라도 섞이면 통째로 안 뜬다', () => {
    // 칩·공·콘은 정원이 cast 에 있어 "하나 더" 가 정의 추가가 된다(canDuplicate 주석).
    // 섞인 무리에서 안 내는 것은 무시와 같은 규율이다.
    for (const ids of [['ch_1'], ['bl_1'], ['cn_1'], ['sh_1', 'ch_1'], ['ar_1', 'bl_1']]) {
      cleanup();
      openWith(ids);
      expect(screen.queryByRole('menuitem', { name: /복제$/ }), ids.join()).toBeNull();
    }
  });

  it('누르면 고른 것 **전부**가 넘어간다', () => {
    const spy = vi.fn();
    openWith(['sh_1', 'nt_2'], spy);
    fireEvent.click(screen.getByRole('menuitem', { name: '2개 복제' }));
    expect(spy).toHaveBeenCalledWith(['sh_1', 'nt_2']);
  });
});

describe('[복제] — 무대 끝까지', () => {
  afterEach(() => vi.restoreAllMocks());

  /** 작도 서랍에서 사각형을 골라 코트에 하나 놓는다(shapeTool.test 의 관례).
   *
   *  jsdom 은 rect 가 전부 0 이라 client→world 의 pxPerUnit 이 0 이 되고, 도형이
   *  `translate(Infinity Infinity)` 에 놓인다 — 그러면 +25 를 더해도 Infinity 라 오프셋을
   *  못 잰다. 무대 svg 의 rect 를 풀 코트 viewBox(825×525) 그대로 돌려주게 목킹하면
   *  pxPerUnit=1 이라 client 좌표가 곧 월드 좌표다. */
  async function openBoardWithShape() {
    const rect = { x: 0, y: 0, left: 0, top: 0, right: 825, bottom: 525, width: 825, height: 525, toJSON: () => ({}) } as DOMRect;
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    await user.click(screen.getByRole('button', { name: '사각' }));
    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    await user.pointer([{ target: stage, keys: '[MouseLeft]', coords: { clientX: 100, clientY: 100 } }]);
    const shape = await waitFor(() => {
      const el = document.querySelector('[data-shape-layer] > g[data-shape-id]');
      if (!el) throw new Error('도형이 안 놓였다');
      return el as SVGGElement;
    });
    return { user, stage, shape };
  }

  const translateOf = (el: Element): { x: number; y: number } => {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
    if (!m) throw new Error(`transform 에 translate 가 없다: ${el.getAttribute('transform')}`);
    return { x: Number(m[1]), y: Number(m[2]) };
  };

  it('★ 도형 우클릭 → [복제]: 사본이 **오른쪽 아래 0.5 m(+12.5,+12.5)** 에 서고, 선택은 사본으로 옮겨간다', async () => {
    const { user, shape } = await openBoardWithShape();
    fireEvent.contextMenu(shape, { clientX: 40, clientY: 40 });
    await waitFor(() => expect(menu()).not.toBeNull());
    await user.click(screen.getByRole('menuitem', { name: '복제' }));

    const nodes = await waitFor(() => {
      const all = [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];
      if (all.length !== 2) throw new Error(`도형이 ${all.length}개다`);
      return all;
    });
    const [a, b] = [translateOf(nodes[0]!), translateOf(nodes[1]!)];
    // 0.5 m = 12.5 px(기현님 정정 2026-08-18 — 처음엔 1 m). 절대 좌표는 jsdom 레이아웃
    // 사정이라 안 재고 차이만 잰다.
    expect(b.x - a.x).toBe(12.5);
    expect(b.y - a.y).toBe(12.5);
    // 선택이 사본으로 갔다 — 다음 조작(끌어 자리 잡기)이 향하는 곳이 방금 만든 쪽이라야 한다.
    // ShapeLayer 는 선택된 도형의 테두리를 accent 로 갈아 끼운다.
    expect(nodes[1]!.querySelector('rect')?.getAttribute('stroke')).toBe('var(--accent)');
    expect(nodes[0]!.querySelector('rect')?.getAttribute('stroke')).not.toBe('var(--accent)');
  });

  it('판 가장자리에서는 viewBox 에서 멈춘다 — 밖으로 나간 사본은 잡을 수 없다', async () => {
    const { user, stage } = await openBoardWithShape();
    // 구석(월드 820,520 — viewBox 825×525 안)에 도형을 하나 더 놓고 그걸 복제한다.
    // 배치 도구는 한 번 놓으면 풀리므로(§6.10a 고정은 두 번 눌러야) 다시 고른다.
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    await user.click(screen.getByRole('button', { name: '사각' }));
    await user.pointer([{ target: stage, keys: '[MouseLeft]', coords: { clientX: 820, clientY: 520 } }]);
    const corner = await waitFor(() => {
      const all = [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];
      if (all.length !== 2) throw new Error(`도형이 ${all.length}개다`);
      return all[1]!;
    });
    fireEvent.contextMenu(corner, { clientX: 820, clientY: 520 });
    await waitFor(() => expect(menu()).not.toBeNull());
    await user.click(screen.getByRole('menuitem', { name: '복제' }));
    const copy = await waitFor(() => {
      const all = [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];
      if (all.length !== 3) throw new Error(`도형이 ${all.length}개다`);
      return all[2]!;
    });
    // 820+12.5 → 825 에서, 520+12.5 → 525 에서 멈춘다(validate 의 로드 클램프와 같은 기준).
    expect(translateOf(copy)).toEqual({ x: 825, y: 525 });
  });

  it('★ Ctrl+D 로도 복제된다 — 메뉴와 같은 함수라 오프셋(+12.5,+12.5)도 같다 (기현 지시 2026-08-18)', async () => {
    const { shape } = await openBoardWithShape();
    // 방금 놓은 도형은 선택돼 있다(PLACED). 메뉴 없이 키만 쏜다.
    fireEvent.keyDown(document, { code: 'KeyD', key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    const nodes = await waitFor(() => {
      const all = [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];
      if (all.length !== 2) throw new Error(`도형이 ${all.length}개다`);
      return all;
    });
    const [a, b] = [translateOf(nodes[0]!), translateOf(nodes[1]!)];
    expect(b.x - a.x).toBe(12.5);
    expect(b.y - a.y).toBe(12.5);
    // 사본이 선택됐으니 한 번 더 누르면 사본의 사본이 난다 — 층이 개체에 머무는 증인.
    fireEvent.keyDown(document, { code: 'KeyD', key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
    await waitFor(() => {
      const all = [...document.querySelectorAll('[data-shape-layer] > g[data-shape-id]')];
      if (all.length !== 3) throw new Error(`도형이 ${all.length}개다`);
    });
    expect(shape).toBeInTheDocument(); // 원본은 그대로다
  });

  it('★ 화살표도 복제된다 — 세 점이 통째로 +12.5,+12.5 (강체, 모양 보존)', async () => {
    // 2026-08-18 후속 지적("화살표에는 왜 복제 메뉴가 안 뜨나?") — 도형과 같은 문이다.
    const rect = { x: 0, y: 0, left: 0, top: 0, right: 825, bottom: 525, width: 825, height: 525, toJSON: () => ({}) } as DOMRect;
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^작도/ }));
    await user.click(screen.getByRole('button', { name: '선' }));
    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    // 선 도구는 드래그가 곧 화살표다 — (100,200) → (300,200). 무대의 pointermove 는 rAF
    // 틱에서야 controller 로 들어가므로(CourtStage §6.4 — 물리 호출은 rAF 하나에서만),
    // 버튼을 쥔 채 draft 가 늘어난 것을 **확인한 뒤** 뗀다. 동기로 down·move·up 을 쏘면
    // draft 길이가 0 인 채 up 이 되어 12px 문턱에서 버려진다.
    await user.pointer([
      { target: stage, keys: '[MouseLeft>]', coords: { clientX: 100, clientY: 200 } },
      { target: stage, coords: { clientX: 300, clientY: 200 } },
    ]);
    await waitFor(() => {
      const d = document.querySelector('#obj-ar_draft path')?.getAttribute('d') ?? '';
      const n = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
      // d = "Mx,y Qcx,cy tx,ty" — to.x(다섯째 숫자)가 from.x 에서 떨어져야 이동이 처리된 것
      if (n.length < 6 || Math.abs(n[4]! - n[0]!) < 12) throw new Error(`draft 미반영: ${d}`);
    });
    await user.pointer([{ target: stage, keys: '[/MouseLeft]', coords: { clientX: 300, clientY: 200 } }]);
    const arrowEl = await waitFor(() => {
      const el = document.querySelector('.court-obj[id^="obj-ar_"]');
      if (!el) throw new Error('화살표가 안 그어졌다');
      return el as SVGGElement;
    });
    fireEvent.contextMenu(arrowEl, { clientX: 200, clientY: 200 });
    await waitFor(() => expect(menu()).not.toBeNull());
    await user.click(screen.getByRole('menuitem', { name: '복제' }));

    const paths = await waitFor(() => {
      const all = [...document.querySelectorAll('.court-obj[id^="obj-ar_"]')];
      if (all.length !== 2) throw new Error(`화살표가 ${all.length}개다`);
      return all;
    });
    // ArrowPath 의 d = "Mx,y Qcx,cy tx,ty" — 원본↔사본의 여섯 숫자 차이가 전부 12.5 다.
    const nums = (el: Element): number[] =>
      (el.querySelector('path')?.getAttribute('d') ?? '').match(/-?[\d.]+/g)!.map(Number);
    const [a, b] = [nums(paths[0]!), nums(paths[1]!)];
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) expect(b[i]! - a[i]!).toBeCloseTo(12.5, 6);
  });
});

// ── ④ 브라우저 메뉴 (기현 신고 2026-08-14: *"오른쪽 버튼 클릭을 하면 크롬 메뉴가 나온다"*) ──
//
// ⚠️ **이 구멍이 왜 안 잡혔나** — 위 ② 는 개체 위 오른쪽 클릭만 쐈고, 그 길은 처음부터
// 멀쩡했다. 정작 새는 곳은 **빈 코트**였다(개체는 작아서 빗나가는 쪽이 오히려 흔하다).
// `fireEvent` 는 `dispatchEvent` 의 반환을 그대로 돌려준다 — `preventDefault` 가 불렸으면
// **false** 다. 그것이 "브라우저 메뉴가 뜨지 않는다" 의 유일한 기계적 증인이다.
describe('브라우저 기본 메뉴 — 코트 위에서는 언제나 막는다', () => {
  it('★ 빈 코트에서 오른쪽 클릭해도 크롬 메뉴가 안 뜬다', async () => {
    const { stage } = await openBoardWithChair();
    const notPrevented = fireEvent.contextMenu(stage, { clientX: 300, clientY: 300 });
    expect(notPrevented, '기본 동작이 살아 있다 — 크롬 메뉴가 뜬다').toBe(false);
  });

  it('빈 코트에서는 **우리 메뉴도** 안 뜬다 — 열 개체가 없다', async () => {
    const { stage } = await openBoardWithChair();
    fireEvent.contextMenu(stage, { clientX: 300, clientY: 300 });
    expect(menu()).toBeNull();
  });

  it('★ 오른쪽 버튼은 판을 **안 건드린다** — 배치 도구가 켜져 있어도 아무것도 안 놓인다', async () => {
    // ⚠️ 기현 신고 2026-08-15: *"칩들에게는 왼쪽, 오른쪽 마우스 버튼 동작이 똑같다."*
    // 무대 pointerdown 이 버튼을 안 보고 있었다 — 오른쪽 클릭이 왼쪽이 하는 일을 그대로 한 번
    // 더 했다(고르기·물리 드래그·배치·지우기). 그 위에 메뉴가 떴으니 둘이 같아 보였다.
    const { user, stage } = await openBoardWithChair();
    const count = () => document.querySelectorAll('.court-obj[id^="obj-ch_"]').length;
    expect(count()).toBe(1);

    await user.click(screen.getAllByRole('button', { name: /선수 배치$/ })[0]!); // 배치 무장
    fireEvent.pointerDown(stage, { pointerId: 7, pointerType: 'mouse', button: 2, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(stage, { pointerId: 7, pointerType: 'mouse', button: 2, clientX: 120, clientY: 120 });
    expect(count(), '오른쪽 클릭이 선수를 놓았다').toBe(1);

    // 대조군 — 같은 자리에 **왼쪽** 버튼이면 실제로 놓인다. 없으면 위 단언이 "이 하네스에서는
    // 원래 아무것도 안 놓인다" 로도 통과한다.
    fireEvent.pointerDown(stage, { pointerId: 8, pointerType: 'mouse', button: 0, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(stage, { pointerId: 8, pointerType: 'mouse', button: 0, clientX: 120, clientY: 120 });
    await waitFor(() => expect(count(), '대조군이 안 놓이면 위 단언이 공짜다').toBe(2));
  });

  it('★ 개체 위에서도 막는다 — 우리 메뉴와 크롬 메뉴가 겹쳐 뜨면 안 된다', async () => {
    const { chair } = await openBoardWithChair();
    const notPrevented = fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    expect(notPrevented, '개체 위에서 기본 동작이 살아 있다').toBe(false);
    await waitFor(() => expect(menu()).not.toBeNull());
  });
});
