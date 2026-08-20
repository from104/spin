// screen-home-library 가져오기/내보내기 오케스트레이션. storage/transfer.ts 자체의 세부 규칙은
// storage 모듈이 이미 검증했으므로(§10.6), 여기서는 화면이 그 함수를 올바른 순서로 조합하는지만 본다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defaultResolution, readImportFile, commitDrills, commitSession, exportOneDrill, buildImportReport, importReportLine } from './transfer.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { addSessionItem, flattenSessionItems } from '../../model/session.ts';
import { createSession } from '../../storage/sessionRepo.ts';
import { createDrill } from '../../model/defaults.ts';
import { exportDrillFile, exportSessionFile, exportLibraryFile, type ImportOutcome } from '../../storage/transfer.ts';
import type { DrillId } from '../../core/ids.ts';

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
    const withItem = addSessionItem(session, { id: 'it_x' as never, drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType });

    const text = await exportSessionFile(withItem, [d]).text();
    const realFile = { text: async () => text } as unknown as File;

    const preview = await readImportFile(realFile);
    if (preview.kind !== 'session') throw new Error('unreachable');
    // 로컬에 이미 동일 드릴이 있으므로 identical 충돌
    expect(preview.drills[0]!.conflict).toBe('identical');

    const outcome = await commitDrills(preview.drills, new Map());
    const savedSession = await commitSession(preview.session.doc, outcome);
    expect(flattenSessionItems(savedSession)[0]!.drillId).toBe(d.id); // identical→skip 은 항등 매핑
  });
});

// §6.1c / 로드맵 4.2 — 가져오기 보고. 손상 항목은 prepareDrillCandidates 가 후보에서 조용히
// 빼 버리므로 outcome 만 봐서는 존재 자체가 안 보인다. drillsInFile(검증 전 원본 수)과의 차로
// 복원하는 것이 보고의 핵심이고, 여기서 그 산식을 못박는다.
describe('가져오기 보고 (§6.1c / 로드맵 4.2)', () => {
  const asFile = (text: string): File => ({ text: async () => text } as unknown as File);

  /** 계획서 4.2 완료 판정 픽스처 — 성한 7 + 깨진 3. 깨진 3개는 서로 다른 관문에서 죽는다:
   *  null(레코드 아님) · 문자열(레코드 아님) · schemaVersion 9999(too-new). */
  const brokenLibraryText = async (): Promise<string> => {
    const good = Array.from({ length: 7 }, (_, i) => createDrill({ courtMode: 'full', title: `성한 ${i}` }));
    const envelope = JSON.parse(await exportLibraryFile(good).text()) as { payload: unknown[] };
    envelope.payload.push(null, '깨진 문자열', { schemaVersion: 9999, id: 'dr_too_new' });
    return JSON.stringify(envelope);
  };

  it("깨진 3 + 성한 7 파일 → 보고는 7·3·0 이고, 다이얼로그 후보에 깨진 항목이 끼지 않는다", async () => {
    const preview = await readImportFile(asFile(await brokenLibraryText()));
    if (preview.kind !== 'drills') throw new Error('unreachable');
    expect(preview.drillsInFile).toBe(10); // 검증 전 원본 수
    // 완료 판정 후반부 "다이얼로그 항목 수는 증가하지 않는다": ImportDialog 는 preview.drills
    // 에서만 항목을 만들므로, 깨진 3개가 후보에 없다는 이 단언이 곧 그 보증이다.
    expect(preview.drills).toHaveLength(7);
    const outcome = await commitDrills(preview.drills, new Map());
    const report = buildImportReport(preview.drillsInFile, outcome);
    expect(report).toEqual({ imported: 7, failed: 3, skipped: 0 });
    // 세 숫자가 "전부" 나오는지 — 0 도 숨기지 않는다. 정확한 전문 비교라 슬롯이 뒤바뀌면 잡힌다.
    expect(importReportLine(report)).toBe('7개 가져옴 · 3개 실패 · 0개 건너뜀');
  });

  it('대조군: 깨진 항목이 0개면 실패도 0 — 산식이 "무엇을 넣어도 실패 3" 이 아니다', async () => {
    const good = [createDrill({ courtMode: 'full', title: '대조 A' }), createDrill({ courtMode: 'full', title: '대조 B' })];
    const preview = await readImportFile(asFile(await exportLibraryFile(good).text()));
    if (preview.kind !== 'drills') throw new Error('unreachable');
    expect(preview.drillsInFile).toBe(2);
    const outcome = await commitDrills(preview.drills, new Map());
    const report = buildImportReport(preview.drillsInFile, outcome);
    expect(report).toEqual({ imported: 2, failed: 0, skipped: 0 });
    expect(importReportLine(report)).toBe('2개 가져옴 · 0개 실패 · 0개 건너뜀');
  });

  it('세 번째 숫자는 건너뜀 — identical→skip 이 실패로 새지 않는다', async () => {
    const d = createDrill({ courtMode: 'full', title: '이미 있는 드릴' });
    await idbDrillRepo.putDrill(d, { touch: false });
    const preview = await readImportFile(asFile(await exportDrillFile(d).text()));
    if (preview.kind !== 'drills') throw new Error('unreachable');
    const outcome = await commitDrills(preview.drills, new Map());
    const report = buildImportReport(preview.drillsInFile, outcome);
    expect(report).toEqual({ imported: 0, failed: 0, skipped: 1 });
    expect(importReportLine(report)).toBe('0개 가져옴 · 0개 실패 · 1개 건너뜀');
  });

  it('커밋 단계 실패(outcome.failed)도 손상 수와 합산된다 — 순수 산식 검증', () => {
    const id = (s: string) => s as DrillId;
    const outcome: ImportOutcome = {
      idMap: new Map(),
      written: [id('dr_a'), id('dr_b'), id('dr_c'), id('dr_d'), id('dr_e')],
      skipped: [id('dr_f'), id('dr_g')],
      failed: [{ id: id('dr_h'), reason: 'IDB 쓰기 실패' }],
    };
    // 파일 10 − 후보 8(5+2+1) = 손상 2, 실패 합계 = 손상 2 + 커밋 실패 1 = 3
    expect(buildImportReport(10, outcome)).toEqual({ imported: 5, failed: 3, skipped: 2 });
    // 대조군: 후보 전원이 세 배열에 있으면(파일 8 = 후보 8) 손상은 0, 실패는 커밋 실패분만 남는다
    expect(buildImportReport(8, outcome)).toEqual({ imported: 5, failed: 1, skipped: 2 });
  });

  it('세션 파일도 payload.drills 의 검증 전 원본 수를 센다', async () => {
    const d = createDrill({ courtMode: 'full', title: '세션 보고 드릴' });
    const session = await createSession({ title: '보고 세션' });
    const envelope = JSON.parse(await exportSessionFile(session, [d]).text()) as { payload: { drills: unknown[] } };
    envelope.payload.drills.push(null); // 깨진 드릴 1
    const preview = await readImportFile(asFile(JSON.stringify(envelope)));
    if (preview.kind !== 'session') throw new Error('unreachable');
    expect(preview.drillsInFile).toBe(2);
    expect(preview.drills).toHaveLength(1);
  });
});

