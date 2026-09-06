// 6.2(2026-08-13) — 접근성 섹션 정렬: 2.11(소리·햅틱)·5.5(2존)·5.6(고대비)이 각자 다른 차수에
// 붙으며 흩어진 것을 한 섹션으로 모으고, **설명문이 실제 동작과 일치**하는지를 못박는다.
//
// "주석이 사실인지 확인하는 테스트가 없으면 주석은 언젠가 거짓이 된다" — 이 저장소가 이미 겪은
// 사고다(감사 2026-08-08: '자동 재생에만 적용' 설명문). 그래서 여기의 단언은 문자열 존재가 아니라
// **설명문의 각 주장 ↔ 그 주장을 구현하는 실제 함수/상수/CSS** 의 짝이다:
//   큰 터치 타깃  ↔ INTERACT.hitTargetCssPx/hitTargetLargeCssPx + tokens.css --hit
//   2존 모드      ↔ handlesVisible·applyTwoZone (편집기가 실제로 부르는 판정 함수)
//   놓임 소리·진동 ↔ cueSpec 3종 + createCuePlayer 의 enabled 게이트
//   모션 줄이기    ↔ effectiveReduceMotion·stepTransitionMs (트윈 시간의 단일 출처)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { SettingsScreen } from './SettingsScreen.tsx';
import type { HomeNav } from '../home/nav.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { loadPrefs } from '../../storage/prefs.ts';
import { INTERACT } from '../../core/constants.ts';
import { applyTwoZone, handlesVisible } from '../../physics/index.ts';
import type { HitResult } from '../../physics/hitTest.ts';
import { cueSpec } from '../../ui/cueSpec.ts';
import type { CueKind } from '../../ui/cueSpec.ts';
import { createCuePlayer } from '../../ui/cues.ts';
import { effectiveReduceMotion, stepTransitionMs } from '../../store/editor/tween.ts';
import { createDrill } from '../../model/defaults.ts';

/** HomeNav 목 — 이 화면은 2026-09-06 부터 `nav` 를 받는다(법 문서 링크가 앱 화면 전환이 되면서).
 *  설정 절들 자체는 nav 를 안 쓰므로 전부 no-op 이면 된다. */
function makeNav(): HomeNav {
  return {
    newDrill: vi.fn(),
    openDrill: vi.fn(),
    goLibrary: vi.fn(),
    openSession: vi.fn(),
    presentDrill: vi.fn(),
    presentSession: vi.fn(),
    openRuleTopic: vi.fn(),
    openLegal: vi.fn(),
  };
}


const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>{children}</ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  // SettingsProvider 의 reduce-motion 부작용이 documentElement 에 남아 다음 테스트를 오염시킨다.
  delete document.documentElement.dataset.reduceMotion;
});

