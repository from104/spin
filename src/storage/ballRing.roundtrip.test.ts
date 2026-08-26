// §7 5.2 — 공의 거리 원이 **실제 저장 경로 세 곳**을 왕복하는가(2026-08-13 기현님 실기 ③).
//
// src/model/ballRing.test.ts 는 validateDrill/migrateDoc 을 직접 부른다. 사용자의 데이터가
// 실제로 지나는 길은 그것이 아니라 IDB(putDrill/loadDrill) · 드릴 파일 · 기기 이사 파일이다.
// 이음매가 하나만 끊겨도 모델 단위 테스트는 전부 초록불이다("저장은 되는데 화면엔 없다" 의
// 반대 형태: "화면엔 있는데 저장이 안 된다") — 그래서 여기서 한 줄로 본다.
//
// **공 두 개를 서로 다른 상태로 싣는 것이 이 파일의 핵심**이다. 하나짜리 왕복은 전역 상태
// 구현으로도 통과한다.
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
import { addBall, cycleBallRing } from '../model/edits.ts';
import { ballRingOf, type BallRing, type Drill } from '../model/drill.ts';

async function wipeAll(): Promise<void> {
  const db = await getDB();
  await db.clear('drills');
  await db.clear('drillSummaries');
  await db.clear('sessions');
  localStorage.removeItem(PREFS_KEY);
  localStorage.removeItem(BOARD_KEY);
}

/** v9 — 링은 스텝 소유다. 이 파일의 픽스처는 스텝이 하나뿐이라 첫 스텝이 곧 그 판이다. */
const rings = (d: Drill | undefined | null): BallRing[] => (d ? d.cast.balls.map((b) => ballRingOf(d.steps[0]!, b.id)) : []);

/** 공 3개: 3 m · 5 m · 없음. 세 상태가 한 문서 안에서 서로 다르게 살아남아야 한다. */
function mixedDrill(title: string): Drill {
  let d = createDrill({ courtMode: 'full', formation: '1-2-1', title });
  d = addBall(d, 0, { x: 500, y: 300 });
  d = addBall(d, 0, { x: 300, y: 200 });
  const [a, b] = d.cast.balls.map((x) => x.id);
  d = cycleBallRing(d, 0, a!); // 3m
  d = cycleBallRing(cycleBallRing(d, 0, b!), 0, b!); // 5m
  return d;
}

describe('§5.2 IDB 왕복 — 화이트리스트에 이름이 없으면 여기서 증발한다', () => {
  it('세 상태가 저장 → 재읽기에서 **공마다 그대로** 살아 돌아온다', async () => {
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', title: '원 왕복' });
    const mixed = { ...mixedDrill('원 왕복'), id: made.id, createdAt: made.createdAt, updatedAt: made.updatedAt };
    expect(rings(mixed)).toEqual(['3m', '5m', 'none']);
    await idbDrillRepo.putDrill(mixed);

    // 날것 레코드에도 필드가 실제로 들어가 있다(요약만 보고 통과하는 것을 막는다).
    const raw = (await (await getDB()).get('drills', made.id)) as Drill | undefined;
    expect(raw?.steps[0]!.ballRings).toEqual({ [raw!.cast.balls[0]!.id]: '3m', [raw!.cast.balls[1]!.id]: '5m' });

    const back = await idbDrillRepo.loadDrill(made.id);
    expect(back.status).toBe('ok');
    if (back.status !== 'ok') return;
    expect(rings(back.drill)).toEqual(['3m', '5m', 'none']);
    expect(back.repairs).toHaveLength(0); // 방금 쓴 문서를 다시 고치지 않는다
  });

  it('편집 후 되쓰기에서도 유지된다 — putDrill 이 필드를 떨구지 않는다', async () => {
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', title: '되쓰기' });
    await idbDrillRepo.putDrill({ ...cycleBallRing(made, 0, made.cast.balls[0]!.id), title: '되쓰기 · 고침' });
    const back = await idbDrillRepo.getDrill(made.id);
    expect(rings(back)).toEqual(['3m']);
    expect(back?.title).toBe('되쓰기 · 고침'); // 대조군 — 다른 필드도 살아 있다
  });

  it("원을 끄면 저장본에서도 **키가 사라진다** — 'none' 이라는 값을 남기지 않는다", async () => {
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', title: '끄기' });
    const id = made.cast.balls[0]!.id;
    await idbDrillRepo.putDrill(cycleBallRing(made, 0, id)); // 3m
    const on = (await (await getDB()).get('drills', made.id)) as Drill;
    expect(on.steps[0]!.ballRings).toEqual({ [id]: '3m' });
    // 3m → 5m(우리) → 5m(상대) → 없음. 5 m 가 두 칸인 것은 소유(공을 차는 팀)를 나르기 때문이다.
    await idbDrillRepo.putDrill(cycleBallRing(cycleBallRing(cycleBallRing(on, 0, id), 0, id), 0, id));
    const off = (await (await getDB()).get('drills', made.id)) as Drill;
    // 맵이 비면 **키 자체가** 사라진다(locked/ignored 가 빈 배열을 지우는 것과 같다).
    expect(Object.prototype.hasOwnProperty.call(off.steps[0]!, 'ballRings')).toBe(false);
  });
});

