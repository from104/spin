// §4.7 "다르면 묻는다 — 제목 + 양쪽 수정 시각 + 덮어쓰기/사본으로 추가/건너뛰기 3택.
// 포커스 기본값은 사본으로 추가". conflict:'exists' 항목만 사용자에게 묻는다 — 'none'/'identical'
// 은 storage/transfer.ts(§4.7)/features/library/transfer.ts 의 defaultResolution 이 이미 정한다.
import { useId, useState } from 'react';
import { Modal } from '../../ui/Modal.tsx';
import { Segmented } from '../../ui/Segmented.tsx';
import { Button } from '../../ui/Button.tsx';
import type { ImportCandidate, ImportResolution } from '../../storage/transfer.ts';
import type { Drill } from '../../model/drill.ts';

export interface ImportDialogProps {
  open: boolean;
  drills: ImportCandidate<Drill>[];
  onCancel(): void;
  onConfirm(resolutions: Map<number, ImportResolution>): void;
}

const RESOLUTION_OPTIONS = [
  { value: 'copy' as const, label: '사본으로 추가' },
  { value: 'overwrite' as const, label: '덮어쓰기' },
  { value: 'skip' as const, label: '건너뛰기' },
];

export function ImportDialog({ open, drills, onCancel, onConfirm }: ImportDialogProps) {
  const [resolutions, setResolutions] = useState<Map<number, ImportResolution>>(new Map());
  const titleId = useId();
  const conflicting = drills.map((c, i) => ({ c, i })).filter((x) => x.c.conflict === 'exists');

  if (!open) return null;

  const resolutionFor = (i: number): ImportResolution => resolutions.get(i) ?? 'copy';
  const setResolution = (i: number, r: ImportResolution) => setResolutions((prev) => new Map(prev).set(i, r));

  return (
    <Modal open={open} onClose={onCancel} titleId={titleId} title="가져오기 — 이미 있는 드릴">
      <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
        같은 드릴이 이미 저장되어 있습니다. 항목마다 처리 방법을 고르세요.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflowY: 'auto' }}>
        {conflicting.map(({ c, i }) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{c.doc.title}</div>
            {c.existing && (
              <div style={{ fontSize: '0.71875rem', color: 'var(--faint-text)', marginTop: 2 }}>
                기존: {c.existing.title} · {new Date(c.existing.updatedAt).toLocaleString('ko-KR')}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Segmented
                ariaLabel={`${c.doc.title} 처리 방법`}
                value={resolutionFor(i)}
                onChange={(v) => setResolution(i, v)}
                dense
                options={RESOLUTION_OPTIONS}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" onClick={() => onConfirm(resolutions)}>
          가져오기
        </Button>
      </div>
    </Modal>
  );
}
