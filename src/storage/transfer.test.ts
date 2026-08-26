// §10.6 transfer/files. 파일명 규칙, 봉투 파싱, sameDrill, 배치 가져오기/커밋, 세션 리맵.
import { describe, it, expect } from 'vitest';
import { slugify, ymdLocal, drillFileName, readTextFile, SPIN_EXT } from './files.ts';
import {
  ENVELOPE_VERSION,
  parseSpinFile,
  sameDrill,
  exportDrillFile,
  exportSessionFile,
  exportLibraryFile,
  prepareDrillImport,
  prepareSessionImport,
  commitDrillImports,
  commitSessionImport,
  collectBackup,
  exportBackupFile,
  restoreBackup,
  type SpinFile,
} from './transfer.ts';
import { StorageError } from './errors.ts';
import { idbDrillRepo } from './drillRepo.ts';
import { createSession, addDrillToSession } from './sessionRepo.ts';
import { findReferrers } from './drillRepo.ts';
import { getDB } from './db.ts';
import { PREFS_KEY, CURRENT_PREFS_SCHEMA, makeDefaultPrefs, savePrefs, loadPrefs } from './prefs.ts';
import { BOARD_KEY, saveBoard, loadBoard } from './board.ts';
import { createDrill } from '../model/defaults.ts';
import { newId } from '../core/ids.ts';
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import type { TrainingSession } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA, flattenSessionItems } from '../model/session.ts';
import { SUMMARY_BUILD } from '../model/summary.ts';

describe('slugify', () => {
  it('한글을 유지한다 — 금지문자 집합([\\x00-\\x1f<>:"/\\\\|?*])에 공백은 없어 그대로 남는다', () => {
    expect(slugify('측면-돌파-후-크로스')).toBe('측면-돌파-후-크로스');
    expect(slugify('측면 돌파 후 크로스')).toBe('측면 돌파 후 크로스');
  });
  it('금지문자를 - 로 바꾸고 연속 - 를 축약한다', () => {
    expect(slugify('a/b\\c:d*e?f')).toBe('a-b-c-d-e-f');
  });
  it('앞뒤 - 를 제거한다', () => {
    expect(slugify('  /leading-and-trailing/  ')).not.toMatch(/^-|-$/);
  });
  it('빈 문자열이면 drill 을 돌려준다', () => {
    expect(slugify('///')).toBe('drill');
    expect(slugify('')).toBe('drill');
  });
  it('40자를 넘으면 코드포인트 단위로 자른다(서로게이트 페어 보호)', () => {
    const emoji = '🏀'.repeat(50); // 각 이모지가 서로게이트 페어 2코드유닛
    const out = slugify(emoji, 40);
    expect([...out]).toHaveLength(40);
    // 서로게이트 페어가 잘리지 않아 각 문자가 여전히 유효한 이모지여야 한다
    expect(out).toBe('🏀'.repeat(40));
  });
  it('40자 초과 제목이 40자로 잘린다', () => {
    const long = '가'.repeat(60);
    expect([...slugify(long)]).toHaveLength(40);
  });
});

describe('ymdLocal / drillFileName', () => {
  it('YYYYMMDD 형식', () => {
    const ms = new Date(2026, 7, 8, 3, 4, 5).getTime(); // 2026-08-08 (월=7 → 8월)
    expect(ymdLocal(ms)).toBe('20260808');
  });
  it('drillFileName 은 종류가 드러나는 .spin.drill.json 을 쓴다', () => {
    const d = createDrill({ courtMode: 'full', title: '측면-돌파-후-크로스' });
    const name = drillFileName(d);
    expect(name.startsWith('SPIN_측면-돌파-후-크로스_')).toBe(true);
    expect(name.endsWith(SPIN_EXT.drill)).toBe(true);
    // 여전히 .json 으로 끝난다 — 확장자를 늘려도 JSON 으로 열리는 성질을 잃으면 안 된다.
    expect(name.endsWith('.json')).toBe(true);
  });
  it('종류마다 확장자가 다르다 — 파일 이름만 보고 갈 화면을 고를 수 있어야 한다', () => {
    const exts = Object.values(SPIN_EXT);
    expect(new Set(exts).size, '중복된 확장자가 있으면 구분이 안 된다').toBe(exts.length);
    for (const ext of exts) expect(ext.startsWith('.spin.') && ext.endsWith('.json')).toBe(true);
  });
});

describe('readTextFile', () => {
  it('File 을 텍스트로 읽는다', async () => {
    const file = new File(['hello'], 'x.txt');
    expect(await readTextFile(file)).toBe('hello');
  });
});

