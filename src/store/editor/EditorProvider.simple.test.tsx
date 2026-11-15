// 심플 모드(휠체어 = 원)는 물리 상호작용을 **원천적으로** 끈다 — PLAN-SIMPLE-DRIVE 결정 A5.
// 저장된 `physics.interact`(켬)를 건드리지 않고, 월드에 넘기는 값만 접는다. 이 배선이 빠지면
// 원 두 개를 겹쳐 끌 때 서로 밀려 나가고("표시만 원, 물리 없음" 위반) 화면만 단순해진다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PhysicsWorldApi } from '../../physics/index.ts';
import { createDrill } from '../../model/defaults.ts';
import { makeDefaultPrefs, prunePhysics, savePrefs } from '../../storage/prefs.ts';
import { SettingsProvider } from '../settings/SettingsProvider.tsx';
import { EditorProvider, useEditorWorld } from './EditorProvider.tsx';

const worlds: Array<{ setInteract: MockInstance<(on: boolean) => void> }> = [];
vi.mock('../../physics/index.ts', async (orig) => {
  const m = await orig<typeof import('../../physics/index.ts')>();
  return {
    ...m,
    createPhysicsWorld: (...a: Parameters<typeof m.createPhysicsWorld>): PhysicsWorldApi => {
      const w = m.createPhysicsWorld(...a);
      worlds.push({ setInteract: vi.spyOn(w, 'setInteract') });
      return w;
    },
  };
});

afterEach(() => {
  worlds.length = 0;
  localStorage.clear();
});

function mountWith(simple: boolean): void {
  savePrefs({ ...makeDefaultPrefs(), physics: prunePhysics({ interact: true }), board: { simple } });
  const drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <EditorProvider drill={drill}>{children}</EditorProvider>
    </SettingsProvider>
  );
  renderHook(() => useEditorWorld(), { wrapper });
}

describe('심플 모드의 물리 상호작용 강제 끔', () => {
  it('저장값이 켬이어도 심플 모드면 월드의 setInteract 는 끈다', () => {
    mountWith(true);
    const calls = worlds.flatMap((w) => w.setInteract.mock.calls.map((c) => c[0]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((v) => v === false)).toBe(true);
  });
  it('심플 모드가 아니면 저장값(켬)을 그대로 따른다', () => {
    mountWith(false);
    const calls = worlds.flatMap((w) => w.setInteract.mock.calls.map((c) => c[0]));
    expect(calls.at(-1)).toBe(true);
  });
});
