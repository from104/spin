// 튜토리얼 자동 시작 게이트 계약 — docs/PLAN-0-6-3-LOADER-NOTICE.md 결정 30.
//
// 지우면 새는 버그 셋(전부 **조용히** 샌다 — 화면에 에러가 안 뜬다):
//  ① 게이트가 안 걸려 로더·안내 모달 위로 스포트라이트가 뚫고 나온다(z 300 > 220).
//  ② ready 가 effect 의존성에서 빠져, 로더가 걷혀도 자동 시작이 영영 이어지지 않는다.
//  ③ 컨텍스트 기본값을 false 로 뒤집어, Provider 를 안 세운 모든 트리(화면 단독 마운트·
//     기존 테스트 36파일)에서 자동 시작이 통째로 증발한다.
// 스포트라이트 좌표·겹침은 jsdom 이 못 잰다(계획서 §4-20 실기 몫) — 여기서는 "시작하는가"
// 라는 상태 계약만 본다.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { TutorialGateProvider } from './tutorialGate.tsx';
import { useTutorial } from './useTutorial.ts';
import type { TutorialStep } from './types.ts';

const STEPS: TutorialStep[] = [{ target: 'a', titleKey: 'common.close', bodyKey: 'common.close' }];

/** 자동 시작 여부만 글자로 내보내는 최소 소비자 — 수동 start() 도 밖에서 부를 수 있게 새어 둔다. */
let manualStart: (() => void) | null = null;

function Probe() {
  const tut = useTutorial('editor', STEPS, true);
  manualStart = tut.start;
  return <div data-testid="tut">{tut.active ? 'on' : 'off'}</div>;
}

function Tree({ ready }: { ready: boolean }) {
  return (
    <SettingsProvider>
      <TutorialGateProvider ready={ready}>
        <Probe />
      </TutorialGateProvider>
    </SettingsProvider>
  );
}

/** 자동 시작은 rAF 재시도 루프를 타므로 "아직 안 떴다" 는 몇 프레임을 기다린 뒤에야 참말이다. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div data-tut="a"></div>';
  manualStart = null;
});

describe('튜토리얼 자동 시작 게이트', () => {
  it('ready=false 동안은 자동 시작하지 않고, true 가 되면 그때 이어진다', async () => {
    const { rerender } = render(<Tree ready={false} />);
    await settle();
    expect(screen.getByTestId('tut').textContent).toBe('off');
    rerender(<Tree ready />);
    await waitFor(() => expect(screen.getByTestId('tut').textContent).toBe('on'));
  });

  it('수동 시작은 게이트와 무관하다 — ready=false 라도 열린다', async () => {
    render(<Tree ready={false} />);
    await settle();
    manualStart?.();
    await waitFor(() => expect(screen.getByTestId('tut').textContent).toBe('on'));
  });

  it('Provider 밖에서는 기본값 true 라 게이트가 없던 때와 같다', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = renderHook(() => useTutorial('editor', STEPS, true), { wrapper });
    await waitFor(() => expect(result.current.active).toBe(true));
  });
});