describe('parseSpinFile', () => {
  it('envelope 라운드트립 — 내보낸 파일을 그대로 되읽는다', () => {
    const d = createDrill({ courtMode: 'full', title: '라운드트립' });
    const blob = exportDrillFile(d);
    return blob.text().then((text) => {
      const parsed = parseSpinFile(text);
      expect(parsed.spin).toBe('drill');
      expect(parsed.envelope).toBe(ENVELOPE_VERSION);
      if (parsed.spin === 'drill') expect(parsed.payload.id).toBe(d.id);
    });
  });
  it('envelope 가 지원 버전보다 크면 E_SCHEMA_TOO_NEW', () => {
    const text = JSON.stringify({ spin: 'drill', envelope: 2, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    expect(() => parseSpinFile(text)).toThrow(StorageError);
    try {
      parseSpinFile(text);
    } catch (e) {
      expect((e as StorageError).code).toBe('E_SCHEMA_TOO_NEW');
    }
  });
  it("모르는 spin 값은 E_UNSUPPORTED_KIND", () => {
    const text = JSON.stringify({ spin: 'nonsense', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    try {
      parseSpinFile(text);
      expect.unreachable();
    } catch (e) {
      expect((e as StorageError).code).toBe('E_UNSUPPORTED_KIND');
      expect((e as StorageError).message).toContain('(nonsense)');
    }
  });
  it('spin:drillSet 은 파싱된다(커밋만 거부)', () => {
    const text = JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: { anything: true } });
    const parsed = parseSpinFile(text);
    expect(parsed.spin).toBe('drillSet');
  });
  it('손상된 JSON 은 E_INVALID_FILE', () => {
    try {
      parseSpinFile('{not-json');
      expect.unreachable();
    } catch (e) {
      expect((e as StorageError).code).toBe('E_INVALID_FILE');
    }
  });
});

describe('prepareDrillImport / prepareSessionImport — drillSet 거부', () => {
  it('drillSet 파일을 prepareDrillImport 에 넣으면 E_UNSUPPORTED_KIND 이고 메시지에 (drillSet) 이 들어간다', async () => {
    const file = parseSpinFile(JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} }));
    await expect(prepareDrillImport(file)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
    try {
      await prepareDrillImport(file);
    } catch (e) {
      expect((e as StorageError).message).toContain('(drillSet)');
    }
  });
  it('drillSet 파일을 prepareSessionImport 에 넣어도 동일하게 거부된다', async () => {
    const file = parseSpinFile(JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} }));
    await expect(prepareSessionImport(file)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
  });
});

// JSON.stringify 의 배열 replacer 는 중첩 객체 키까지 최상위 허용목록으로 걸러버려 구조를
// 깨뜨리므로 쓸 수 없다 — 모든 깊이의 키 순서를 뒤집는 재귀 헬퍼로 진짜 "키 순서만 다른" 객체를 만든다.
function reverseKeyOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reverseKeyOrder);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).reverse()) out[k] = reverseKeyOrder(o[k]);
    return out;
  }
  return v;
}

describe('sameDrill', () => {
  it('키 순서가 다른 동일 드릴을 같다고 판정한다', () => {
    const d = createDrill({ courtMode: 'full', title: '동일 판정' });
    const reordered = reverseKeyOrder(structuredClone(d)) as Drill;
    expect(Object.keys(reordered)[0]).not.toBe(Object.keys(d)[0]); // 실제로 순서가 뒤집혔는지 자체검증
    expect(sameDrill(d, reordered)).toBe(true);
  });
  it('0.05px 차이는 같다고 판정한다(0.1 반올림 버킷 안)', () => {
    const d = createDrill({ courtMode: 'full', title: '반올림 판정' });
    const chairId = d.cast.chairs[0]!.id;
    // 199.98 과 200.03 은 둘 다 [199.95,200.05) 버킷 안이라 반올림 경계 타이 없이 200.0 으로 같다.
    const a: Drill = { ...structuredClone(d), steps: [{ ...d.steps[0]!, chairs: { ...d.steps[0]!.chairs, [chairId]: { x: 199.98, y: 250, angleDeg: 0 } } }] };
    const b: Drill = { ...structuredClone(d), steps: [{ ...d.steps[0]!, chairs: { ...d.steps[0]!.chairs, [chairId]: { x: 200.03, y: 250, angleDeg: 0 } } }] };
    expect(sameDrill(a, b)).toBe(true);
  });
  it('updatedAt 만 다른 경우도 같다고 판정한다', () => {
    const d = createDrill({ courtMode: 'full', title: '시각만 다름' });
    const later = { ...d, updatedAt: d.updatedAt + 999999 };
    expect(sameDrill(d, later)).toBe(true);
  });
  it('실제로 내용이 다르면 다르다고 판정한다', () => {
    const d = createDrill({ courtMode: 'full', title: 'A' });
    const other = { ...d, title: 'B' };
    expect(sameDrill(d, other)).toBe(false);
  });
});

