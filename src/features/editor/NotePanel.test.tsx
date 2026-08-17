// NotePanel.tsx 머리말 참고 — 여기서는 **컴포넌트 단위**(접힘 기본·토글 aria·즉시 dispatch·
// key={stepId} 교체·미리보기)만 본다. 실제 화면 배선(STEP_META 가 진짜 리듀서를 타는지,
// 되돌리기 병합, 자동저장→시연)은 EditorWorkspace.notePanel.test.tsx 가 이어받는다 —
// InspectorPanel.stepMeta.test.tsx 의 note 관련 테스트 셋이 그리로/여기로 갈라져 이사했다
// (StepsSection 철거, 기현님 확정 2026-08-17 — 계약이 이사하면 테스트도 이사한다).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StepId } from '../../core/ids.ts';
import { LIMITS } from '../../model/validate.ts';
import { NotePanel } from './NotePanel.tsx';

const STEP_A = 'st_a' as StepId;
const STEP_B = 'st_b' as StepId;

/** 이름이 겹칠 수 있다(펼친 상태의 이름은 항상 '노트' 뿐이고, 접힌 상태에 미리보기가
 *  붙으면 '노트 …' 가 된다) — 접두사로 잡아 두 상태 모두에서 안정적으로 찾는다. */
const toggle = () => screen.getByRole('button', { name: /^노트/ });

describe('NotePanel — 기본은 접힘', () => {
  it('처음에는 접혀 있다 — textarea 가 DOM 에 없다', () => {
    render(<NotePanel stepId={STEP_A} note="" onNoteChange={() => {}} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('스텝 노트')).toBeNull();
  });

  it('토글을 누르면 펼쳐지고 textarea 에 현재 note 가 들어간다', async () => {
    const user = userEvent.setup();
    render(<NotePanel stepId={STEP_A} note="오른쪽으로 벌린다" onNoteChange={() => {}} />);

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('스텝 노트')).toHaveValue('오른쪽으로 벌린다');
  });

  it('다시 누르면 접힌다', async () => {
    const user = userEvent.setup();
    render(<NotePanel stepId={STEP_A} note="메모" onNoteChange={() => {}} />);
    await user.click(toggle());
    expect(screen.getByLabelText('스텝 노트')).toBeInTheDocument();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('스텝 노트')).toBeNull();
  });
});

describe('NotePanel — 노트 있음 표시(접힌 상태)', () => {
  it('note 가 있으면 접힌 줄에 첫 줄이 미리보기로 보인다 — 둘째 줄은 안 보인다', () => {
    render(<NotePanel stepId={STEP_A} note={'오른쪽으로 벌린다\n둘째 줄'} onNoteChange={() => {}} />);
    expect(screen.getByText('오른쪽으로 벌린다')).toBeInTheDocument();
    expect(screen.queryByText('둘째 줄')).toBeNull();
  });

  it('대조군 — note 가 없으면 미리보기가 없다(라벨만 뜬다)', () => {
    render(<NotePanel stepId={STEP_A} note="" onNoteChange={() => {}} />);
    expect(screen.getByRole('button', { name: '노트' })).toBeInTheDocument();
  });

  it('펼치면 미리보기가 사라진다 — textarea 자체가 그 자리를 대신한다', async () => {
    const user = userEvent.setup();
    render(<NotePanel stepId={STEP_A} note="오른쪽으로 벌린다" onNoteChange={() => {}} />);
    await user.click(toggle());
    expect(screen.queryByText('오른쪽으로 벌린다', { selector: 'span' })).toBeNull();
  });
});

describe('NotePanel — 입력이 즉시 dispatch 된다(blur 를 기다리지 않는다)', () => {
  it('글자를 치면 onNoteChange 가 change 마다 불린다', async () => {
    const onNoteChange = vi.fn();
    const user = userEvent.setup();
    render(<NotePanel stepId={STEP_A} note="" onNoteChange={onNoteChange} />);
    await user.click(toggle());

    await user.type(screen.getByLabelText('스텝 노트'), '가');

    // blur 를 안 했는데도 이미 불렸다 — "적는 동안 유실 없이 즉시 반영" 계약의 핵심.
    expect(onNoteChange).toHaveBeenCalledWith('가');
  });
});

describe('NotePanel — 스텝 전환 시 textarea 가 새 스텝 값으로 갈아 끼워진다', () => {
  it('펼친 채 스텝만 바뀌면 — 패널은 열린 채로 남고 내용만 그 스텝 값으로 바뀐다(key={stepId})', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NotePanel stepId={STEP_A} note="첫 스텝 메모" onNoteChange={() => {}} />);
    await user.click(toggle());
    expect(screen.getByLabelText('스텝 노트')).toHaveValue('첫 스텝 메모');

    rerender(<NotePanel stepId={STEP_B} note="" onNoteChange={() => {}} />);

    // 패널이 접히지 않았다(open 은 컴포넌트 로컬이라 stepId 변경에 안 걸린다) — 그리고
    // textarea 값은 key 교체로 새 스텝의(빈) note 로 갈아 끼워졌다.
    expect(screen.getByRole('button', { name: /^노트/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('스텝 노트')).toHaveValue('');
  });
});

describe('NotePanel — 노트 상한', () => {
  it('LIMITS.noteLen 을 maxLength 로 건다', async () => {
    const user = userEvent.setup();
    render(<NotePanel stepId={STEP_A} note="" onNoteChange={() => {}} />);
    await user.click(toggle());
    expect(screen.getByLabelText('스텝 노트')).toHaveAttribute('maxLength', String(LIMITS.noteLen));
  });
});
