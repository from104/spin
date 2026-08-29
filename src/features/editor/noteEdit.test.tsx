// 메모 글 편집 — 문 셋과 취소의 뜻 (기현 지시 2026-08-17).
//
// *"메모가 배치는 되는데 내용을 고칠 수가 없다. 최초 배치시, 오른쪽 메뉴 "수정" 메뉴,
//  더블클릭시 입력·수정 모달 띄워서 메모 편집 할 수 있게."*
//
// 고칠 길이 인스펙터 하나뿐이었다는 것이 결함의 전부다 — 쪽지를 짚은 사람에게 [속성] →
// [개체] 라는 경로는 화면 어디에도 안 적혀 있다. 그래서 문을 셋 낸다. 이 파일은 **셋이 다
// 열리는가**와 **취소가 무엇을 뜻하는가**를 잰다. 하나만 재면 나머지 둘은 조용히 죽는다 —
// 실제로 이 저장소에서 "메뉴로는 지워지는데 키보드로는 안 지워지는" 도형이 그렇게 생겼다.
import type { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { NoteId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import type { CourtStageHandle } from '../../render/CourtStage.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { EditorStage } from './EditorStage.tsx';
import type { ToolId } from '../../physics/index.ts';
import { NoteEditModal } from './NoteEditModal.tsx';
import { NOTE_DEFAULT_SIZE_PX } from '../../render/objects/noteChip.ts';
import { ObjectMenu, type ObjectMenuTarget } from './ObjectMenu.tsx';
import { placeObject } from './placement.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

const NOTE_AT = { x: 300, y: 200 };

function makeDrill(noteId: NoteId, text = ''): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const step0 = base.steps[0]!;
  return {
    ...base,
    steps: [{ ...step0, chairs: {}, balls: {}, cones: {}, arrows: [], notes: [{ id: noteId, ...NOTE_AT, text }] }],
  };
}

function mountStage(drill: Drill, tool: ToolId = 'select') {
  const onEditNote = vi.fn();
  // ⚠️ 무대는 pointerdown 첫 줄에서 이 손잡이(= EditorStage 의 `ref`)로 metrics 를 다시
  // 읽는다(useEditorPointer:518). 실기에는 늘 있으므로 테스트에도 있어야 한다 — 없으면
  // 두 번 누르기가 거기서 던지고 끝난다.
  const stageRef = { current: null } as RefObject<CourtStageHandle | null>;
  const view = render(
    <EditorStage
      ref={stageRef}
      rot={0}
      drill={drill}
      step={drill.steps[0]!}
      stepIndex={0}
      tool={tool}
      coneSlot={0}
      selection={new Set()}
      dispatch={vi.fn()}
      worldRef={{ current: null } as EditorWorldRef}
      writer={createTransformWriter()}
      zones={DEFAULT_ZONES}
      ballMax={8}
      pendingPlayerId={null}
      onPlayerPlaced={vi.fn()}
      showToast={vi.fn()}
      showGrid={false}
      showGridLabels={false}
      showRuleZones={false}
      largeTargets={false}
      onEraseIds={vi.fn()}
      onDuplicateIds={vi.fn()}
      onEditNote={onEditNote}
    />,
    { wrapper: SettingsProvider },
  );
  return { ...view, onEditNote };
}

/** 무대의 **두 번 누름**. DOM 의 `dblclick` 을 쏘지 않는 것이 이 헬퍼의 전부다.
 *
 *  ⚠️ 2026-08-17 기현 신고 *"메모를 더블 클릭 시 모달이 안 나온다"* — 실기에서 판이 포인터를
 *  캡처하는 순간 뒤따르는 click·dblclick 의 target 이 캡처 대상(`<svg>`)으로 재타깃돼 대상 id 가
 *  사라졌다. jsdom 에는 포인터 캡처가 없어 `fireEvent.doubleClick` 은 그 사고를 **못 잰다** —
 *  즉 옛 테스트는 통과하면서 실기가 죽어 있었다. 이제 무대가 pointerdown 두 번을 직접 세므로
 *  테스트도 실기가 쏘는 것과 같은 사건을 쏜다. */
function doubleTap(el: Element): void {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
}

describe('문 ① 더블클릭', () => {
  it('메모를 두 번 누르면 글 칸이 열린다 — fresh 는 false(이미 판에 있던 쪽지다)', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    doubleTap(container.querySelector(`#obj-${id}`)!);
    expect(onEditNote).toHaveBeenCalledWith(id, false);
  });

  it('칩의 **자식**(글자·쪽지)을 짚어도 열린다 — 이벤트 target 은 늘 자식이다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    doubleTap(container.querySelector(`#obj-${id} .note-chip`)!);
    expect(onEditNote).toHaveBeenCalledWith(id, false);
  });

  it('한 번만 누르면 안 열린다 — 그냥 고르는 손짓이다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    const el = container.querySelector(`#obj-${id}`)!;
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    expect(onEditNote).not.toHaveBeenCalled();
  });

  it('배치 도구에서는 안 연다 — 거기서 빠른 두 번은 개체 둘이다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'), 'cone');
    doubleTap(container.querySelector(`#obj-${id}`)!);
    expect(onEditNote).not.toHaveBeenCalled();
  });

  it('빈 코트를 두 번 눌러도 뜻이 없다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id));
    doubleTap(container.querySelector('svg')!);
    expect(onEditNote).not.toHaveBeenCalled();
  });
});