describe('배치 내 중복 DrillId — library 파일', () => {
  it('countDrills() 증가분이 보고 건수(written.length)와 일치한다', async () => {
    const d = createDrill({ courtMode: 'full', title: '중복 배치' });
    const dup = { ...structuredClone(d) }; // 같은 id 를 가진 두 번째 항목
    const before = await idbDrillRepo.countDrills();

    const file: SpinFile = { spin: 'library', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: [d, dup] };
    const candidates = await prepareDrillImport(file);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.conflict).toBe('none');
    expect(candidates[1]!.conflict).toBe('exists'); // 배치 내 중복 감지(TOCTOU 방지)

    const outcome = await commitDrillImports([
      { candidate: candidates[0]!, resolution: 'overwrite' },
      { candidate: candidates[1]!, resolution: 'copy' },
    ]);
    expect(outcome.failed).toEqual([]);
    expect(outcome.written).toHaveLength(2);

    const after = await idbDrillRepo.countDrills();
    expect(after - before).toBe(outcome.written.length);
  });
});

describe('세션 가져오기 리맵', () => {
  it("드릴 충돌에 'copy' 를 고르면 세션 항목이 새 id 를 가리키고 findReferrers 가 그 세션을 찾는다", async () => {
    const existing = await idbDrillRepo.createDrill({ courtMode: 'full', title: '로컬에 이미 있음' });
    // 파일 쪽 드릴은 같은 id 지만 내용이 달라 conflict:'exists' 를 유도한다.
    const fileDrill: Drill = { ...structuredClone(existing), title: '파일에서 온 다른 내용' };
    // v1 평평한 items 파일 그대로 — prepareSessionImport 의 migrateDoc(v1→v2) 경로를 함께 태운다.
    const sessionDoc = {
      schemaVersion: 1,
      id: newId('se'),
      title: '가져온 세션',
      items: [{ id: newId('it'), drillId: existing.id, titleCache: fileDrill.title, durationMinCache: fileDrill.durationMin, categoryCache: fileDrill.drillType }],
      drillIds: [existing.id],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as TrainingSession;
    const file: SpinFile = {
      spin: 'session',
      envelope: 1,
      app: 'SPIN',
      exportedAt: Date.now(),
      payload: { session: sessionDoc, drills: [fileDrill] },
    };

    const { drills, session } = await prepareSessionImport(file);
    expect(drills[0]!.conflict).toBe('exists');

    const outcome = await commitDrillImports([{ candidate: drills[0]!, resolution: 'copy' }]);
    const newDrillId = outcome.idMap.get(existing.id);
    expect(newDrillId).toBeDefined();
    expect(newDrillId).not.toBe(existing.id);

    const committedSession = await commitSessionImport(session.doc, outcome);
    expect(flattenSessionItems(committedSession)[0]!.drillId).toBe(newDrillId);
    expect(committedSession.drillIds).toEqual([newDrillId]);

    const refs = await findReferrers(newDrillId!);
    expect(refs.some((r) => r.id === committedSession.id)).toBe(true);
  });

  it('파일에서 온 세션(drillIds: []) 을 커밋한 뒤 findReferrers(드릴) 가 SessionId 를 반환한다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '빈 drillIds 검증' });
    const sessionDoc: TrainingSession = {
      schemaVersion: 2,
      id: newId('se'),
      title: '빈 drillIds 세션',
      phases: [{ id: newId('ph'), kind: 'custom', title: '훈련', items: [{ id: newId('it'), drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType }] }],
      drillIds: [], // 파일이 이렇게 거짓을 담고 있어도
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // 이 시나리오는 드릴이 이미 로컬에 동일하게 존재하므로(conflict:'identical') outcome 이 항등이다.
    const outcome = { idMap: new Map([[d.id, d.id]]), written: [], skipped: [d.id], failed: [] };
    const committed = await commitSessionImport(sessionDoc, outcome);
    expect(committed.drillIds).toEqual([d.id]); // putSession 이 재계산

    const refs = await findReferrers(d.id);
    expect(refs.some((r) => r.id === committed.id)).toBe(true);
  });
});

describe('exportSessionFile / exportLibraryFile', () => {
  it('세션 봉투는 session·drills 를 함께 담는다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '내보내기용' });
    const s = await createSession({ title: '내보내기 세션' });
    await addDrillToSession(s.id, d.id);
    const blob = exportSessionFile(s, [d]);
    const text = await blob.text();
    const parsed = JSON.parse(text) as { spin: string; payload: { session: TrainingSession; drills: Drill[] } };
    expect(parsed.spin).toBe('session');
    expect(parsed.payload.drills[0]!.id).toBe(d.id);
  });
  it('라이브러리 봉투는 드릴 배열을 담는다', async () => {
    const d1 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '라이브러리1' });
    const d2 = await idbDrillRepo.createDrill({ courtMode: 'full', title: '라이브러리2' });
    const blob = exportLibraryFile([d1, d2]);
    const text = await blob.text();
    const parsed = JSON.parse(text) as { spin: string; payload: Drill[] };
    expect(parsed.spin).toBe('library');
    expect(parsed.payload).toHaveLength(2);
  });
});