describe('6.2 ② 설명문 ↔ 실제 동작', () => {
  it('큰 터치 타깃 — 설명문의 숫자는 INTERACT 상수에서 오고, tokens.css 의 --hit 도 같은 값이다', async () => {
    render(<SettingsScreen nav={makeNav()} />, { wrapper });
    // 설명문이 상수를 그대로 읽으므로 상수가 바뀌면 문장도 따라온다 — 리터럴 드리프트가 불가능하다.
    expect(
      screen.getByText(new RegExp(`집기 반경이 ${INTERACT.hitTargetCssPx} → ${INTERACT.hitTargetLargeCssPx}px`)),
    ).toBeInTheDocument();
    // CSS 쪽(버튼·트레이 칩의 min-height)도 같은 두 숫자다 — 한쪽만 바뀌면 설명문이 절반 거짓이 된다.
    const css = readFileSync('src/styles/tokens.css', 'utf-8');
    expect(css).toMatch(new RegExp(`--hit:\\s*${INTERACT.hitTargetCssPx}px`));
    expect(css).toMatch(new RegExp(`body\\[data-touch="large"\\]\\s*\\{[^}]*--hit:\\s*${INTERACT.hitTargetLargeCssPx}px`, 's'));
    // 토글 → prefs (body[data-touch] 배선 자체는 app-shell 소유 — App.tsx).
    await userEvent.setup().click(screen.getByRole('switch', { name: '큰 터치 타깃' }));
    expect(loadPrefs().a11y.largeTargets).toBe(true);
  });

  it('2존 모드 — "차체 아무 곳을 잡아도 통째로": 토글 값이 실제 판정(applyTwoZone)을 뒤집는다', async () => {
    render(<SettingsScreen nav={makeNav()} />, { wrapper });
    expect(screen.getByText(/차체 아무 곳을 잡아도 통째로 움직입니다/)).toBeInTheDocument();

    // hitTest 가 만드는 것과 같은 모양의 차체 히트(존은 아직 없다 — 잡은 s 로 나중에 갈린다).
    const bodyHit: HitResult = { kind: 'chair', id: 'c1', s: 0.5 };

    // 대조군(기본 꺼짐): 히트가 손대지지 않고 그대로 나온다 = 4존 판정으로 간다.
    expect(handlesVisible(0.66, 'touch', loadPrefs().a11y.twoZone)).toBe(false);
    expect(applyTwoZone(bodyHit, handlesVisible(0.66, 'touch', loadPrefs().a11y.twoZone))).toBe(bodyHit);

    await userEvent.setup().click(screen.getByRole('switch', { name: '2존 모드' }));
    expect(loadPrefs().a11y.twoZone).toBe(true);
    // 켠 값이 편집기의 실제 호출 경로(useEditorPointer: handlesVisible → applyTwoZone)를 지나면
    // 차체 히트가 통째 이동(translate)이 된다 — 배율·포인터 종류는 답을 바꾸지 못한다(§9-④).
    expect(applyTwoZone(bodyHit, handlesVisible(0.66, 'touch', loadPrefs().a11y.twoZone)).zone).toBe('translate');
    expect(applyTwoZone(bodyHit, handlesVisible(2.0, 'mouse', loadPrefs().a11y.twoZone)).zone).toBe('translate');

    // 뒷문장 "회전·견인은 차체 밖 앞뒤 가이드로만" — 가이드(zoneHandle) 히트는 덮지 않는다.
    // 여기까지 translate 로 덮으면 회전 수단이 통째로 사라진다(twoZone.ts 머리말의 사고).
    const handleHit: HitResult = { kind: 'zoneHandle', id: 'c1', zone: 'towFront' };
    expect(applyTwoZone(handleHit, true)).toEqual(handleHit);
  });

  it('놓임 소리·진동 — 설명문의 세 사건이 신호 목록의 전부이고, 끄면 소리도 진동도 없다', async () => {
    render(<SettingsScreen nav={makeNav()} />, { wrapper });
    // "놓거나(drop) 막히거나(blocked) 트레이로 되돌릴 때(trayReturn)" — CueKind 3종과 1:1.
    // 셋 다 소리(gain>0)와 진동(vibrateMs>0)을 **둘 다** 낸다 — "소리와 진동" 이 과장이 아니다.
    for (const kind of ['drop', 'blocked', 'trayReturn'] as CueKind[]) {
      const spec = cueSpec(kind);
      expect(spec.gain, `${kind} 는 소리가 없다`).toBeGreaterThan(0);
      expect(spec.vibrateMs, `${kind} 는 진동이 없다`).toBeGreaterThan(0);
    }

    // 대조군(기본 켬): prefs 값을 게이트에 넣으면 진동이 나간다.
    const onDeps = { makeContext: vi.fn(() => null), render: vi.fn(), vibrate: vi.fn() };
    const onPlayer = createCuePlayer(onDeps);
    onPlayer.setEnabled(loadPrefs().a11y.sound);
    onPlayer.play('drop');
    expect(onDeps.vibrate).toHaveBeenCalledWith(cueSpec('drop').vibrateMs);

    // 화면에서 끈다 → prefs → 게이트: 진동도 없고 AudioContext 를 **열려고 하지도** 않는다
    // (ui/cues.ts 계약 ① — 껐는데 열리면 자동재생 경고·배터리·오디오 포커스가 전부 따라온다).
    await userEvent.setup().click(screen.getByRole('switch', { name: '놓임 소리·진동' }));
    expect(loadPrefs().a11y.sound).toBe(false);
    const offDeps = { makeContext: vi.fn(() => null), render: vi.fn(), vibrate: vi.fn() };
    const offPlayer = createCuePlayer(offDeps);
    offPlayer.setEnabled(loadPrefs().a11y.sound);
    offPlayer.play('drop');
    expect(offDeps.vibrate).not.toHaveBeenCalled();
    expect(offDeps.makeContext).not.toHaveBeenCalled();
  });

  it('모션 줄이기 — "끕니다": 항상 켬이면 전환 시간의 단일 출처가 0 을 돌려준다', async () => {
    // jsdom 에 matchMedia 가 없다 — 'system' 경로가 실제로 실행되도록 스텁을 깐다(끔 상태).
    const orig = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    try {
      render(<SettingsScreen nav={makeNav()} />, { wrapper });
      expect(screen.getByText(/전환 애니메이션을 끕니다/)).toBeInTheDocument();

      const step = createDrill({ courtMode: 'full' }).steps[0]!;
      // 대조군 — 시스템 따름 + 시스템 미요청이면 전환 시간이 실제로 있다(0 이 아니다).
      expect(effectiveReduceMotion(loadPrefs().a11y.reduceMotion)).toBe(false);
      expect(stepTransitionMs(step, { immediate: false, reduceMotion: effectiveReduceMotion(loadPrefs().a11y.reduceMotion) })).toBeGreaterThan(0);

      await userEvent.setup().click(screen.getByRole('radio', { name: '항상 켬' }));
      expect(loadPrefs().a11y.reduceMotion).toBe('always');
      // '끈다' 의 실체: 트윈·페이드의 단일 출처(stepTransitionMs)가 0 — 애니메이션이 생기지 않는다.
      expect(stepTransitionMs(step, { immediate: false, reduceMotion: effectiveReduceMotion(loadPrefs().a11y.reduceMotion) })).toBe(0);
      // CSS 쪽 가드(SettingsProvider → html[data-reduce-motion]) 도 같은 값에서 켜진다.
      expect(document.documentElement.dataset.reduceMotion).toBe('true');
    } finally {
      window.matchMedia = orig;
    }
  });
});