describe('문 ② 개체 메뉴 [수정]', () => {
  const base: ObjectMenuTarget = {
    ids: ['nt_1'],
    x: 10,
    y: 10,
    locked: false,
    ignored: false,
    canIgnore: false,
    editable: 'nt_1',
    selectSame: null,
  };
  const noop = () => {};

  function open(over: Partial<ObjectMenuTarget>, onEdit = noop as (id: string) => void) {
    render(
      <ObjectMenu
        target={{ ...base, ...over }}
        onClose={noop}
        onNudge={() => {}}
        onToggleLock={noop}
        onToggleIgnore={noop}
        onRemove={noop}
        onSelect={noop}
        onDuplicate={noop}
        onEdit={onEdit}
      />,
      { wrapper: SettingsProvider },
    );
  }

  it('메모 하나면 [수정] 이 뜨고, 누르면 그 id 로 열린다', () => {
    const onEdit = vi.fn();
    open({}, onEdit);
    fireEvent.click(screen.getByRole('menuitem', { name: '수정' }));
    expect(onEdit).toHaveBeenCalledWith('nt_1');
  });

  it('여럿을 골랐으면 안 뜬다 — 다섯 개의 글을 한 칸에 넣을 방법이 없다', () => {
    open({ ids: ['nt_1', 'nt_2'], editable: null });
    expect(screen.queryByRole('menuitem', { name: '수정' })).toBeNull();
  });

  it('메모가 아니면 안 뜬다', () => {
    open({ ids: ['ch_1'], editable: null });
    expect(screen.queryByRole('menuitem', { name: '수정' })).toBeNull();
  });

  it('잠긴 메모에서도 뜬다 — 잠김은 "이동만 막힌 상태" 라 글까지 얼리면 뜻이 하나 늘어난다', () => {
    open({ locked: true });
    expect(screen.getByRole('menuitem', { name: '수정' })).toBeInTheDocument();
  });

  it('무대에서도 같은 문이 열린다 — 메모에 오른쪽 클릭 → [수정]', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    fireEvent.contextMenu(container.querySelector(`#obj-${id}`)!, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByRole('menuitem', { name: '수정' }));
    expect(onEditNote).toHaveBeenCalledWith(id, false);
  });
});

describe('문 ③ 배치 직후', () => {
  it('메모를 놓으면 그 id 로 글 칸이 열린다', () => {
    const onNotePlaced = vi.fn();
    const dispatch = vi.fn();
    const placed = placeObject(
      'note',
      NOTE_AT,
      {
        drill: createDrill({ courtMode: 'full', formation: '1-2-1' }),
        coneSlot: 0,
        ballMax: 8,
        pendingPlayerId: null,
        stepIndex: 0,
        dispatch,
        showToast: vi.fn(),
        onPlayerPlaced: vi.fn(),
        onNotePlaced,
        locale: 'ko',
      },
    );
    expect(placed).toBe(true);
    // 놓인 그 쪽지여야 한다 — 다른 id 로 열면 방금 놓은 것이 아닌 메모를 고치게 된다.
    const dispatched = dispatch.mock.calls.find((c) => c[0].type === 'NOTE_SET')![0] as { note: { id: NoteId } };
    expect(onNotePlaced).toHaveBeenCalledWith(dispatched.note.id);
  });

  it('공·콘을 놓을 때는 안 연다', () => {
    const onNotePlaced = vi.fn();
    placeObject(
      'ball',
      NOTE_AT,
      {
        drill: createDrill({ courtMode: 'full', formation: '1-2-1' }),
        coneSlot: 0,
        ballMax: 8,
        pendingPlayerId: null,
        stepIndex: 0,
        dispatch: vi.fn(),
        showToast: vi.fn(),
        onPlayerPlaced: vi.fn(),
        onNotePlaced,
        locale: 'ko',
      },
    );
    expect(onNotePlaced).not.toHaveBeenCalled();
  });
});