describe('getDB 재사용 확인(스모크)', () => {
  it('storage 모듈들이 같은 spin DB 를 공유한다', async () => {
    const db = await getDB();
    expect(db.name).toBe('spin');
  });
});

// ---- backup 봉투 계약 표(§6.1b / 로드맵 4.1) ----------------------------------------------------
//
// 이 블록은 **파일 맨 끝에 둔다** — wipeAll() 이 IDB 스토어 3개와 localStorage 2키를 비우기
// 때문이다. 위 블록들 사이에 끼워 넣으면 그 아래 테스트가 남의 데이터를 전제한 채 깨진다.

async function wipeAll(): Promise<void> {
  const db = await getDB();
  await db.clear('drills');
  await db.clear('drillSummaries');
  await db.clear('sessions');
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem(BOARD_KEY);
}

function backupEnvelope(payload: unknown, envelope = ENVELOPE_VERSION): string {
  return JSON.stringify({ spin: 'backup', envelope, app: 'SPIN', exportedAt: Date.now(), payload });
}

describe('backup 봉투 — 라운드트립', () => {
  it('내보내고 → 지우고 → 가져오면 드릴·세션·설정·자유 전술판이 전부 돌아온다', async () => {
    await wipeAll();

    const drill = await idbDrillRepo.createDrill({ courtMode: 'full', title: '이사 드릴' });
    const session = await createSession({ title: '이사 세션', location: '체육관 B' });
    await addDrillToSession(session.id, drill.id);
    savePrefs({ ...makeDefaultPrefs(), theme: 'light', a11y: { ...makeDefaultPrefs().a11y, uiScale: 1.3, largeTargets: true }, tray: { draw: true, note: false } });
    const boardDrill = createDrill({ courtMode: 'full', title: '이사 전술판' });
    saveBoard(boardDrill, false);

    const blob = exportBackupFile(await collectBackup());
    const text = await blob.text();

    // 대조군 — 정말로 지워졌는지 먼저 확인한다. 안 그러면 "지우지 않아서 통과" 가 된다.
    await wipeAll();
    expect((await idbDrillRepo.loadDrill(drill.id)).status).toBe('missing');
    expect(await (await getDB()).get('sessions', session.id)).toBeUndefined();
    expect(loadPrefs().theme).toBe('dark'); // 기본값으로 되돌아간 상태
    expect(loadBoard()).toBeNull();

    const file = parseSpinFile(text);
    expect(file.spin).toBe('backup');
    const report = await restoreBackup(file, { prefs: 'replace' });

    expect(report.drills.failed).toEqual([]);
    expect(report.drills.written).toEqual([drill.id]); // 충돌이 없으므로 id 가 그대로 돌아온다
    const back = await idbDrillRepo.loadDrill(drill.id);
    expect(back.status).toBe('ok');
    if (back.status === 'ok') expect(back.drill.title).toBe('이사 드릴');

    expect(report.sessionsWritten).toEqual([session.id]);
    const backSession = await (await getDB()).get('sessions', session.id);
    expect(backSession?.title).toBe('이사 세션');
    expect(backSession?.location).toBe('체육관 B');
    expect(flattenSessionItems(backSession!).map((i) => i.drillId)).toEqual([drill.id]);

    expect(report.prefs).toBe('restored');
    const prefs = loadPrefs();
    expect(prefs.theme).toBe('light');
    expect(prefs.a11y.uiScale).toBe(1.3);
    expect(prefs.a11y.largeTargets).toBe(true);
    expect(prefs.tray.draw).toBe(true); // validate.ts 화이트리스트가 신형 필드를 통과시킨다

    expect(report.board).toBe('restored');
    expect(loadBoard()?.drill.title).toBe('이사 전술판');
    expect(loadBoard()?.pristine).toBe(false);

    await wipeAll();
  });

  it('봉투는 payload 의 schemaVersion 을 그대로 싣는다 — 아무 버전도 올리지 않는다', async () => {
    await wipeAll();
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '버전 확인' });
    await createSession({ title: '버전 확인 세션' });
    savePrefs(makeDefaultPrefs());
    const parsed = JSON.parse(await exportBackupFile(await collectBackup()).text()) as {
      envelope: number;
      payload: { drills: Drill[]; sessions: TrainingSession[]; prefs: { schemaVersion: number } };
    };
    expect(parsed.envelope).toBe(1); // ENVELOPE_VERSION — backup 이 늘었다고 올리지 않는다
    expect(parsed.payload.drills[0]!.schemaVersion).toBe(CURRENT_DRILL_SCHEMA); // 2
    expect(parsed.payload.sessions[0]!.schemaVersion).toBe(CURRENT_SESSION_SCHEMA); // 1
    expect(parsed.payload.prefs.schemaVersion).toBe(CURRENT_PREFS_SCHEMA); // 2
    await wipeAll();
  });
});

