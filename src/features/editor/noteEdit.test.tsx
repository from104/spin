// 메모 글 편집 — 문 셋과 취소의 뜻 (기현 지시 2026-08-17).
//
// *"메모가 배치는 되는데 내용을 고칠 수가 없다. 최초 배치시, 오른쪽 메뉴 "수정" 메뉴,
//  더블클릭시 입력·수정 모달 띄워서 메모 편집 할 수 있게."*
//
// 고칠 길이 인스펙터 하나뿐이었다는 것이 결함의 전부다 — 쪽지를 짚은 사람에게 [속성] →
// [개체] 라는 경로는 화면 어디에도 안 적혀 있다. 그래서 문을 셋 낸다. 이 파일은 **셋이 다
// 열리는가**와 **취소가 무엇을 뜻하는가**를 잰다. 하나만 재면 나머지 둘은 조용히 죽는다 —
// 실제로 이 저장소에서 "메뉴로는 지워지는데 키보드로는 안 지워지는" 도형이 그렇게 생겼다.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { newId } from '../../core/ids.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { NoteId } from '../../core/ids.ts';
import { createDrill } from '../../model/defaults.ts';
import type { Drill } from '../../model/drill.ts';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { EditorStage } from './EditorStage.tsx';
import type { ToolId } from '../../physics/index.ts';
import { NoteEditModal } from './NoteEditModal.tsx';
import { ObjectMenu, type ObjectMenuTarget } from './ObjectMenu.tsx';
import { placeObject } from './placement.ts';

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
  const view = render(
    <EditorStage
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
      onEditNote={onEditNote}
    />,
  );
  return { ...view, onEditNote };
}

describe('문 ① 더블클릭', () => {
  it('메모를 더블클릭하면 글 칸이 열린다 — fresh 는 false(이미 판에 있던 쪽지다)', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    fireEvent.doubleClick(container.querySelector(`#obj-${id}`)!);
    expect(onEditNote).toHaveBeenCalledWith(id, false);
  });

  it('칩의 **자식**(글자·쪽지)을 짚어도 열린다 — 이벤트 target 은 늘 자식이다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'));
    fireEvent.doubleClick(container.querySelector(`#obj-${id} .note-chip`)!);
    expect(onEditNote).toHaveBeenCalledWith(id, false);
  });

  it('배치 도구에서는 안 연다 — 거기서 빠른 두 번은 개체 둘이다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id, '앞선 압박'), 'cone');
    fireEvent.doubleClick(container.querySelector(`#obj-${id}`)!);
    expect(onEditNote).not.toHaveBeenCalled();
  });

  it('빈 코트 더블클릭에는 뜻이 없다', () => {
    const id = newId('nt');
    const { container, onEditNote } = mountStage(makeDrill(id));
    fireEvent.doubleClick(container.querySelector('svg')!);
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
        onToggleLock={noop}
        onToggleIgnore={noop}
        onRemove={noop}
        onSelect={noop}
        onEdit={onEdit}
      />,
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
      },
    );
    expect(onNotePlaced).not.toHaveBeenCalled();
  });
});

describe('모달 — 줄바꿈과 취소', () => {
  function open(over: Partial<React.ComponentProps<typeof NoteEditModal>> = {}) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<NoteEditModal open initialText="" fresh={false} onSave={onSave} onCancel={onCancel} {...over} />);
    return { onSave, onCancel, box: screen.getByRole('textbox', { name: '메모 내용' }) as HTMLTextAreaElement };
  }

  it('여러 줄을 그대로 저장한다 — 줄바꿈이 이 모달이 생긴 이유의 절반이다', () => {
    const { onSave, box } = open();
    fireEvent.change(box, { target: { value: '앞선 압박\n오른쪽 전환' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(onSave).toHaveBeenCalledWith('앞선 압박\n오른쪽 전환');
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
    expect(onSave).toHaveBeenCalledWith('가');
  });

  it('한글 조합 중의 Ctrl+Enter 는 안 먹는다 — 첫 낱말마다 모달이 닫히면 못 쓴다', () => {
    const { onSave, box } = open();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('제목이 갈린다 — 방금 놓은 쪽지면 "쓰기", 있던 것이면 "수정"', () => {
    const { unmount } = render(<NoteEditModal open initialText="" fresh onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('메모 쓰기');
    unmount();
    render(<NoteEditModal open initialText="가" fresh={false} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('메모 수정');
  });

  it('취소는 저장하지 않는다', () => {
    const { onSave, onCancel, box } = open();
    fireEvent.change(box, { target: { value: '안 쓸 글' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
