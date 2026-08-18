// C7 — 드릴 메타 시트. [속성] 폐기(0.2.1)로 UI 를 잃었던 필드들 + v8 신필드의 부활 자리다.
// 저장 통로가 dispatch(META_SET) 하나뿐인 것(자동저장 CAS 와 두 갈래 쓰기 금지)과, 선택 필드
// (situation·variation)를 '미지정' 으로 되돌리면 **키 자체가 지워지는** 것을 못박는다.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrillMetaSheet } from './DrillMetaSheet.tsx';
import { EditorProvider, useEditorState } from '../../store/editor/EditorProvider.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';

let lastDrill: Drill | null = null;
function Probe() {
  lastDrill = useEditorState().present;
  return null;
}

function renderSheet(drill = createDrill({ courtMode: 'full', title: '메타 드릴' })) {
  render(
    <SettingsProvider>
      <EditorProvider drill={drill}>
        <Probe />
        <DrillMetaSheet open onClose={() => {}} />
      </EditorProvider>
    </SettingsProvider>,
  );
}

describe('DrillMetaSheet', () => {
  it('유형·경기 상황을 고르면 META_SET 으로 반영된다 — 상황 "미지정" 은 키를 지운다', async () => {
    renderSheet();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('유형'), 'set-piece');
    expect(lastDrill!.drillType).toBe('set-piece');

    await user.selectOptions(screen.getByLabelText('경기 상황'), 'kick-in');
    expect(lastDrill!.situation).toBe('kick-in');

    // 미지정으로 되돌리기 — undefined 키가 남으면 IDB/JSON 왕복이 두 얼굴 문서를 만든다.
    await user.selectOptions(screen.getByLabelText('경기 상황'), '');
    expect('situation' in lastDrill!).toBe(false);
  });

  it('서술 3필드(목적·진행 방법·변형)가 저장되고, 빈 변형은 키를 지운다 (USPSA 3필드 — 질문 ⑧)', async () => {
    renderSheet();
    const user = userEvent.setup();

    const objective = screen.getByLabelText(/^목적/);
    await user.clear(objective);
    await user.type(objective, '측면 전개 습관');
    fireEvent.blur(objective);
    expect(lastDrill!.objective).toBe('측면 전개 습관');

    const variation = screen.getByLabelText(/^변형/);
    await user.type(variation, '수비 하나 추가');
    fireEvent.blur(variation);
    expect(lastDrill!.variation).toBe('수비 하나 추가');

    await user.clear(variation);
    fireEvent.blur(variation);
    expect('variation' in lastDrill!).toBe(false);
  });

  it('교육 필드 부활 — 코칭 포인트(줄→배열)·인원·장비·태그·난이도·소요시간 (질문 ⑦)', async () => {
    renderSheet();
    const user = userEvent.setup();

    const points = screen.getByLabelText(/^코칭 포인트/);
    await user.type(points, '받기 전에 몸을 연다{enter}패스는 낮게{enter}{enter}   ');
    fireEvent.blur(points);
    expect(lastDrill!.coachingPoints).toEqual(['받기 전에 몸을 연다', '패스는 낮게']); // 빈 줄은 버린다

    const players = screen.getByLabelText(/^필요 인원/);
    await user.clear(players);
    await user.type(players, '6');
    fireEvent.blur(players);
    expect(lastDrill!.playersNeeded).toBe(6);

    const equipment = screen.getByLabelText(/^필요 장비/);
    await user.type(equipment, '공 2 · 콘 6');
    fireEvent.blur(equipment);
    expect(lastDrill!.equipment).toBe('공 2 · 콘 6');

    const tags = screen.getByLabelText(/^태그/);
    await user.type(tags, '스핀, 패스 ,, 풀코트');
    fireEvent.blur(tags);
    expect(lastDrill!.tags).toEqual(['스핀', '패스', '풀코트']);

    await user.selectOptions(screen.getByLabelText('난이도'), '고급');
    expect(lastDrill!.level).toBe('고급');

    const duration = screen.getByLabelText('소요 시간(분)');
    await user.clear(duration);
    await user.type(duration, '25');
    fireEvent.blur(duration);
    expect(lastDrill!.durationMin).toBe(25);
  });
});
