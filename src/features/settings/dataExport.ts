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
import { StorageError } from '../../storage/errors.ts';
import { readTextFile } from '../../storage/files.ts';
import type { Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';

/** 파일 하나 → 복원 보고. 파싱 실패·kind 불일치는 StorageError 로 그대로 던진다(화면이 문구를
 *  토스트로 옮긴다) — 여기서 삼키면 "아무 일도 안 일어난 것처럼" 보인다. */
export async function restoreBackupFromFile(file: File, opts: RestoreBackupOptions = {}, locale: Locale = 'ko'): Promise<BackupRestoreReport> {
  const parsed = parseSpinFile(await readTextFile(file));
  // ⚠️ library 를 restoreBackup 의 일반 거절('이 버전에서 지원하지 않는 파일 종류입니다
  //    (library)')로 흘리지 마라(5.0 ③, 2026-08-13). 어제(4.7)까지 [전체 내보내기]가 만들던
  //    **유일한 백업 파일**이 바로 library 봉투라, 그 파일은 사용자 손에 반드시 존재한다 —
  //    "지원하지 않는다" 는 거짓말이고(드릴 목록에서는 여전히 열린다), 길을 안 알려주면 코치는
  //    자기 백업이 죽었다고 믿는다. a509d76 과 같은 수법이다: 공용 메시지
  //    (STORAGE_ERROR_MESSAGES.E_UNSUPPORTED_KIND)는 건드리지 않고 **이 화면에서만** kind 를
  //    특별대우한다. 진짜 모르는 kind(drillSet 등)는 그대로 restoreBackup 의 일반 문구를 받는다.
  if (parsed.spin === 'library') {
    throw new StorageError('E_UNSUPPORTED_KIND', translate(locale, 'settings.data.libraryKindError'), { localized: true });
  }
  return restoreBackup(parsed, opts);
}

/** 토스트 한 줄. 0 이어도 숫자를 숨기지 않는다(4.2 `importReportLine` 과 같은 규율) — 10개짜리
 *  파일에서 7개만 들어온 것을 사용자가 물을 곳이 여기밖에 없다.
 *
 *  ⚠️ 설정 줄을 **항상** 말한다. `RestoreBackupOptions.prefs` 기본값이 'skip' 이라서, 체크박스를
 *  안 켠 사람은 테마·큰 표적·UI 배율이 그대로 남는다 — 그것이 의도이고(남의 백업에서 드릴만
 *  받는 경우가 흔하다), 말하지 않으면 "설정까지 복원됐겠지" 라는 반대 오해가 남는다. */
export function backupReportLine(r: BackupRestoreReport, locale: Locale = 'ko'): string {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate(locale, key, params);
  const broken = r.drillsInFile - (r.drills.written.length + r.drills.skipped.length + r.drills.failed.length);
  const failed = broken + r.drills.failed.length;
  const sessions = t('data.report.sessions', { written: r.sessionsWritten.length, skipped: r.sessionsSkipped.length + r.sessionsFailed });
  const prefs = r.prefs === 'restored' ? t('data.report.prefsRestored') : r.prefs === 'unreadable' ? t('data.report.prefsUnreadable') : t('data.report.prefsKept');
  // 5.0 ②a(2026-08-13) — 옛 'skipped' 하나가 "파일에 판이 없다"(정상) 와 "로컬 판이 편집 중이라
  // 덮지 않았다" 를 뭉갰고, 토스트는 '전술판은 그대로 둠' 이라고만 해 **이유를 안 말했다.**
  // 보고(BoardRestoreResult)를 갈랐으므로 이제 둘을 다르게 말한다. 편집 중 쪽은 문구가
  // **다음 행동**까지 말해야 한다 — [전술판 교체] 체크박스(SettingsScreen 복원 모달)가 그 길이고,
  // 그 이름을 여기서 그대로 부른다(a509d76 의 "버튼 이름을 그대로 부른다" 규율).
  const board =
    r.board === 'restored'
      ? t('data.report.boardRestored')
      : r.board === 'unreadable'
        ? t('data.report.boardUnreadable')
        : r.board === 'none-in-file'
          ? t('data.report.boardNoneInFile')
          : r.board === 'kept-local-edited'
            ? t('data.report.boardKeptLocalEdited')
            : t('data.report.boardKept');
  // 로스터(C3) — none-in-file(구 백업·빈 명단)은 말하지 않는다: 정상이고 할 일이 없는데
  // 줄이 길어지기만 한다. 그 밖의 상태는 board 와 같은 규율로 전부 말한다.
  const roster =
    r.roster === 'restored'
      ? t('data.report.rosterRestored')
      : r.roster === 'unreadable'
        ? t('data.report.rosterUnreadable')
        : r.roster === 'kept-local'
          ? t('data.report.rosterKeptLocal')
          : r.roster === 'skipped'
            ? t('data.report.rosterKept')
            : '';
  return `${t('data.report.drills', { written: r.drills.written.length, failed, skipped: r.drills.skipped.length })} · ${sessions} · ${prefs}${board}${roster}`;
}