describe('모달 — 줄바꿈과 취소', () => {
  function open(over: Partial<React.ComponentProps<typeof NoteEditModal>> = {}) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <NoteEditModal open initialText="" initialSize={NOTE_DEFAULT_SIZE_PX} initialColor="#ffffff" fresh={false} onSave={onSave} onCancel={onCancel} {...over} />,
      { wrapper: SettingsProvider },
    );
    return { onSave, onCancel, box: screen.getByRole('textbox', { name: '메모 내용' }) as HTMLTextAreaElement };
  }

  it('여러 줄을 그대로 저장한다 — 줄바꿈이 이 모달이 생긴 이유의 절반이다', () => {
    const { onSave, box } = open();
    fireEvent.change(box, { target: { value: '앞선 압박\n오른쪽 전환' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onSave).toHaveBeenCalledWith('앞선 압박\n오른쪽 전환', NOTE_DEFAULT_SIZE_PX, '#ffffff');
  });

  it('열 때의 글이 이미 들어 있다 — 고치기지 새로 쓰기가 아니다', () => {
    const { box } = open({ initialText: '앞선 압박' });
    expect(box.value).toBe('앞선 압박');
  });

  it('맨 Enter 는 저장이 아니다 — 줄바꿈이어야 한다', () => {
    const { onSave, box } = open();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter 는 저장이다', () => {
    const { onSave, box } = open();
    fireEvent.change(box, { target: { value: '가' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('가', NOTE_DEFAULT_SIZE_PX, '#ffffff');
  });

  // §0.5 미배송 빚(2026-08-20) — size·color 는 모델에 처음부터 있었는데 고칠 자리가 없었다.
  it('크기·색을 고르면 onSave 가 새 값으로 불린다', () => {
    const { onSave, box } = open();
    fireEvent.change(box, { target: { value: '가' } });
    fireEvent.click(screen.getByRole('radio', { name: '크게' }));
    fireEvent.click(screen.getByRole('radio', { name: '하늘색' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onSave).toHaveBeenCalledWith('가', 18, '#38bdf8');
  });

  it('안 만지면 초깃값 그대로 저장된다', () => {
    const { onSave, box } = open({ initialSize: 11, initialColor: '#ef4444' });
    fireEvent.change(box, { target: { value: '가' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onSave).toHaveBeenCalledWith('가', 11, '#ef4444');
  });

  it('한글 조합 중의 Ctrl+Enter 는 안 먹는다 — 첫 낱말마다 모달이 닫히면 못 쓴다', () => {
    const { onSave, box } = open();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('제목이 갈린다 — 방금 놓은 쪽지면 "쓰기", 있던 것이면 "수정"', () => {
    const { unmount } = render(
      <NoteEditModal open initialText="" initialSize={NOTE_DEFAULT_SIZE_PX} initialColor="#ffffff" fresh onSave={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('메모 쓰기');
    unmount();
    render(
      <NoteEditModal open initialText="가" initialSize={NOTE_DEFAULT_SIZE_PX} initialColor="#ffffff" fresh={false} onSave={vi.fn()} onCancel={vi.fn()} />,
      { wrapper: SettingsProvider },
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('메모 수정');
  });

  // 기현 신고 2026-08-17: *"첫 배치 시 모달의 텍스트박스에 포커스가 안 간다"*. 글을 쓰러 여는
  // 화면이므로 **열자마자 칠 수 있어야** 문이 열린 것이다. 강탈을 되돌리는 일반 가드는
  // ui/Modal 이 지고(거기 테스트가 잰다), 여기서 재는 것은 "닫기 ✕ 가 아니라 글 칸에 선다".
  it('열자마자 글 칸에 선다 — 커서는 글 끝이다', async () => {
    const { box } = open({ initialText: '앞선 압박' });
    await waitFor(() => expect(box).toHaveFocus());
    expect(box.selectionStart).toBe('앞선 압박'.length);
  });

  it('취소는 저장하지 않는다', () => {
    const { onSave, onCancel, box } = open();
    fireEvent.change(box, { target: { value: '안 쓸 글' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
