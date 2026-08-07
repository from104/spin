// screen-home-library 가져오기/내보내기 오케스트레이션. storage/transfer.ts 자체의 세부 규칙은
// storage 모듈이 이미 검증했으므로(§10.6), 여기서는 화면이 그 함수를 올바른 순서로 조합하는지만 본다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultResolution, readImportFile, commitDrills, commitSession, exportOneDrill, exportAllDrills } from './transfer.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { createSession } from '../../storage/sessionRepo.ts';
import { createDrill } from '../../model/defaults.ts';
import { exportDrillFile, exportSessionFile } from '../../storage/transfer.ts';

// downloadBlob 은 <a> 클릭을 트리거한다 — jsdom 에서 no-op 이지만 URL.createObjectURL 은
// jsdom 미구현이라 모킹한다.
vi.mock('../../storage/files.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/files.ts')>();
  return { ...actual, downloadBlob: vi.fn() };
});
import { downloadBlob } from '../../storage/files.ts';

describe('defaultResolution', () => {
  it('identical → skip, none/exists → copy', () => {
    expect(defaultResolution('identical')).toBe('skip');
    expect(defaultResolution('none')).toBe('copy');
    expect(defaultResolution('exists')).toBe('copy');
  });
});

describe('readImportFile / commitDrills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drill 봉투를 읽어 충돌 없는 후보를 만들고 그대로 커밋한다', async () => {
    const d = createDrill({ courtMode: 'full', title: '가져오기 테스트' });
    const text = await exportDrillFile(d).text();
    const realFile = { text: async () => text } as unknown as File;

    const preview = await readImportFile(realFile);
    expect(preview.kind).toBe('drills');
    if (preview.kind !== 'drills') throw new Error('unreachable');
    expect(preview.drills).toHaveLength(1);
    expect(preview.drills[0]!.conflict).toBe('none');

    const outcome = await commitDrills(preview.drills, new Map());
    expect(outcome.written).toEqual([d.id]);

    const loaded = await idbDrillRepo.getDrill(d.id);
    expect(loaded?.title).toBe('가져오기 테스트');
  });

  it('동일한 파일을 다시 가져오면 identical 로 분류되고 기본 해상도(skip)로 건너뛴다', async () => {
    const d = createDrill({ courtMode: 'full', title: '중복 테스트' });
    await idbDrillRepo.putDrill(d, { touch: false });
    const text = await exportDrillFile(d).text();
    const realFile = { text: async () => text } as unknown as File;

    const preview = await readImportFile(realFile);
    if (preview.kind !== 'drills') throw new Error('unreachable');
    expect(preview.drills[0]!.conflict).toBe('identical');

    const outcome = await commitDrills(preview.drills, new Map());
    expect(outcome.skipped).toEqual([d.id]);
    expect(outcome.written).toEqual([]);
  });

  it('세션 봉투를 읽어 드릴을 먼저 커밋한 뒤 세션을 리맵해 커밋한다', async () => {
    const d = createDrill({ courtMode: 'full', title: '세션 드릴' });
    await idbDrillRepo.putDrill(d, { touch: false });
    const session = await createSession({ title: '가져오기 세션' });
    const withItem = { ...session, items: [{ id: 'it_x' as never, drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.category }] };

    const text = await exportSessionFile(withItem, [d]).text();
    const realFile = { text: async () => text } as unknown as File;

    const preview = await readImportFile(realFile);
    if (preview.kind !== 'session') throw new Error('unreachable');
    // 로컬에 이미 동일 드릴이 있으므로 identical 충돌
    expect(preview.drills[0]!.conflict).toBe('identical');

    const outcome = await commitDrills(preview.drills, new Map());
    const savedSession = await commitSession(preview.session.doc, outcome);
    expect(savedSession.items[0]!.drillId).toBe(d.id); // identical→skip 은 항등 매핑
  });
});

describe('exportOneDrill / exportAllDrills', () => {
  it('다운로드를 트리거한다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '내보내기 테스트' });
    await exportOneDrill(d.id);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(filename).toMatch(/^SPIN_.*\.spin\.json$/);
    const text = await (blob as Blob).text();
    expect(JSON.parse(text).spin).toBe('drill');
  });

  it('전체 내보내기는 library 봉투를 만든다', async () => {
    const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title: 'A' });
    const d2 = await idbDrillRepo.createDrill({ courtMode: 'full', title: 'B' });
    await exportAllDrills([d1.id, d2.id]);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls.at(-1)!;
    expect(filename).toMatch(/^SPIN_전체_\d{8}\.spin\.json$/);
    const text = await (blob as Blob).text();
    const parsed = JSON.parse(text);
    expect(parsed.spin).toBe('library');
    expect(parsed.payload).toHaveLength(2);
  });
});
