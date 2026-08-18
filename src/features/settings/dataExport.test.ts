// 2026-08-12(4.7) — 이 파일이 무엇을 지키다가 무엇을 지키게 됐는지.
//
// ── 사라져야 하는 계약 (지운 것) ──────────────────────────────────────────────────
//  · "id 가 0개면 다운로드하지 않고 0을 반환한다"
//  · "존재하는 드릴만 모아 하나의 파일로 내보내고 개수를 반환한다"(= `spin:'library'` 봉투)
//  둘 다 `exportAllDrillsToFile`(설정 화면의 '전체 내보내기')의 계약이었다. 그 버튼은 목록
//  화면에도 같은 것이 있던 **중복**이었고, 담기는 것이 드릴뿐이라 세션·설정·자유 전술판이
//  어떤 파일에도 안 들어갔다 — 계획서 §6.1b 가 그것을 *"기능 부족이 아니라 거짓말"* 이라 부르고
//  library 봉투 **쓰기 중단**을 확정했다. 그래서 이 계약들은 갱신이 아니라 **삭제**가 맞다.
//  대신 그 자리를 잇는 계약은 `src/features/export/ExportSheet.test.tsx` 에 있다
//  ("IDB 의 드릴이 실제로 담긴 backup 봉투가 파일로 떨어진다").
//
// ── 살아 있어야 하는 계약 (여기로 옮겨 다시 세운 것) ─────────────────────────────
//  · 설정 화면은 **파일 하나를 저장소에 붓는 오케스트레이션**을 이 모듈에 둔다(§8 소유권:
//    features/library/transfer.ts 를 import 하지 않는다).
//  · 보고의 **산식**은 목록 화면과 같아야 한다 — 손상 항목은 따로 세지 않고
//    `파일에 있던 수 − (기록 + 건너뜀 + 실패)` 로 구한다(4.2 buildImportReport 와 같은 계열).
//  · **설정은 기본적으로 복원되지 않는다.** 그 기본값이 화면 문구와 코드 양쪽에서 지켜지는지를
//    여기서 못박는다(4.1 이 4.7 에 넘긴 요구 — 접근성 설정이 말없이 바뀌면 사고다).
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { backupReportLine, restoreBackupFromFile } from './dataExport.ts';
import { collectBackup, exportBackupFile } from '../../storage/transfer.ts';
import type { BackupRestoreReport } from '../../storage/transfer.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { loadPrefs, makeDefaultPrefs, PREFS_KEY, savePrefs } from '../../storage/prefs.ts';

/** File 은 jsdom 에 있다. text() 는 있지만 안전하게 Blob 을 통해 만든다. */
function fileOf(text: string, name = 'SPIN_백업_20260812.spin.json'): File {
  return new File([text], name, { type: 'application/json' });
}

async function backupFile(): Promise<File> {
  return fileOf(await exportBackupFile(await collectBackup()).text());
}

describe('사라진 계약 — 전체 내보내기(library 봉투 쓰기)는 이 모듈에 없다', () => {
  it('exportAllDrillsToFile 이 더 이상 export 되지 않는다', async () => {
    const mod: Record<string, unknown> = await import('./dataExport.ts');
    expect('exportAllDrillsToFile' in mod).toBe(false);
    // 대조군 — 이 검사가 모듈을 실제로 읽었다(이름을 틀려 빈 객체를 본 것이 아니다).
    expect(typeof mod.restoreBackupFromFile).toBe('function');
    expect(typeof mod.backupReportLine).toBe('function');
  });
});

