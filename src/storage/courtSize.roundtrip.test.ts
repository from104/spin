// §5.1 — 코트 크기가 **실제 저장 경로 네 곳**을 왕복하는가.
//
// src/model/courtSize.test.ts 는 validateDrill/migrateDoc 을 직접 부른다. 사용자의 데이터가
// 실제로 지나는 길은 그것이 아니라 IDB(putDrill/loadDrill) · 드릴 파일 · 기기 이사 파일이다.
// 그 사이 이음매가 하나만 끊겨도 모델 단위 테스트는 전부 초록불이다 — 그래서 여기서 한 줄로 본다.
import { describe, expect, it } from 'vitest';
import { getDB } from './db.ts';
import { idbDrillRepo } from './drillRepo.ts';
import {
  collectBackup,
  exportBackupFile,
  exportDrillFile,
  parseSpinFile,
  prepareDrillImport,
  commitDrillImports,
  restoreBackup,
} from './transfer.ts';
import { PREFS_KEY } from './prefs.ts';
import { BOARD_KEY, saveBoard, loadBoard } from './board.ts';
import { createDrill } from '../model/defaults.ts';
import { COURT_SIZES } from '../model/court.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';

async function wipeAll(): Promise<void> {
  const db = await getDB();
  await db.clear('drills');
  await db.clear('drillSummaries');
  await db.clear('sessions');
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem(BOARD_KEY);
}

describe('§5.1 IDB 왕복 — 화이트리스트에 이름이 없으면 여기서 증발한다', () => {
  it('세 크기가 저장 → 재읽기에서 그대로 살아 돌아온다', async () => {
    for (const size of COURT_SIZES) {
      const made = await idbDrillRepo.createDrill({ courtMode: 'full', courtSize: size, title: `${size} 드릴` });
      expect(made.courtSize, size).toBe(size);

      // 날것 레코드에도 필드가 실제로 들어가 있다(요약만 보고 통과하는 것을 막는다).
      const raw = await (await getDB()).get('drills', made.id);
      expect((raw as { courtSize?: string } | undefined)?.courtSize, size).toBe(size);

      const back = await idbDrillRepo.loadDrill(made.id);
      expect(back.status, size).toBe('ok');
      if (back.status !== 'ok') return;
      expect(back.drill.courtSize, size).toBe(size);
      expect(back.repairs, size).toHaveLength(0); // 방금 쓴 문서를 다시 고치지 않는다
      expect(back.drill.title, size).toBe(`${size} 드릴`); // 대조군 — 다른 필드도 살아 있다
    }
  });

  it('편집 후 되쓰기에서도 크기가 유지된다 — putDrill 이 필드를 떨구지 않는다', async () => {
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', courtSize: '28x15', title: '되쓰기' });
    const edited = { ...made, title: '되쓰기 · 고침' };
    await idbDrillRepo.putDrill(edited);
    const back = await idbDrillRepo.getDrill(made.id);
    expect(back?.courtSize).toBe('28x15');
    expect(back?.title).toBe('되쓰기 · 고침');
  });

  it('새로 만든 드릴은 최신 스키마 도장을 갖고 저장된다', async () => {
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', courtSize: '25x14' });
    const raw = await (await getDB()).get('drills', made.id);
    expect((raw as { schemaVersion?: number } | undefined)?.schemaVersion).toBe(CURRENT_DRILL_SCHEMA);
  });
});

describe('§5.1 드릴 파일 왕복 — 내보낸 파일을 다시 가져와도 코트가 같다', () => {
  it('exportDrillFile → parseSpinFile → import 에서 크기가 보존된다', async () => {
    const d = createDrill({ courtMode: 'full', courtSize: '25x14', title: '최소 코트 드릴' });
    const text = await exportDrillFile(d).text();
    // 봉투 안 payload 에 필드가 실제로 실려 있다(직렬화 단계에서 사라지는 것을 막는다).
    expect((JSON.parse(text) as { payload: { courtSize?: string } }).payload.courtSize).toBe('25x14');

    const cands = await prepareDrillImport(parseSpinFile(text));
    expect(cands).toHaveLength(1);
    expect(cands[0]!.doc.courtSize).toBe('25x14');
    const out = await commitDrillImports([{ candidate: cands[0]!, resolution: 'copy' }]);
    expect(out.failed).toEqual([]);
    const saved = await idbDrillRepo.getDrill(out.written[0]!);
    expect(saved?.courtSize).toBe('25x14');
  });
});

// ── backup 봉투(§6.1b, 4차) 가 새 필드를 담는가 ────────────────────────────────────────────
// 이 블록은 wipeAll() 로 IDB 3스토어 + localStorage 2키를 비우므로 **파일 맨 끝**에 둔다
// (transfer.test.ts 의 같은 규칙).
describe('§5.1 기기 이사 파일이 코트 크기를 담는다', () => {
  it('내보내고 → 지우고 → 복원하면 세 크기가 전부 제 코트로 돌아온다', async () => {
    await wipeAll();
    const made = [];
    for (const size of COURT_SIZES) {
      made.push(await idbDrillRepo.createDrill({ courtMode: 'full', courtSize: size, title: `이사 ${size}` }));
    }
    // 자유 전술판도 크기를 갖는다 — backup 은 판까지 담는 봉투다.
    saveBoard(createDrill({ courtMode: 'full', courtSize: '28x15', title: '이사 전술판' }), false);

    const text = await exportBackupFile(await collectBackup()).text();
    const payload = (JSON.parse(text) as { payload: { drills: Array<{ courtSize?: string }>; board: { drill: { courtSize?: string } } | null } }).payload;
    expect(payload.drills.map((d) => d.courtSize).sort()).toEqual([...COURT_SIZES].sort());
    expect(payload.board?.drill.courtSize).toBe('28x15');

    // 대조군 — 정말 지워졌는지 먼저 확인한다. 안 그러면 "안 지워서 통과" 다.
    await wipeAll();
    for (const d of made) expect((await idbDrillRepo.loadDrill(d.id)).status).toBe('missing');
    expect(loadBoard()).toBeNull();

    const report = await restoreBackup(parseSpinFile(text), { board: 'replace' });
    expect(report.drills.failed).toEqual([]);
    for (const d of made) {
      const back = await idbDrillRepo.loadDrill(d.id);
      expect(back.status, d.title).toBe('ok');
      if (back.status !== 'ok') return;
      expect(back.drill.courtSize, d.title).toBe(d.courtSize);
    }
    expect(report.board).toBe('restored');
    expect(loadBoard()?.drill.courtSize).toBe('28x15');
  });

  it('같은 파일을 두 번 복원해도 사본이 생기지 않는다 — 크기가 왕복 항등이라는 뜻이다', async () => {
    await wipeAll();
    await idbDrillRepo.createDrill({ courtMode: 'full', courtSize: '28x15', title: '멱등 확인' });
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());
    await restoreBackup(file);
    const second = await restoreBackup(file);
    // ⚠️ 여기가 조용히 깨지는 자리다: 저장본과 파일본의 courtSize 가 어긋나면 sameDrill 이
    // 'exists' 로 보고 (사본) 을 하나 더 만든다. 목록이 매 복원마다 두 배가 된다.
    expect(second.drills.written).toEqual([]);
    expect(second.drills.skipped).toHaveLength(1);
    expect(await idbDrillRepo.countDrills()).toBe(1);
  });
});