describe('backup 봉투 — 거부 경로', () => {
  it('envelope 가 지원 버전보다 크면 E_SCHEMA_TOO_NEW (대조군: 같은 payload 를 envelope 1 로 주면 파싱된다)', () => {
    const payload = { drills: [], sessions: [], prefs: makeDefaultPrefs(), board: null };
    try {
      parseSpinFile(backupEnvelope(payload, ENVELOPE_VERSION + 1));
      expect.unreachable();
    } catch (e) {
      expect((e as StorageError).code).toBe('E_SCHEMA_TOO_NEW');
    }
    expect(parseSpinFile(backupEnvelope(payload)).spin).toBe('backup');
  });

  it('restoreBackup 은 backup 이 아닌 봉투를 E_UNSUPPORTED_KIND(kind) 로 거부한다', async () => {
    const libraryFile: SpinFile = { spin: 'library', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: [] };
    await expect(restoreBackup(libraryFile)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
    try {
      await restoreBackup(libraryFile);
    } catch (e) {
      expect((e as StorageError).message).toContain('(library)');
    }
    // 대조군 — backup 봉투는 같은 경로를 통과한다(무엇을 넣어도 거부하는 게 아니다).
    const ok = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: makeDefaultPrefs(), board: null }));
    await expect(restoreBackup(ok)).resolves.toMatchObject({ drillsInFile: 0 });
  });

  it('backup 봉투를 드릴 가져오기에 넣으면 E_UNSUPPORTED_KIND(backup) — 기존 3 kind 판별을 깨지 않는다', async () => {
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: makeDefaultPrefs(), board: null }));
    await expect(prepareDrillImport(file)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
    try {
      await prepareDrillImport(file);
    } catch (e) {
      expect((e as StorageError).message).toContain('(backup)');
    }
    await expect(prepareSessionImport(file)).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
  });
});

describe('backup 봉투 — 세션 참조 리맵', () => {
  it('드릴 id 가 충돌해 새 id 를 받으면 복원된 세션도 새 id 를 가리킨다', async () => {
    await wipeAll();
    const local = await idbDrillRepo.createDrill({ courtMode: 'full', title: '로컬에서 고친 드릴' });
    const fileDrill: Drill = { ...structuredClone(local), title: '백업 파일 쪽 내용' }; // 같은 id, 다른 내용
    const fileSession: TrainingSession = {
      schemaVersion: CURRENT_SESSION_SCHEMA,
      id: newId('se'),
      title: '리맵 대상 세션',
      phases: [{ id: newId('ph'), kind: 'custom', title: '훈련', items: [{ id: newId('it'), drillId: local.id, titleCache: fileDrill.title, durationMinCache: fileDrill.durationMin, categoryCache: fileDrill.drillType }] }],
      drillIds: [local.id],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const file = parseSpinFile(backupEnvelope({ drills: [fileDrill], sessions: [fileSession], prefs: makeDefaultPrefs(), board: null }));

    const report = await restoreBackup(file);
    const remapped = report.drills.idMap.get(local.id);
    expect(remapped).toBeDefined();
    expect(remapped).not.toBe(local.id); // 충돌 → 사본 id 발급

    const stored = await (await getDB()).get('sessions', report.sessionsWritten[0]!);
    expect(flattenSessionItems(stored!)[0]!.drillId).toBe(remapped);
    expect(stored?.drillIds).toEqual([remapped]);

    // 대조군(부재 단언) — 옛 id 를 가리킨 채로 남아 있으면 missing 경고도 안 뜨는 조용한 오배선이다.
    const refsNew = await findReferrers(remapped!);
    expect(refsNew.some((r) => r.id === stored!.id)).toBe(true);
    const refsOld = await findReferrers(local.id);
    expect(refsOld.some((r) => r.id === stored!.id)).toBe(false);

    await wipeAll();
  });

  it('같은 백업을 두 번 복원해도 드릴·세션이 불어나지 않는다(멱등)', async () => {
    await wipeAll();
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '멱등 드릴' });
    const s = await createSession({ title: '멱등 세션' });
    await addDrillToSession(s.id, d.id);
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());

    await restoreBackup(file);
    const afterFirst = { drills: await idbDrillRepo.countDrills(), sessions: (await (await getDB()).getAll('sessions')).length };
    const second = await restoreBackup(file);
    expect(await idbDrillRepo.countDrills()).toBe(afterFirst.drills);
    expect((await (await getDB()).getAll('sessions')).length).toBe(afterFirst.sessions);
    expect(second.drills.skipped).toEqual([d.id]); // 'identical' → skip
    expect(second.sessionsSkipped).toEqual([s.id]);
    expect(second.sessionsWritten).toEqual([]);
    await wipeAll();
  });
});

