// 6차 검증 — **설정 [재생] > '마지막 스텝에서 반복' 이 재생에 실제로 닿는가.**
//
// 미배송 감사(6차)의 C1 이고, 이 재편이 겪은 *"저장은 되는데 화면엔 없다"* 의 교과서적 형태다.
// 발견 당시 실측: `prefs.loop` 는 저장·마이그레이션·검증·백업 봉투를 전부 왕복하는데,
// **프로덕션에서 그 값을 읽는 곳이 설정 토글 자기 자신 딱 1곳**이었다(`rg 'prefs\.loop' src`).
// `PlaybackProvider` 는 `initialSpeed` 는 받으면서 loop 는 `useState(false)` 하드코딩이라,
// 설정에서 반복을 켜고 시연에 들어가도 마지막 스텝에서 그냥 멎었다. 설정 행의 설명문
// *"끝나면 처음 스텝으로 되돌아갑니다"* 는 그래서 **거짓**이었다.
//
// ⚠️ 되돌리면 무엇이 깨지는가:
//   · `PlaybackProvider` 의 `initialLoop` 를 `useState(false)` 로 되돌리면 → ①②③ 이 빨개진다.
//   · 세 화면 중 **하나**에서 `initialLoop={prefs.loop}` 를 빼면 → ④ 가 그 화면을 지목한다.
//
// 축: 값 왕복(provider 단위) · 실제 화면(시연 렌더) · 배선 지점 **전수 열거**(세 화면).
// 열거를 쓰는 이유는 커밋 119dea0 의 교훈이다 — "이름이 있는가" 가 아니라 "달아야 하는 자리가
// 몇 개인가" 를 물어야 네 번째 자리가 생겼을 때 빨개진다.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PlaybackProvider, usePlaybackState } from './PlaybackProvider.tsx';
import { PresentRunner } from '../../features/present/PresentRunner.tsx';
import { SettingsProvider } from '../settings/SettingsProvider.tsx';
import { ToastProvider } from '../toast/ToastProvider.tsx';
import { HeaderProvider } from '../../app/AppHeader.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { newId } from '../../core/ids.ts';

afterEach(cleanup);

function LoopProbe() {
  const { loop } = usePlaybackState();
  return <span data-testid="loop">{String(loop)}</span>;
}

describe('① PlaybackProvider 가 initialLoop 를 받는다', () => {
  it('initialLoop={true} 면 loop 가 true 로 태어난다', () => {
    render(
      <PlaybackProvider initialLoop>
        <LoopProbe />
      </PlaybackProvider>,
    );
    expect(screen.getByTestId('loop').textContent).toBe('true');
  });

  it('대조군: 생략하면 false 다 — 위 통과가 "무엇을 넣어도 true" 가 아니다', () => {
    render(
      <PlaybackProvider>
        <LoopProbe />
      </PlaybackProvider>,
    );
    expect(screen.getByTestId('loop').textContent).toBe('false');
  });
});

const PresentWrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <ToastProvider>
      <HeaderProvider>{children}</HeaderProvider>
    </ToastProvider>
  </SettingsProvider>
);

/** 스텝 2개짜리 드릴 하나. 시연 화면의 반복 버튼 상태만 볼 것이므로 최소 구성이다. */
async function makeDrill() {
  const tag = Math.random().toString(36).slice(2, 7);
  const base = await idbDrillRepo.createDrill({ courtMode: 'full', title: `반복 드릴 ${tag}`, durationMin: 5 });
  const s0 = base.steps[0]!;
  const steps = [0, 1].map((i) => ({ ...s0, id: newId('st'), name: `스텝 ${i + 1}` }));
  return idbDrillRepo.putDrill({ ...base, steps }, { touch: false });
}

describe('② 실제 화면 — 설정을 켜고 시연에 들어가면 반복이 켜져 있다', () => {
  // ⚠️ 마운트 직후가 아니라 **버튼이 실제로 뜬 뒤** 잰다. 5차 검증관이 지적한 함정이 이것이다:
  //    provider 를 마운트 직후만 재면 뒤늦은 effect 가 값을 고쳐 줘서, 배선을 끊어도 초록이 난다.
  const loopBtn = () => screen.getByRole('button', { name: /반복 (켜기|끄기)/ });

  it('prefs.loop=true → 시연 화면의 반복 버튼이 켜진 상태로 뜬다', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), loop: true }));
    const drill = await makeDrill();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={{ back: () => {}, go: () => {} }} />, { wrapper: PresentWrapper });
    await waitFor(() => expect(loopBtn()).toBeInTheDocument());
    await waitFor(() => expect(loopBtn()).toHaveAttribute('aria-pressed', 'true'));
    expect(loopBtn()).toHaveAttribute('aria-label', '반복 끄기');
  }, 20000);

  it('대조군: prefs.loop=false → 꺼진 상태다 (같은 화면을 두 번 잰 것이 아니다)', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), loop: false }));
    const drill = await makeDrill();
    render(<PresentRunner target={{ kind: 'drill', drillId: drill.id }} nav={{ back: () => {}, go: () => {} }} />, { wrapper: PresentWrapper });
    await waitFor(() => expect(loopBtn()).toBeInTheDocument());
    await waitFor(() => expect(loopBtn()).toHaveAttribute('aria-pressed', 'false'));
    expect(loopBtn()).toHaveAttribute('aria-label', '반복 켜기');
  }, 20000);
});

describe('③ 편집기·전술판 재생도 같은 값을 본다', () => {
  it('useStepPlayback 이 usePlaybackState().loop 를 읽는다 — 세 화면이 한 스위치를 공유하는 근거', () => {
    const src = readFileSync('src/features/editor/useStepPlayback.ts', 'utf-8');
    expect(src).toContain('usePlaybackState()');
    expect(src).toMatch(/\bloop\b/);
  });
});

describe('④ 배선 지점 전수 열거 — PlaybackProvider 를 세우는 화면 전부가 prefs.loop 를 내린다', () => {
  const MOUNTS = [
    { name: '전술판', file: 'src/features/board/BoardScreen.tsx' },
    { name: '드릴 편집기', file: 'src/features/editor/EditorScreen.tsx' },
    { name: '시연', file: 'src/features/present/PresentRunner.tsx' },
  ] as const;

  it('대조군 — 열거가 프로덕션의 실제 마운트 지점 전량이다(하나 늘면 여기가 먼저 빨개진다)', () => {
    // src 전역에서 `<PlaybackProvider` 를 쓰는 **비테스트** 파일을 직접 훑는다. 목록이 낡으면
    // 아래 it.each 는 새 화면을 영영 안 본다 — 그 헛통과를 막는 것이 이 대조군의 전부다.
    const found = new Set<string>();
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          if (readFileSync(p, 'utf-8').includes('<PlaybackProvider')) found.add(p);
        }
      }
    };
    walk('src');
    expect([...found].sort()).toEqual(MOUNTS.map((m) => m.file).sort());
  });

  it.each(MOUNTS)('$name ($file) 이 initialLoop={prefs.loop} 를 내린다', ({ file }) => {
    expect(readFileSync(file, 'utf-8')).toContain('initialLoop={prefs.loop}');
  });
});
