// §6.1b 기기 이사 파일 — **읽는 쪽**. 설정 화면의 오케스트레이션만 여기 둔다.
//
// 2026-08-12(4.7)에 이 파일의 방향이 뒤집혔다. 전에는 `exportAllDrillsToFile`(= 드릴만 담은
// library 봉투를 만드는 '전체 내보내기')이 여기 있었고, **같은 버튼이 목록 화면에도 있었다.**
// 계획서 §6.1b 가 그 둘을 지목했다: *"목록 화면과 설정 화면의 중복 '전체 내보내기' 버튼 둘 다
// 제거"* — 그리고 지운 이유는 중복이 아니라 **거짓말**이었기 때문이다. library 봉투에는 세션도,
// 설정도, 자유 전술판도 안 들어간다. 사용자는 백업했다고 믿고 있다가 브라우저 데이터를 지운
// 뒤에야 손실을 안다. 쓰기는 이제 backup 봉투 하나이고(§6.4 [보드] 하단 [내보내기] → 파일),
// 여기 남은 것은 **그 파일을 다시 여는 길**이다.
//
// §8 소유권: 이 모듈은 `features/library/transfer.ts` 를 import 하지 않는다(옛 주석의 판단을
// 그대로 유지한다 — 파일 소유권이 갈려 있다). 대신 보고 문구의 **산식**을 4.2 의
// `buildImportReport` 와 같은 형태로 맞춘다: 손상 항목은 따로 세지 않고
// `파일에 있던 수 − (기록 + 건너뜀 + 실패)` 로 구한다. 집계 지점이 갈라지면 두 화면의 숫자가
// 서로 다르게 거짓말한다.
import { parseSpinFile, restoreBackup } from '../../storage/transfer.ts';
import type { BackupRestoreReport, RestoreBackupOptions } from '../../storage/transfer.ts';
import { readTextFile } from '../../storage/files.ts';

/** 파일 하나 → 복원 보고. 파싱 실패·kind 불일치는 StorageError 로 그대로 던진다(화면이 문구를
 *  토스트로 옮긴다) — 여기서 삼키면 "아무 일도 안 일어난 것처럼" 보인다. */
export async function restoreBackupFromFile(file: File, opts: RestoreBackupOptions = {}): Promise<BackupRestoreReport> {
  return restoreBackup(parseSpinFile(await readTextFile(file)), opts);
}

/** 토스트 한 줄. 0 이어도 숫자를 숨기지 않는다(4.2 `importReportLine` 과 같은 규율) — 10개짜리
 *  파일에서 7개만 들어온 것을 사용자가 물을 곳이 여기밖에 없다.
 *
 *  ⚠️ 설정 줄을 **항상** 말한다. `RestoreBackupOptions.prefs` 기본값이 'skip' 이라서, 체크박스를
 *  안 켠 사람은 테마·큰 표적·UI 배율이 그대로 남는다 — 그것이 의도이고(남의 백업에서 드릴만
 *  받는 경우가 흔하다), 말하지 않으면 "설정까지 복원됐겠지" 라는 반대 오해가 남는다. */
export function backupReportLine(r: BackupRestoreReport): string {
  const broken = r.drillsInFile - (r.drills.written.length + r.drills.skipped.length + r.drills.failed.length);
  const failed = broken + r.drills.failed.length;
  const sessions = `세션 ${r.sessionsWritten.length}개 가져옴 · ${r.sessionsSkipped.length + r.sessionsFailed}개 건너뜀`;
  const prefs = r.prefs === 'restored' ? '설정 복원함' : r.prefs === 'unreadable' ? '설정은 읽을 수 없어 그대로 둠' : '설정은 그대로 둠';
  // ⚠️ 'skipped' 는 두 가지를 뭉뚱그린다 — 파일에 판이 없었거나(정상), 로컬 판이 편집 중이라
  //    덮지 않았거나(storage/transfer.ts restoreBoardFrom). 둘을 가르는 정보가 보고에 없으므로
  //    **이유를 지어내지 않는다**. 이유까지 말하려면 먼저 그 보고를 나눠야 한다.
  const board =
    r.board === 'restored' ? ' · 전술판 복원함' : r.board === 'unreadable' ? ' · 전술판은 읽을 수 없어 그대로 둠' : ' · 전술판은 그대로 둠';
  return `드릴 ${r.drills.written.length}개 가져옴 · ${failed}개 실패 · ${r.drills.skipped.length}개 건너뜀 · ${sessions} · ${prefs}${board}`;
}
