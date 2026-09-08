// §0.5 도움말·튜토리얼 — 진행 상태 계약. 스포트라이트 좌표(getBoundingClientRect)는 jsdom
// 이 못 재므로 실기 몫이다(계획서 §E) — 여기서는 "대상이 있으면 시작·없으면 안 함·진행·
// 플래그" 라는 순수 계약만 못박는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { loadPrefs } from '../../storage/prefs.ts';
import { useTutorial } from './useTutorial.ts';
import type { TutorialStep } from './types.ts';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const STEPS: TutorialStep[] = [
  { target: 'a', titleKey: 'common.close', bodyKey: 'common.close' },
  { target: 'b', titleKey: 'common.close', bodyKey: 'common.close' },
];

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('useTutorial — 시작', () => {
  it('start() 는 DOM 에 있는 대상만 골라 첫 단계에서 연다', () => {
    document.body.innerHTML = '<div data-tut="a"></div><div data-tut="b"></div>';
    const { result } = renderHook(() => useTutorial('editor', STEPS, false), { wrapper });
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.step?.target).toBe('a');
  });

  it('대상 중 일부만 DOM 에 있으면 그 단계만 남는다', () => {
    document.body.innerHTML = '<div data-tut="b"></div>'; // a 없음
    const { result } = renderHook(() => useTutorial('editor', STEPS, false), { wrapper });
    act(() => result.current.start());
    expect(result.current.totalSteps).toBe(1);
    expect(result.current.step?.target).toBe('b');
  });

  it('대상이 하나도 없으면 시작하지 않는다 — 빈 화면 가드', () => {
    const { result } = renderHook(() => useTutorial('editor', STEPS, false), { wrapper });
    act(() => result.current.start());
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();
  });
});

describe('useTutorial — 자동 시작', () => {
  it('autoStart=true 이고 안 봤으면 마운트 뒤(rAF 한 틱) 시작한다', async () => {
    // rAF 한 틱을 미루는 이유: 헤더 버튼(header-primary 등, 여러 화면 공유)처럼 useAppHeader 발행이
    // 한 틱 늦게 뜨는 대상이 있어도 빈 화면 가드에 안 걸리게 하려는 것이다(useTutorial.ts 주석).
    document.body.innerHTML = '<div data-tut="a"></div>';
    const { result } = renderHook(() => useTutorial('editor', STEPS, true), { wrapper });
    expect(result.current.active).toBe(false);
    await waitFor(() => expect(result.current.active).toBe(true));
  });

  it('이미 본 화면이면 autoStart=true 여도 시작하지 않는다', () => {
    localStorage.setItem(
      'spin.prefs',
      JSON.stringify({ ...loadPrefs(), tutorialsSeen: { editor: true } }),
    );
    document.body.innerHTML = '<div data-tut="a"></div>';
    const { result } = renderHook(() => useTutorial('editor', STEPS, true), { wrapper });
    expect(result.current.active).toBe(false);
  });

  it('autoStart=false 면 마운트만으로는 안 열린다', () => {
    document.body.innerHTML = '<div data-tut="a"></div>';
    const { result } = renderHook(() => useTutorial('editor', STEPS, false), { wrapper });
    expect(result.current.active).toBe(false);
  });
});

describe('useTutorial — 진행·종료·플래그', () => {
  function open() {
    document.body.innerHTML = '<div data-tut="a"></div><div data-tut="b"></div>';
    const r = renderHook(() => useTutorial('board', STEPS, false), { wrapper });
    act(() => r.result.current.start());
    return r;
  }

  it('next() 로 다음 단계, prev() 로 되돌아간다', () => {
    const { result } = open();
    act(() => result.current.next());
    expect(result.current.stepIndex).toBe(1);
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(0);
    // 첫 단계에서 prev() 를 또 불러도 더 못 내려간다(clamp).
    act(() => result.current.prev());
    expect(result.current.stepIndex).toBe(0);
  });

  it('마지막 단계에서 next() 를 부르면 종료하고 tutorialsSeen 플래그를 찍는다', () => {
    const { result } = open();
    act(() => result.current.next()); // → 1(마지막)
    act(() => result.current.next()); // 마지막에서 다음 = 완료
    expect(result.current.active).toBe(false);
    expect(loadPrefs().tutorialsSeen.board).toBe(true);
  });

  it('skip() 도 같은 플래그를 찍는다 — Esc·[건너뛰기]와 같은 뜻', () => {
    const { result } = open();
    act(() => result.current.skip());
    expect(result.current.active).toBe(false);
    expect(loadPrefs().tutorialsSeen.board).toBe(true);
  });
});

