// downloadBlob 은 <a> 클릭을 트리거한다 — jsdom 에서 no-op 이지만 URL.createObjectURL 은
// jsdom 미구현이라 모킹한다(features/library/transfer.test.ts 와 동일 패턴).
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../storage/files.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/files.ts')>();
  return { ...actual, downloadBlob: vi.fn() };
});

import { exportAllDrillsToFile } from './dataExport.ts';
import { downloadBlob } from '../../storage/files.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';

describe('exportAllDrillsToFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('id 가 0개면 다운로드하지 않고 0을 반환한다', async () => {
    const n = await exportAllDrillsToFile([]);
    expect(n).toBe(0);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('존재하는 드릴만 모아 하나의 파일로 내보내고 개수를 반환한다', async () => {
    const a = await idbDrillRepo.createDrill({ courtMode: 'full', title: '드릴 A' });
    const b = await idbDrillRepo.createDrill({ courtMode: 'full', title: '드릴 B' });
    // 목록에 없는(삭제된) id 가 섞여도 조용히 건너뛴다.
    const n = await exportAllDrillsToFile([a.id, b.id, 'dr_missing' as typeof a.id]);
    expect(n).toBe(2);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = (downloadBlob as ReturnType<typeof vi.fn>).mock.calls[0] as [Blob, string];
    expect(filename).toMatch(/^SPIN_전체_\d{8}\.spin\.json$/);
    const text = await blob.text();
    const parsed = JSON.parse(text) as { spin: string; payload: unknown[] };
    expect(parsed.spin).toBe('library');
    expect(parsed.payload).toHaveLength(2);
  });
});
