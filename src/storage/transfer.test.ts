// §10.6 transfer/files. 파일명 규칙, 봉투 파싱, sameDrill, 배치 가져오기/커밋, 세션 리맵.
import { describe, it, expect } from 'vitest';
import { slugify, ymdLocal, drillFileName, readTextFile } from './files.ts';
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
  type SpinFile,
} from './transfer.ts';
import { StorageError } from './errors.ts';
import { idbDrillRepo } from './drillRepo.ts';
import { createSession, addDrillToSession } from './sessionRepo.ts';
import { findReferrers } from './drillRepo.ts';
import { getDB } from './db.ts';
import { createDrill } from '../model/defaults.ts';
import { newId } from '../core/ids.ts';
import type { Drill } from '../model/drill.ts';
import type { TrainingSession } from '../model/session.ts';

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
  it('drillFileName 은 .spin.json 이중 확장자를 쓴다', () => {
    const d = createDrill({ courtMode: 'full', title: '측면-돌파-후-크로스' });
    const name = drillFileName(d);
    expect(name.startsWith('SPIN_측면-돌파-후-크로스_')).toBe(true);
    expect(name.endsWith('.spin.json')).toBe(true);
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
    const sessionDoc: TrainingSession = {
      schemaVersion: 1,
      id: newId('se'),
      title: '가져온 세션',
      items: [{ id: newId('it'), drillId: existing.id, titleCache: fileDrill.title, durationMinCache: fileDrill.durationMin, categoryCache: fileDrill.category }],
      drillIds: [existing.id],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
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
    expect(committedSession.items[0]!.drillId).toBe(newDrillId);
    expect(committedSession.drillIds).toEqual([newDrillId]);

    const refs = await findReferrers(newDrillId!);
    expect(refs.some((r) => r.id === committedSession.id)).toBe(true);
  });

  it('파일에서 온 세션(drillIds: []) 을 커밋한 뒤 findReferrers(드릴) 가 SessionId 를 반환한다', async () => {
    const d = await idbDrillRepo.createDrill({ courtMode: 'full', title: '빈 drillIds 검증' });
    const sessionDoc: TrainingSession = {
      schemaVersion: 1,
      id: newId('se'),
      title: '빈 drillIds 세션',
      items: [{ id: newId('it'), drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.category }],
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