// 실습형(advanceOnClick, docs/PLAN-HELP-OVERHAUL.md 결정 11a) — "구멍 안 대상을 실제로 누르는
// 것이 곧 [다음]" 이라는 계약. 좌표(구멍이 정말 그 자리인가)는 jsdom 이 못 재므로 실기 몫이고,
// 여기서 지키는 것은 **무엇이 얼마나 넘어가는가** 다.
describe('useTutorial — 실습형 단계', () => {
  const PRACTICE: TutorialStep[] = [
    { target: 'a', titleKey: 'common.close', bodyKey: 'common.close', advanceOnClick: true },
    { target: 'b', titleKey: 'common.close', bodyKey: 'common.close' },
  ];

  function open(steps: TutorialStep[]) {
    document.body.innerHTML = '<div data-tut="a"><button type="button">안</button></div><div data-tut="b"></div>';
    const r = renderHook(() => useTutorial('board', steps, false), { wrapper });
    act(() => r.result.current.start());
    return r;
  }

  it('대상 안을 누르면 다음 단계로 간다 — 앵커 자신이 아니라 그 **안의** 버튼을 눌러도 같다', () => {
    const { result } = open(PRACTICE);
    expect(result.current.stepIndex).toBe(0);
    act(() => {
      fireEvent.click(document.querySelector('[data-tut="a"] button')!);
    });
    expect(result.current.stepIndex).toBe(1);
  });

  // 실제 탭 하나는 pointerup 과 click 을 **둘 다** 낸다. 둘을 다 듣는 이유(대상이 사라지는
  // 버튼에서는 click 이 안 날 수 있다)는 useTutorial 의 주석에 있고, 여기서 지키는 것은 그
  // 대가로 두 칸이 넘어가지 않는다는 것이다 — 넘어갔다면 두 단계짜리 투어가 끝나 버린다.
  it('pointerup 과 click 이 잇따라 나도 한 칸만 간다', () => {
    const { result } = open(PRACTICE);
    const el = document.querySelector('[data-tut="a"]')!;
    act(() => {
      fireEvent.pointerUp(el);
      fireEvent.click(el);
    });
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.active).toBe(true);
  });

  it('advanceOnClick 이 없는 단계에서는 대상을 눌러도 그대로다', () => {
    const { result } = open([
      { target: 'a', titleKey: 'common.close', bodyKey: 'common.close' }, // 실습형 아님
      { target: 'b', titleKey: 'common.close', bodyKey: 'common.close' },
    ]);
    act(() => {
      fireEvent.click(document.querySelector('[data-tut="a"] button')!);
    });
    expect(result.current.stepIndex).toBe(0);
  });

  it('다른 대상을 눌러도 안 넘어간다 — 앵커가 맞아야 한다', () => {
    const { result } = open(PRACTICE);
    act(() => {
      fireEvent.click(document.querySelector('[data-tut="b"]')!);
    });
    expect(result.current.stepIndex).toBe(0);
  });

  it('마지막 실습형 단계를 누르면 끝나고 플래그가 찍힌다', () => {
    const { result } = open([{ target: 'a', titleKey: 'common.close', bodyKey: 'common.close', advanceOnClick: true }]);
    act(() => {
      fireEvent.click(document.querySelector('[data-tut="a"]')!);
    });
    expect(result.current.active).toBe(false);
    expect(loadPrefs().tutorialsSeen.board).toBe(true);
  });
});