describe('exportOneDrill — 드릴 1개 공유 파일(살아 있는 계약)', () => {
  it('다운로드를 트리거한다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '내보내기 테스트' });
    await exportOneDrill(d.id);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(filename).toMatch(/^SPIN_.*\.spin\.json$/);
    const text = await (blob as Blob).text();
    expect(JSON.parse(text).spin).toBe('drill');
  });

  // 여기 있던 '전체 내보내기는 library 봉투를 만든다' 는 2026-08-12(4.7)에 **사라져야 하는 계약**
  // 이라 함께 지웠다(계획서 §6.1b: library 봉투 쓰기 중단). 대신 그 자리를 대신하는 계약은
  // src/features/export/ExportSheet.test.tsx 의 "IDB 의 드릴이 실제로 담긴 backup 봉투가 파일로
  // 떨어진다" 이고, 거기서 `parsed.spin === 'backup'` 을 단언한다.
  it('모듈이 더 이상 전체 내보내기를 내보내지 않는다 — 되살아나면 여기가 먼저 운다', async () => {
    const mod: Record<string, unknown> = await import('./transfer.ts');
    expect('exportAllDrills' in mod).toBe(false);
    // 대조군: 이 검사가 모듈을 실제로 읽었다(오타로 빈 객체를 본 것이 아니다).
    expect(typeof mod.exportOneDrill).toBe('function');
  });
});

// ── 4차 검증(2026-08-13) — 자기 앱이 만든 파일을 자기 앱이 "형식이 이상하다" 고 거절하던 자리
//
// §6.1b 로 [기기 이사 파일]이 backup 봉투의 **유일한 산출물**이 됐는데, 목록 화면의
// readImportFile 은 그 kind 를 마지막 폴백('지원하지 않는 파일 형식입니다.')으로 떨궜다.
// 코치가 방금 [보드]→[내보내기]→[기기 이사 파일]로 만든 자기 파일을 목록에서 열면, 문구가
// **파일이 잘못됐다고 말한다.** 실제로는 여는 자리가 다른 화면일 뿐이다. 4.1 과 4.7 이 둘 다
// "내 소유 파일이 아니라 안 고쳤다" 로 남겼고 그래서 아무도 안 고쳤다.
// 여기서 고치는 것은 **문구뿐**이다 — 목록에서 백업을 실제로 복원하게 하는 것은 화면 흐름
// (설정 체크박스·전술판 정책)까지 옮겨야 하는 별개 결정이라 손대지 않는다.
describe('가져오기 — 다른 화면 파일의 안내 (4차 검증)', () => {
  it('backup 봉투는 "형식이 이상하다" 가 아니라 **설정 화면으로 보낸다**', async () => {
    const env = JSON.stringify({ spin: 'backup', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: { drills: [], sessions: [], board: null } });
    const res = await readImportFile(new File([env], 'SPIN_백업_20260813.spin.json', { type: 'application/json' }));
    expect(res.kind).toBe('unsupported');
    if (res.kind !== 'unsupported') return;
    expect(res.reason).toContain('설정');
    expect(res.reason).toContain('데이터 가져오기'); // 실제 버튼 이름을 그대로 부른다(2026-08-20 개명)
    // ★ 옛 문구로 되돌아가면 여기가 운다.
    expect(res.reason).not.toBe('지원하지 않는 파일 형식입니다.');
  });

  it('대조군: 진짜로 모르는 kind 는 여전히 일반 문구다 — backup 만 특별대우한다', async () => {
    const env = JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    const res = await readImportFile(new File([env], 'x.spin.json', { type: 'application/json' }));
    expect(res.kind).toBe('unsupported');
    if (res.kind !== 'unsupported') return;
    expect(res.reason).toBe('지원하지 않는 파일 형식입니다.');
  });

  it('대조군: 성한 drill 봉투는 여전히 그대로 열린다 — 분기를 더하면서 정상 경로를 막지 않았다', async () => {
    const d = createDrill({ courtMode: 'full', title: '정상 경로' });
    const res = await readImportFile(new File([await exportDrillFile(d).text()], 'd.spin.json', { type: 'application/json' }));
    expect(res.kind).toBe('drills');
  });
});
