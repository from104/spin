// 개체 메뉴 — 잠김 · 무시 · 삭제 (2026-08-14 기현 지시).
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

  it('대조군: 미세한 흔들림으로는 안 접힌다 — 발 마우스·입 젓가락은 완전히 정지하지 못한다', () => {
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
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
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
  it('휠체어를 오른쪽 클릭하면 잠금 · 무시 · 삭제가 뜬다', async () => {
    const { chair } = await openBoardWithChair();
    expect(menu()).toBeNull(); // 대조군
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await waitFor(() => expect(menu()).not.toBeNull());
    for (const name of ['잠금', '무시', '삭제']) {
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

  it('삭제하면 개체가 사라진다', async () => {
    const { user, chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: '삭제' }));
    await waitFor(() => expect(document.querySelector('.court-obj[id^="obj-ch_"]')).toBeNull());
  });

  it('Esc 로 닫힌다', async () => {
    const { chair } = await openBoardWithChair();
    fireEvent.contextMenu(chair, { clientX: 40, clientY: 40 });
    await waitFor(() => expect(menu()).not.toBeNull());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(menu()).toBeNull());
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