describe('restoreBackupFromFile — 파일 하나를 저장소에 붓는다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('백업 파일의 드릴이 실제로 IDB 에 들어온다', async () => {
    const seed = await idbDrillRepo.createDrill({ courtMode: 'full', title: '백업에 담긴 드릴' });
    const file = await backupFile();
    // 로컬에서 지운 뒤 복원한다 — 지우지 않으면 'identical' 로 건너뛰어(멱등) 아무것도 안 들어와
    // 이 테스트가 "쓰지 않아도 통과" 한다.
    await idbDrillRepo.deleteDrill(seed.id);
    const titles = async () => (await idbDrillRepo.listDrillSummaries()).map((d) => d.title);
    expect(await titles()).not.toContain('백업에 담긴 드릴');

    const report = await restoreBackupFromFile(file);
    expect(report.drills.written.length).toBeGreaterThanOrEqual(1);
    // 요약까지 함께 쓰였는가(B-6 길 ①) — 목록은 요약만 읽으므로 여기가 비면 화면에서 빈칸이다.
    expect(await titles()).toContain('백업에 담긴 드릴');
  });

  it('⚠️ 설정은 **기본적으로** 복원되지 않는다 — 체크박스를 켜야 바뀐다', async () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'light', a11y: { ...makeDefaultPrefs().a11y, largeTargets: true } });
    const file = await backupFile(); // 이 파일에는 largeTargets: true 가 들어 있다
    savePrefs({ ...makeDefaultPrefs(), theme: 'dark', a11y: { ...makeDefaultPrefs().a11y, largeTargets: false } });

    const skipped = await restoreBackupFromFile(file);
    expect(skipped.prefs).toBe('skipped');
    expect(loadPrefs().a11y.largeTargets).toBe(false); // 접근성 설정이 말없이 안 바뀐다

    // 대조군 — 같은 파일이 'replace' 에서는 정말로 덮는다(위 단언이 "파일에 값이 없어서" 통과한
    // 것이 아니다).
    const replaced = await restoreBackupFromFile(file, { prefs: 'replace' });
    expect(replaced.prefs).toBe('restored');
    expect(loadPrefs().a11y.largeTargets).toBe(true);
  });

  it('복원해도 spin.prefs 의 theme 은 최상위 문자열이다 — index.html 부트 스크립트의 불변식', async () => {
    savePrefs({ ...makeDefaultPrefs(), theme: 'light' });
    const file = await backupFile();
    await restoreBackupFromFile(file, { prefs: 'replace' });
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY)!) as Record<string, unknown>;
    expect(typeof raw.theme).toBe('string');
  });

  it('백업이 아닌 파일은 조용히 통과시키지 않고 던진다', async () => {
    await expect(restoreBackupFromFile(fileOf('{"spin":"drill","envelope":1,"payload":{}}'))).rejects.toThrow();
    await expect(restoreBackupFromFile(fileOf('그냥 글자'))).rejects.toThrow();
  });
});

describe('backupReportLine — 숫자를 숨기지 않는다', () => {
  const base: BackupRestoreReport = {
    drillsInFile: 0,
    sessionsInFile: 0,
    drills: { idMap: new Map(), written: [], skipped: [], failed: [] },
    sessionsWritten: [],
    sessionsSkipped: [],
    sessionsFailed: 0,
    prefs: 'skipped',
    board: 'skipped',
    roster: 'none-in-file',
  };

  it('0 이어도 세 숫자를 전부 말한다 (4.2 importReportLine 과 같은 규율)', () => {
    expect(backupReportLine(base)).toContain('드릴 0개 가져옴 · 0개 실패 · 0개 건너뜀');
  });

  it('후보조차 못 된 손상 항목이 실패에 합산된다 — 파일 10, 기록 7 이면 실패 3', () => {
    const line = backupReportLine({
      ...base,
      drillsInFile: 10,
      drills: { idMap: new Map(), written: ['dr_1', 'dr_2', 'dr_3', 'dr_4', 'dr_5', 'dr_6', 'dr_7'] as never, skipped: [], failed: [] },
    });
    // 이 산식이 무너지면 사용자는 10개짜리 파일에서 7개만 들어온 것을 영영 모른다(§6.1c).
    expect(line).toContain('드릴 7개 가져옴 · 3개 실패 · 0개 건너뜀');
  });

  it('커밋 단계 실패와 손상 항목이 함께 세어진다 — 대조군(둘 중 하나만 세면 값이 달라진다)', () => {
    const line = backupReportLine({
      ...base,
      drillsInFile: 5,
      drills: { idMap: new Map(), written: ['dr_1'] as never, skipped: ['dr_2'] as never, failed: [{ id: 'dr_3' as never, reason: 'x' }] },
    });
    // broken = 5 - (1+1+1) = 2, 보고 실패 = 2 + 1 = 3
    expect(line).toContain('드릴 1개 가져옴 · 3개 실패 · 1개 건너뜀');
  });

  it('설정 줄을 **항상** 말한다 — 기본값이 skip 이라는 사실이 화면에 남아야 한다', () => {
    expect(backupReportLine(base)).toContain('설정은 그대로 둠');
    expect(backupReportLine({ ...base, prefs: 'restored' })).toContain('설정 복원함');
    expect(backupReportLine({ ...base, prefs: 'unreadable' })).toContain('설정은 읽을 수 없어');
  });

  // 5.0 ②a(2026-08-13) — 옛 계약("skipped 는 두 가지를 뭉뚱그리므로 이유를 지어내지 않는다")은
  // 보고가 갈라지면서 **삭제가 아니라 승격**됐다: 이제 사유가 실제로 오므로 지어내는 것이 아니라
  // 전달한다.
  it('전술판 줄이 사유를 가른다 — "파일에 없음" 과 "편집 중" 은 다른 문장이다', () => {
    expect(backupReportLine({ ...base, board: 'none-in-file' })).toContain('전술판은 파일에 없음');
    expect(backupReportLine({ ...base, board: 'restored' })).toContain('전술판 복원함');
    // 대조군 — 파일에 없던 것을 "편집 중이라 안 덮었다" 고 말하면 그게 바로 지어낸 이유다.
    expect(backupReportLine({ ...base, board: 'none-in-file' })).not.toContain('편집 중');
    expect(backupReportLine(base)).toContain('전술판은 그대로 둠'); // 정책 skip 은 중립 문구 유지
  });

  it('편집 중 쪽 문구는 **무엇을 하면 되는지**까지 말한다 — [전술판 교체] 체크박스를 이름으로 부른다', () => {
    const line = backupReportLine({ ...base, board: 'kept-local-edited' });
    expect(line).toContain('편집 중이라 그대로 둠');
    expect(line).toContain('[전술판 교체]'); // 복원 모달 체크박스의 실제 이름(SettingsScreen)
    expect(line).toContain('다시 읽으세요'); // 다음 행동: 켜고 재시도
  });
});