describe('§5.2 드릴 파일 왕복 — 내보낸 파일을 다시 가져와도 원이 같다', () => {
  it('exportDrillFile → parseSpinFile → import 에서 세 상태가 보존된다', async () => {
    const d = mixedDrill('원 파일');
    const text = await exportDrillFile(d).text();
    // 봉투 안 payload 에 필드가 실제로 실려 있다(직렬화 단계에서 사라지는 것을 막는다).
    const payload = (JSON.parse(text) as { payload: Drill }).payload;
    expect(payload.steps[0]!.ballRings).toEqual({ [payload.cast.balls[0]!.id]: '3m', [payload.cast.balls[1]!.id]: '5m' });
    // ⚠️ 도장은 **9** 다 — 2026-08-27 에 **이 필드(ring)가** 올렸다. 링이 cast 에서 스텝으로
    // 내려가면서 마이그레이션이 할 일이 생겼기 때문이다(옛 값을 전 스텝에 옮겨 적는다).
    // 오래 "링은 도장을 올리지 않았다" 를 지키던 자리라, 뒤집힌 사실을 여기 남긴다.
    expect(payload.schemaVersion).toBe(9);

    const cands = await prepareDrillImport(parseSpinFile(text));
    expect(cands).toHaveLength(1);
    expect(rings(cands[0]!.doc)).toEqual(['3m', '5m', 'none']);
    const out = await commitDrillImports([{ candidate: cands[0]!, resolution: 'copy' }]);
    expect(out.failed).toEqual([]);
    expect(rings(await idbDrillRepo.getDrill(out.written[0]!))).toEqual(['3m', '5m', 'none']);
  });
});

// ── backup 봉투(§6.1b, 4차) 가 이 필드를 담는가 ────────────────────────────────────────────
// 이 블록은 wipeAll() 로 IDB 3스토어 + localStorage 2키를 비우므로 **파일 맨 끝**에 둔다
// (transfer.test.ts · courtSize.roundtrip.test.ts 의 같은 규칙).
describe('§5.2 기기 이사 파일이 공의 원을 담는다', () => {
  it('내보내고 → 지우고 → 복원하면 세 상태가 제 공으로 돌아온다', async () => {
    await wipeAll();
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', title: '이사' });
    await idbDrillRepo.putDrill({ ...mixedDrill('이사'), id: made.id, createdAt: made.createdAt, updatedAt: made.updatedAt });
    // 자유 전술판도 공을 갖는다 — backup 은 판까지 담는 봉투다.
    saveBoard(mixedDrill('이사 전술판'), false);

    const text = await exportBackupFile(await collectBackup()).text();
    const payload = (JSON.parse(text) as { payload: { drills: Drill[]; board: { drill: Drill } | null } }).payload;
    expect(Object.values(payload.drills[0]!.steps[0]!.ballRings ?? {})).toEqual(['3m', '5m']);
    expect(Object.values(payload.board?.drill.steps[0]!.ballRings ?? {})).toEqual(['3m', '5m']);

    // 대조군 — 정말 지워졌는지 먼저 확인한다. 안 그러면 "안 지워서 통과" 다.
    await wipeAll();
    expect((await idbDrillRepo.loadDrill(made.id)).status).toBe('missing');
    expect(loadBoard()).toBeNull();

    const report = await restoreBackup(parseSpinFile(text), { board: 'replace' });
    expect(report.drills.failed).toEqual([]);
    const back = await idbDrillRepo.loadDrill(made.id);
    expect(back.status).toBe('ok');
    if (back.status !== 'ok') return;
    expect(rings(back.drill)).toEqual(['3m', '5m', 'none']);
    expect(report.board).toBe('restored');
    expect(rings(loadBoard()?.drill)).toEqual(['3m', '5m', 'none']);
  });

  it('같은 파일을 두 번 복원해도 사본이 생기지 않는다 — 원이 왕복 항등이라는 뜻이다', async () => {
    await wipeAll();
    const made = await idbDrillRepo.createDrill({ courtMode: 'full', title: '멱등 확인' });
    await idbDrillRepo.putDrill({ ...mixedDrill('멱등 확인'), id: made.id, createdAt: made.createdAt, updatedAt: made.updatedAt });
    const file = parseSpinFile(await exportBackupFile(await collectBackup()).text());
    await restoreBackup(file);
    const second = await restoreBackup(file);
    // ⚠️ 여기가 조용히 깨지는 자리다: 저장본과 파일본의 ring 표현이 어긋나면(예: 한쪽만
    // `{ring:'none'}` 을 남기면) sameDrill 이 'exists' 로 보고 (사본) 을 하나 더 만든다.
    // 목록이 매 복원마다 두 배가 된다.
    expect(second.drills.written).toEqual([]);
    expect(second.drills.skipped).toHaveLength(1);
    expect(await idbDrillRepo.countDrills()).toBe(1);
  });
});