describe('backup 봉투 — 복원한 드릴의 요약(B-6)', () => {
  it('복원한 드릴이 목록에 제목과 함께 보인다 — commitDrillImports 가 드릴과 요약을 한 트랜잭션에 쓴다', async () => {
    await wipeAll();
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '요약 확인 드릴' });
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());
    await wipeAll();
    expect(await idbDrillRepo.listDrillSummaries()).toHaveLength(0); // 대조군: 지워진 상태

    await restoreBackup(file);

    const list = await idbDrillRepo.listDrillSummaries();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(d.id);
    expect(list[0]!.title).toBe('요약 확인 드릴'); // 빈칸이면 목록에서 제목 없는 카드가 된다
    expect(list[0]!.stepCount).toBeGreaterThan(0);
    expect(list[0]!.thumb.chairs.length).toBeGreaterThan(0);
    expect(list[0]!.build).toBe(SUMMARY_BUILD); // build 를 올리지 않았다(요약 재구축 경로 불필요)

    // 검색(searchKey)까지 살아 있어야 목록에서 찾아진다. 대조군으로 없는 말은 0건.
    expect(await idbDrillRepo.listDrillSummaries({ search: '요약 확인' })).toHaveLength(1);
    expect(await idbDrillRepo.listDrillSummaries({ search: '없는드릴제목' })).toHaveLength(0);

    await wipeAll();
  });
});

describe('backup 봉투 — prefs 복원 정책', () => {
  it("기본값은 'skip' — 남의 백업을 읽어도 테마·접근성 설정이 말없이 바뀌지 않는다", async () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'dark', a11y: { ...makeDefaultPrefs().a11y, largeTargets: true } });
    const filePrefs = { ...makeDefaultPrefs(), theme: 'light' as const, a11y: { ...makeDefaultPrefs().a11y, largeTargets: false } };
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: filePrefs, board: null }));

    const report = await restoreBackup(file);
    expect(report.prefs).toBe('skipped');
    expect(loadPrefs().theme).toBe('dark');
    expect(loadPrefs().a11y.largeTargets).toBe(true); // 로컬 접근성 설정 그대로
    localStorage.removeItem(PREFS_KEY);
  });

  it("prefs:'replace' 면 복원하고, spin.prefs 의 theme 은 **최상위 문자열**로 남는다", async () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'dark' });
    const filePrefs = { ...makeDefaultPrefs(), theme: 'light' as const, a11y: { ...makeDefaultPrefs().a11y, uiScale: 1.15 as const } };
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: filePrefs, board: null }));

    const report = await restoreBackup(file, { prefs: 'replace' });
    expect(report.prefs).toBe('restored');

    // ⚠️ index.html:26-33 부트 스크립트는 마이그레이션도 파서도 없이 이 모양을 그대로 읽는다.
    const rawJson = JSON.parse(localStorage.getItem(PREFS_KEY)!) as Record<string, unknown>;
    expect(Object.keys(rawJson)).toContain('theme');
    expect(typeof rawJson.theme).toBe('string');
    expect(rawJson.theme).toBe('light');
    // 대조군 — 중첩되지 않았다는 부재 단언. theme 이 a11y 나 다른 가지 밑으로 들어가면 깜빡인다.
    expect((rawJson.a11y as Record<string, unknown>).theme).toBeUndefined();
    expect(loadPrefs().a11y.uiScale).toBe(1.15);
    localStorage.removeItem(PREFS_KEY);
  });

  it('읽을 수 없는 prefs(더 새 앱의 schemaVersion)는 로컬 설정을 지우지 않는다', async () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'light' });
    const tooNew = { ...makeDefaultPrefs(), schemaVersion: CURRENT_PREFS_SCHEMA + 1, theme: 'dark' as const };
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: tooNew, board: null }));

    const report = await restoreBackup(file, { prefs: 'replace' });
    expect(report.prefs).toBe('unreadable');
    expect(loadPrefs().theme).toBe('light'); // 기본값으로 되돌리지도 않는다
    localStorage.removeItem(PREFS_KEY);
  });
});