// ── 5.0 ③(2026-08-13) — 옛 [전체 내보내기]가 만들던 library 파일을 여기 넣었을 때 ──────────────
//
// 어제(4.7 이전)까지 library 봉투가 이 앱의 **유일한 백업 파일**이었으므로 사용자 손에 반드시
// 존재한다. restoreBackup 의 일반 거절('이 버전에서 지원하지 않는 파일 종류입니다 (library)')은
// 거짓말이다 — 지원한다, 여는 자리가 [드릴 목록]일 뿐이다. a509d76(목록이 backup 을 설정으로
// 보내던 고침)의 반대 방향을 같은 수법으로 고친다: 공용 메시지는 그대로, 이 화면에서만 특별대우.
describe('restoreBackupFromFile — 다른 화면 파일의 안내 (5.0 ③)', () => {
  it('library 봉투는 "지원하지 않는다" 가 아니라 [드릴 목록]으로 보낸다', async () => {
    const env = JSON.stringify({ spin: 'library', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: [] });
    await expect(restoreBackupFromFile(fileOf(env, 'SPIN_드릴전체_20260811.spin.json'))).rejects.toMatchObject({ code: 'E_UNSUPPORTED_KIND' });
    try {
      await restoreBackupFromFile(fileOf(env));
      expect.unreachable();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('[드릴 목록]'); // 어디로 가야 하는지
      expect(msg).toContain('[가져오기]'); // 그 화면의 실제 버튼 이름을 그대로 부른다
      // ★ 일반 거절 문구로 되돌아가면 여기가 운다 — 사용자는 자기 백업이 죽었다고 믿게 된다.
      expect(msg).not.toContain('지원하지 않는');
    }
  });

  it('대조군: 진짜 모르는 kind(drillSet)는 여전히 일반 문구다 — library 만 특별대우한다', async () => {
    const env = JSON.stringify({ spin: 'drillSet', envelope: 1, app: 'SPIN', exportedAt: Date.now(), payload: {} });
    try {
      await restoreBackupFromFile(fileOf(env));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('지원하지 않는 파일 종류');
      expect((e as Error).message).toContain('(drillSet)');
    }
  });

  it('대조군: 성한 backup 봉투는 그대로 열린다 — 분기를 더하면서 정상 경로를 막지 않았다', async () => {
    const report = await restoreBackupFromFile(await backupFile());
    expect(report.drills.failed).toEqual([]);
    expect(typeof report.drillsInFile).toBe('number');
  });
});
