// [보드 설정] — 심플 모드에서는 [물리·상호작용]·[끌어 회전]·[앞뒤 앵커] 스위치 셋이 **안 보이고**, 숨겨도 저장값은 그대로다
// (2026-11-19 기현님 지시: *"기본, 심플 모드 완전 분리. 심플모드에서는 물리상호, 앵커로 잡아 끌기, 마우스로 끌어 회전 모두 보드
// 다이얼로그에서 숨겨."*).
// 지우면 새는 실기 버그: (1) 심플 모드에서 아무 일도 안 하는 스위치가 다이얼로그에 남아 눌리는 것, (2) 숨기는 김에 값을 꺼 버려
// 심플을 끈 뒤 물리·회전·앵커가 사용자 몰래 꺼져 있는 것("숨김은 초기화가 아니다").
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FunctionBar } from './FunctionBar.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { createDrill, DEFAULT_TEAMS } from '../../model/defaults.ts';
import { loadPrefs, makeDefaultPrefs, prunePhysics, savePrefs } from '../../storage/prefs.ts';

const noop = () => {};
const SWITCHES = ['court-toggle-interact', 'court-toggle-dragRotate', 'court-toggle-anchors'] as const;

afterEach(() => localStorage.clear());

function mount() {
  const drill = createDrill({ courtMode: 'full' });
  return render(
    <SettingsProvider>
      <ToastProvider>
        <FunctionBar
          showGridLabels
          stepIndex={0}
          onZoomIn={noop}
          onZoomOut={noop}
          onZoomReset={noop}
          canUndo
          canRedo
          onUndo={noop}
          onRedo={noop}
          courtMode="full"
          courtSize="30x18"
          courtLocked={false}
          onCourtModeChange={noop}
          onCourtSizeChange={noop}
          onLockedAttempt={noop}
          onResetGoals={noop}
          defense="home"
          teams={DEFAULT_TEAMS as typeof drill.teams}
          onToggleDefense={noop}
          onReset={noop}
          drill={drill}
          showGrid={false}
          onToggleGrid={noop}
          showRuleZones
          onToggleRuleZones={noop}
          stepEmpty={false}
        />
      </ToastProvider>
    </SettingsProvider>,
  );
}

describe('[보드 설정] — 심플 모드는 이동 스위치 셋을 숨기고 값은 남긴다', () => {
  it('★ 켜 둔 셋이 심플에서는 안 보이고, 심플을 끄면 켠 그대로 돌아온다', async () => {
    savePrefs({ ...makeDefaultPrefs(), physics: prunePhysics({ interact: true, dragRotate: true, anchors: true }), board: { simple: true } });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByTestId('fn-court'));
    for (const id of SWITCHES) expect(screen.queryByTestId(id), id).toBeNull();
    await user.click(screen.getByTestId('fn-simple')); // 심플 끔
    for (const id of SWITCHES) expect(screen.getByTestId(id).getAttribute('aria-pressed'), id).toBe('true');
    const p = loadPrefs().physics;
    expect([p.interact, p.dragRotate, p.anchors]).toEqual([true, true, true]);
  });
});