describe('useTutorial — [자세한 도움말]', () => {
  it('onOpenHelp 를 주면 openHelp 가 서고, 부르면 닫으면서 플래그를 찍고 도움말을 연다', () => {
    document.body.innerHTML = '<div data-tut="a"></div>';
    const onOpenHelp = vi.fn();
    const { result } = renderHook(() => useTutorial('board', STEPS, false, { onOpenHelp }), { wrapper });
    act(() => result.current.start());
    act(() => result.current.openHelp!());
    expect(result.current.active).toBe(false);
    expect(loadPrefs().tutorialsSeen.board).toBe(true);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('안 주면 openHelp 자체가 없다 — 오버레이가 버튼을 안 그리는 근거', () => {
    document.body.innerHTML = '<div data-tut="a"></div>';
    const { result } = renderHook(() => useTutorial('board', STEPS, false), { wrapper });
    expect(result.current.openHelp).toBeUndefined();
  });
});

// 화면을 가로지르는 투어(2026-09-09, docs/PLAN-TEAM.md 결정 23). 팀 투어는 목록에서 [새 팀] 을
// 누르면 상세가 열리고 거기서 세 단계가 더 이어진다 — 시작 시점엔 그 앵커들이 DOM 에 없다.
// 이 계약이 깨지면 투어가 «2/2» 로 끝나 ★실습(선수 추가)에 **도달조차 못 한다**(그 증상을
// 2026-09-09 헤드리스 관문에서 실제로 봤다).
describe('useTutorial — 뒤늦게 오는 단계', () => {
  const CROSS: TutorialStep[] = [
    { target: 'a', titleKey: 'common.close', bodyKey: 'common.close', advanceOnClick: true },
    { target: 'b', titleKey: 'common.close', bodyKey: 'common.close' },
    { target: 'c', titleKey: 'common.close', bodyKey: 'common.close' },
  ];

  it('실습형을 누른 뒤 나타난 앵커만 뒤 단계로 붙는다 — 끝내 없는 앵커는 안 붙는다', async () => {
    document.body.innerHTML = '<div data-tut="a"><button type="button">새 팀</button></div>';
    const { result } = renderHook(() => useTutorial('team', CROSS, false), { wrapper });
    act(() => result.current.start());
    expect(result.current.totalSteps).toBe(1); // b·c 는 아직 다른 화면에 있다

    act(() => {
      fireEvent.click(document.querySelector('[data-tut="a"] button')!);
    });
    // 실제 화면에서는 이 사이에 저장(IDB)과 화면 전환이 끼어 앵커가 몇 프레임 뒤에 생긴다.
    // c 는 **끝까지 안 만든다** — 없는 단계를 지어내지 않는다는 것이 빈 화면 가드다.
    act(() => {
      document.body.insertAdjacentHTML('beforeend', '<div data-tut="b"></div>');
    });

    await waitFor(() => expect(result.current.step?.target).toBe('b'));
    expect(result.current.active).toBe(true);
    expect(result.current.totalSteps).toBe(2);
  });

  // 2026-09-09(검수) — 위 케이스는 «끝내 없는 c» 만 잰다. 실기의 다른 절반은 **부분 도착**이다:
  // 팀 상세의 꼬리 셋(선수 추가·라인업·내보내기)이 한 프레임에 다 서지 않는 기기에서 뒤엣것이
  // 먼저 서면, «보이는 것 전부를 붙이고 즉시 대기 종료» 하던 옛 코드는 그 사이 단계를 영영
  // 못 붙였다. 이 케이스를 지우면 느린 기기에서 투어가 3/3 으로 조용히 잘린다.
  it('b 는 즉시, c 는 몇 프레임 뒤에 와도 둘 다 붙는다 — 부분 도착', async () => {
    document.body.innerHTML = '<div data-tut="a"><button type="button">새 팀</button></div>';
    const { result } = renderHook(() => useTutorial('team', CROSS, false), { wrapper });
    act(() => result.current.start());

    act(() => {
      fireEvent.click(document.querySelector('[data-tut="a"] button')!);
    });
    act(() => {
      document.body.insertAdjacentHTML('beforeend', '<div data-tut="b"></div>');
    });
    await waitFor(() => expect(result.current.step?.target).toBe('b'));
    expect(result.current.totalSteps).toBe(2);

    // c 가 **뒤늦게** 도착한다 — 대기가 아직 살아 있어야 이것을 받는다.
    act(() => {
      document.body.insertAdjacentHTML('beforeend', '<div data-tut="c"></div>');
    });
    await waitFor(() => expect(result.current.totalSteps).toBe(3));
    // ★ 사용자가 안 누른 칸을 건너뛰지 않는다 — 붙일 때마다 index 를 올리면 여기가 2 가 된다.
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.step?.target).toBe('b');
    expect(result.current.active).toBe(true);
  });
});
