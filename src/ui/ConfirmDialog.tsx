import { useId } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Modal } from './Modal.tsx';
import { Button } from './Button.tsx';
import { useT } from '../i18n/useT.ts';

export interface ConfirmDialogProps {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
  title: ReactNode;
  /** 문장(+ <strong> 강조나 목록 같은 부가 내용)을 그대로 받는다 — 표준 본문 스타일을 이 안에서 입힌다. */
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** 파괴적 조작(삭제 등) 앞의 확인 모달 — `ui/Modal.tsx` 위에 얇게 얹은 공용 관용구.
 *  FunctionBar.tsx 의 [코트 비우기] 확인과 LibraryScreen.tsx 의 드릴 삭제 확인, 두 곳에
 *  거의 같은 모양으로 복붙돼 있던 것을 하나로 모았다(PLAN-DELETE-SAFETY.md §D). */
export function ConfirmDialog({ open, onCancel, onConfirm, title, body, confirmLabel, cancelLabel, returnFocusRef }: ConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  return (
    <Modal open={open} onClose={onCancel} titleId={titleId} title={title} closeLabel={t('common.close')} returnFocusRef={returnFocusRef}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.6 }}>{body}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