describe('backup 봉투 — 자유 전술판 복원 정책', () => {
  it("기본 'auto' 는 편집 중인 로컬 판(pristine:false)을 덮어쓰지 않는다", async () => {
    saveBoard(createDrill({ courtMode: 'full', title: '작업 중인 판' }), false);
    const fileBoard = { schemaVersion: 1, pristine: false, drill: createDrill({ courtMode: 'full', title: '백업 속 판' }) };
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: makeDefaultPrefs(), board: fileBoard }));

    const report = await restoreBackup(file);
    // 5.0 ②a — 옛 'skipped' 는 "파일에 판 없음" 과 이 경우를 뭉갰다. 여기는 **로컬이 편집 중**
    // 쪽이므로 사유가 그대로 드러나야 토스트가 다음 행동([전술판 교체])을 말할 수 있다.
    expect(report.board).toBe('kept-local-edited');
    expect(loadBoard()?.drill.title).toBe('작업 중인 판');

    // 대조군 — 손대지 않은 판(pristine:true)이면 같은 파일이 복원된다. "무엇을 넣어도 skip" 이 아니다.
    saveBoard(createDrill({ courtMode: 'full', title: '기본 배치 그대로' }), true);
    const report2 = await restoreBackup(file);
    expect(report2.board).toBe('restored');
    expect(loadBoard()?.drill.title).toBe('백업 속 판');
    localStorage.removeItem(BOARD_KEY);
  });

  it('파일에 판이 없으면(null) 로컬 판을 건드리지 않는다 — 사유는 none-in-file 로 구분된다', async () => {
    saveBoard(createDrill({ courtMode: 'full', title: '남아 있어야 할 판' }), true);
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: makeDefaultPrefs(), board: null }));
    const report = await restoreBackup(file, { board: 'replace' });
    // 5.0 ②a — "파일에 판 없음"(할 일이 없다)을 "편집 중이라 안 덮음"(체크박스로 해소)과
    // 같은 값으로 돌려주면 토스트가 둘 중 하나에 대해 거짓말한다.
    expect(report.board).toBe('none-in-file');
    expect(loadBoard()?.drill.title).toBe('남아 있어야 할 판');
    localStorage.removeItem(BOARD_KEY);
  });

  it("board:'replace' 는 편집 중인 로컬 판도 덮는다 — [전술판 교체] 체크박스가 여는 유일한 길(5.0 ②b)", async () => {
    saveBoard(createDrill({ courtMode: 'full', title: '희생될 편집 중 판' }), false);
    const fileBoard = { schemaVersion: 1, pristine: false, drill: createDrill({ courtMode: 'full', title: '백업에서 온 판' }) };
    const file = parseSpinFile(backupEnvelope({ drills: [], sessions: [], prefs: makeDefaultPrefs(), board: fileBoard }));

    const report = await restoreBackup(file, { board: 'replace' });
    expect(report.board).toBe('restored');
    expect(loadBoard()?.drill.title).toBe('백업에서 온 판');

    // 대조군 — 같은 상황에서 'skip' 정책은 여전히 'skipped' 다(정책 스킵과 사유 스킵은 별개 값).
    saveBoard(createDrill({ courtMode: 'full', title: '다시 편집 중' }), false);
    const report2 = await restoreBackup(file, { board: 'skip' });
    expect(report2.board).toBe('skipped');
    expect(loadBoard()?.drill.title).toBe('다시 편집 중');
    localStorage.removeItem(BOARD_KEY);
  });
});

