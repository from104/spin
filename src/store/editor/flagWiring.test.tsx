// 잠김·무시를 켜면 **물리가 그 자리에서 다시 선다** (기현 신고 2026-08-15).
//
// ⚠️ **이 파일이 없어서 놓친 것** — physics 쪽 테스트(ignoredChair.test.ts)는 `world.load` 를
// **직접** 부르므로 언제나 초록이었다. 그런데 화면에서 플래그를 켜는 길은 리듀서이고,
// EditorProvider 의 재로드 이펙트는 자세 편집을 걸러 내려고 deps 에서 `steps` 를 통째로 뺐다.
// 그래서 메뉴에서 잠가도 **다음 스텝 전환이나 되돌리기 전까지 물리에 한 글자도 안 닿았다.**
// 잠갔는데 옆 칩에 계속 밀려나던 것, 무시했는데 공이 계속 부딪히던 것이 이것이다.
//
// 재는 방법: **무시**는 body 를 없애므로 `read()` 스냅샷에서 사라지는 것으로 관측된다.
// 잠김도 같은 재로드를 타므로(같은 이펙트), 이 한 축이 배선의 증인이다.
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { ChairId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import { SettingsProvider } from '../settings/SettingsProvider.tsx';
import { EditorProvider, useEditorDispatch, useEditorWorld } from './EditorProvider.tsx';

let probe: {
  ids(): string[];
  flag(f: 'locked' | 'ignored', id: string, on: boolean): void;
} | null = null;

function Probe() {
  const worldRef = useEditorWorld();
  const dispatch = useEditorDispatch();
  probe = {
    ids: () => Object.keys(worldRef.current?.read() ?? {}),
    flag: (f, id, on) => dispatch({ type: 'FLAG_SET', flag: f, id, on }),
  };
  return null;
}

function mount() {
  const drill = createDrill({ courtMode: 'full', formation: '1-2-1' });
  render(
    <SettingsProvider>
      <EditorProvider drill={drill}>
        <Probe />
      </EditorProvider>
    </SettingsProvider>,
  );
  return drill.cast.chairs[0]!.id as ChairId;
}

afterEach(() => {
  cleanup();
  probe = null;
});

describe('플래그를 켜면 물리가 다시 선다', () => {
  it('★ 무시를 켜면 그 칩의 body 가 **그 자리에서** 사라진다', () => {
    const id = mount();
    expect(probe!.ids(), '대조군: 처음부터 없으면 아래 단언이 공짜다').toContain(id);

    act(() => probe!.flag('ignored', id, true));
    expect(probe!.ids(), '무시했는데 물리에 남아 있다 — 재로드가 안 걸렸다').not.toContain(id);
  });

  it('★ 무시를 끄면 되돌아온다 — 한 방향으로만 도는 배선이 아니다', () => {
    const id = mount();
    act(() => probe!.flag('ignored', id, true));
    act(() => probe!.flag('ignored', id, false));
    expect(probe!.ids(), '풀었는데 물리에 안 돌아왔다').toContain(id);
  });

  it('다른 칩은 그대로다 — 재로드가 판을 통째로 비우고 있지 않다', () => {
    const id = mount();
    const before = probe!.ids().length;
    act(() => probe!.flag('ignored', id, true));
    expect(probe!.ids().length, '한 칩을 무시했는데 여러 개가 사라졌다').toBe(before - 1);
  });
});
