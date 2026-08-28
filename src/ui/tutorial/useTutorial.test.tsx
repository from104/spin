// §0.5 도움말·튜토리얼 — 진행 상태 계약. 스포트라이트 좌표(getBoundingClientRect)는 jsdom
// 이 못 재므로 실기 몫이다(계획서 §E) — 여기서는 "대상이 있으면 시작·없으면 안 함·진행·
// 플래그" 라는 순수 계약만 못박는다.
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
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
  });

  it('prev() 는 첫 단계에서 더 못 내려간다', () => {
    const { result } = open();
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