// ── 5.0 ① — 복원한 문서의 createdAt/updatedAt (2026-08-13 결정: 보존한다) ─────────────────────
//
// 기기 이사는 "같은 문서가 옮겨간 것" 이다. 충돌 없이 id 그대로 들어오는 드릴·세션이 now 를
// 받으면, by_updatedAt 인덱스(드릴 요약·세션 목록 둘 다)가 있는 한 "최근 수정순" 이 이사 직후
// 전부 "방금" 으로 뭉개진다. 예외는 **충돌로 새 id 를 받은 진짜 사본** — 그 문서는 이 기기에서
// 지금 만들어진 것이니 now 가 맞다. 두 경우를 모두 단언한다(한쪽만 찌르면 §7 헛통과 2형).
describe('backup 봉투 — 복원한 시각 보존 (5.0 ①)', () => {
  // 하드코딩한 과거 시각 — Date.now() 가 절대 돌려줄 수 없는 값이라 "보존" 과 "재발급" 이
  // 밀리초 경합 없이 갈린다.
  const CREATED = Date.parse('2025-03-01T00:00:00Z');
  const UPDATED = Date.parse('2025-06-15T12:00:00Z');

  function pastSession(phases: TrainingSession['phases'] = [], drillIds: TrainingSession['drillIds'] = []): TrainingSession {
    return { schemaVersion: CURRENT_SESSION_SCHEMA, id: newId('se'), title: '시각 보존 세션', phases, drillIds, createdAt: CREATED, updatedAt: UPDATED };
  }

  it('충돌 없는 드릴·세션은 createdAt·updatedAt 이 파일 그대로다 — 세션과 드릴이 대칭이다', async () => {
    await wipeAll();
    const fileDrill: Drill = { ...createDrill({ courtMode: 'full', title: '시각 보존 드릴' }), createdAt: CREATED, updatedAt: UPDATED };
    const fileSession = pastSession();
    const file = parseSpinFile(backupEnvelope({ drills: [fileDrill], sessions: [fileSession], prefs: makeDefaultPrefs(), board: null }));

    const before = Date.now();
    const report = await restoreBackup(file);
    expect(report.drills.written).toEqual([fileDrill.id]); // 대조군: 정말 무충돌 경로였다

    const storedDrill = await (await getDB()).get('drills', fileDrill.id);
    expect(storedDrill?.createdAt).toBe(CREATED);
    expect(storedDrill?.updatedAt).toBe(UPDATED); // 여기가 now 면 "최근 수정순" 이 이사 직후 무의미해진다
    expect(storedDrill?.updatedAt).toBeLessThan(before); // 대조군: now 로는 절대 통과할 수 없는 단언

    // by_updatedAt 인덱스의 실제 소재지인 **요약**까지 같은 시각이어야 한다(드릴만 보존하고
    // 요약이 now 면 목록 정렬은 여전히 망가진다 — buildSummary 가 d.updatedAt 을 복사한다).
    const summary = (await idbDrillRepo.listDrillSummaries()).find((s) => s.id === fileDrill.id);
    expect(summary?.updatedAt).toBe(UPDATED);
    expect(summary?.createdAt).toBe(CREATED);

    const storedSession = await (await getDB()).get('sessions', fileSession.id);
    expect(storedSession?.createdAt).toBe(CREATED);
    expect(storedSession?.updatedAt).toBe(UPDATED); // putSession 을 그대로 쓰면 여기가 now 가 된다
    await wipeAll();
  });

  it('충돌로 새 id 를 받은 진짜 사본은 지금 시각을 받는다 — 보존의 예외 쪽도 단언한다', async () => {
    await wipeAll();
    const local = await idbDrillRepo.createDrill({ courtMode: 'full', title: '로컬에서 고친 드릴' });
    const fileDrill: Drill = { ...structuredClone(local), title: '파일 쪽 다른 내용', createdAt: CREATED, updatedAt: UPDATED };
    const localSession = await createSession({ title: '로컬 세션' });
    const fileSession: TrainingSession = { ...pastSession(), id: localSession.id, title: '파일 쪽 다른 세션' };
    const file = parseSpinFile(backupEnvelope({ drills: [fileDrill], sessions: [fileSession], prefs: makeDefaultPrefs(), board: null }));

    const before = Date.now();
    const report = await restoreBackup(file); // 기본 drillConflict:'copy'
    const copyId = report.drills.idMap.get(local.id);
    expect(copyId).toBeDefined();
    expect(copyId).not.toBe(local.id); // 대조군: 정말 충돌 → 사본 경로였다

    const copy = await (await getDB()).get('drills', copyId!);
    expect(copy?.createdAt).toBeGreaterThanOrEqual(before); // 사본은 지금 만들어진 문서다
    expect(copy?.updatedAt).toBeGreaterThanOrEqual(before);

    const sessionCopyId = report.sessionsWritten[0]!;
    expect(sessionCopyId).not.toBe(localSession.id);
    const sessionCopy = await (await getDB()).get('sessions', sessionCopyId);
    expect(sessionCopy?.title).toBe('파일 쪽 다른 세션 (사본)');
    expect(sessionCopy?.createdAt).toBeGreaterThanOrEqual(before);
    expect(sessionCopy?.updatedAt).toBeGreaterThanOrEqual(before);
    await wipeAll();
  });
});
