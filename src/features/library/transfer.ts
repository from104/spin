// §4.7 내보내기/가져오기 화면 로직. storage/transfer.ts·files.ts(§4.7, storage 소유)의 순수
// 함수만 조합한다 — 이 파일은 그 파일들을 수정하지 않고 오케스트레이션만 담당한다.
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import {
  parseSpinFile,
  prepareDrillImport,
  prepareSessionImport,
  commitDrillImports,
  commitSessionImport,
  exportDrillFile,
  exportSessionFile,
  type SpinFile,
  type ImportCandidate,
  type ImportResolution,
  type ImportOutcome,
} from '../../storage/transfer.ts';
import { drillFileName, slugify, ymdLocal, readTextFile, downloadBlob } from '../../storage/files.ts';
import type { Drill } from '../../model/drill.ts';
import type { TrainingSession } from '../../model/session.ts';
import type { DrillId } from '../../core/ids.ts';
import type { Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';

export async function exportOneDrill(id: DrillId, locale: Locale = 'ko'): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const d = await repo.getDrill(id);
  if (!d) throw new Error(translate(locale, 'library.transfer.drillNotFoundError'));
  downloadBlob(exportDrillFile(d), drillFileName(d));
}

// ⚠️ `exportAllDrills`(= 목록의 [전체 내보내기])는 2026-08-12(4.7)에 **삭제됐다. 되살리지 마라.**
//    library 봉투는 `Drill[]` 뿐이라 세션(IDB sessions)·설정(spin.prefs)·자유 전술판(spin.board)이
//    아무 파일에도 안 들어간다 — 계획서 §6.1b 가 그것을 '기능 부족이 아니라 거짓말' 이라 부르고
//    쓰기 중단을 확정했다(읽기는 계속 지원한다: parseSpinFile 의 'library' 분기는 그대로다).
//    통째로 담는 파일이 필요하면 `storage/transfer.ts` 의 collectBackup/exportBackupFile 이고,
//    그 진입점은 [보드] 하단 [내보내기] → [기기 이사 파일] 하나뿐이다(§6.4).

export async function exportOneSession(session: TrainingSession): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const map = await repo.getDrills(session.drillIds);
  const drills = session.drillIds.map((id) => map.get(id)).filter((d): d is Drill => d !== undefined);
  // i18n C4 — 파일명 세그먼트는 번역하지 않는다(드릴 쪽 drillFileName 도 언어 중립이다) — 다운로드
  // 파일명은 UI 문구가 아니라 파일 시스템 호환성이 우선이라, '세션'을 영문 'session' 으로 고쳤다.
  downloadBlob(exportSessionFile(session, drills), `SPIN_session_${slugify(session.title)}_${ymdLocal(Date.now())}.spin.json`);
}

/** 가져오기 1단계: 파일을 읽고 파싱해 후보 목록을 만든다. UI 는 이 결과로 conflict:'exists' 만
 *  사용자에게 물으면 된다.
 *
 *  `drillsInFile` 은 **검증 전** 원본 개수다(§6.1c). prepareDrillCandidates 는 손상 항목
 *  (마이그레이션 불가·검증 탈락)을 후보에서 조용히 제외하므로, 후보 목록 길이만 보면 "10개짜리
 *  파일에서 7개만 들어왔다" 는 사실이 어디에도 남지 않는다 — 그 차가 곧 실패 보고의 재료다. */
export type ImportPreview =
  | { kind: 'drills'; file: SpinFile; drills: ImportCandidate<Drill>[]; drillsInFile: number }
  | { kind: 'session'; file: SpinFile; drills: ImportCandidate<Drill>[]; session: ImportCandidate<TrainingSession>; drillsInFile: number }
  | { kind: 'unsupported'; reason: string };

/** 파일이 싣고 온 드릴 원본 개수 — 검증을 거치기 전이므로 payload 형태를 방어적으로 센다
 *  (parseSpinFile 은 봉투 필드만 보고 payload 내부는 열지 않는다). */
function rawDrillCount(file: SpinFile): number {
  if (file.spin === 'drill') return 1;
  if (file.spin === 'library') return Array.isArray(file.payload) ? file.payload.length : 0;
  if (file.spin === 'session') {
    const p = file.payload as { drills?: unknown };
    return Array.isArray(p.drills) ? p.drills.length : 0;
  }
  return 0;
}

export async function readImportFile(file: File, locale: Locale = 'ko'): Promise<ImportPreview> {
  const text = await readTextFile(file);
  const parsed = parseSpinFile(text);
  if (parsed.spin === 'drill' || parsed.spin === 'library') {
    return { kind: 'drills', file: parsed, drills: await prepareDrillImport(parsed), drillsInFile: rawDrillCount(parsed) };
  }
  if (parsed.spin === 'session') {
    const { drills, session } = await prepareSessionImport(parsed);
    return { kind: 'session', file: parsed, drills, session, drillsInFile: rawDrillCount(parsed) };
  }
  if (parsed.spin === 'prefs') return { kind: 'unsupported', reason: translate(locale, 'library.transfer.reasonPrefsFile') };
  // ⚠️ backup 을 마지막 폴백으로 흘리지 마라. §6.1b 이후 [기기 이사 파일]은 이 앱이 만드는
  //    **유일한 통짜 백업**이고, 그것을 여기서 '지원하지 않는 파일 형식입니다' 로 떨구면
  //    코치가 방금 자기가 만든 파일을 열려다 **파일이 잘못됐다는 말**을 듣는다. 여는 자리가
  //    다른 화면일 뿐이라는 사실을 문구가 직접 말해야 한다(버튼 이름을 그대로 부른다).
  //    목록에서 실제로 복원까지 하게 만드는 것은 별개다 — 설정 화면의 '설정도 함께 복원'
  //    체크박스와 전술판 정책(RestoreBackupOptions)을 여기로 옮겨야 하는 결정이라 미뤘다.
  if (parsed.spin === 'backup') {
    return { kind: 'unsupported', reason: translate(locale, 'library.transfer.reasonBackupFile') };
  }
  return { kind: 'unsupported', reason: translate(locale, 'library.transfer.reasonUnsupportedFormat') };
}

/** conflict 별 기본 해상도. 'exists' 만 사용자가 고른 값으로 덮어써야 한다. */
export function defaultResolution(c: ImportCandidate<unknown>['conflict']): ImportResolution {
  if (c === 'identical') return 'skip';
  return 'copy'; // 'none' | 'exists' 의 안전 기본값 — §4.7 "포커스 기본값은 사본으로 추가"
}

export async function commitDrills(
  candidates: ImportCandidate<Drill>[],
  resolutions: ReadonlyMap<number, ImportResolution>,
): Promise<ImportOutcome> {
  const items = candidates.map((candidate, i) => ({ candidate, resolution: resolutions.get(i) ?? defaultResolution(candidate.conflict) }));
  return commitDrillImports(items);
}

export async function commitSession(session: TrainingSession, outcome: ImportOutcome): Promise<TrainingSession> {
  return commitSessionImport(session, outcome);
}

// ---- 가져오기 보고 (§6.1c / 로드맵 4.2) -------------------------------------------------------

/** 사용자에게 보고하는 세 숫자. 파일 안의 모든 드릴은 이 셋 중 정확히 한 곳에 떨어진다
 *  (imported + failed + skipped === drillsInFile — 아래 buildImportReport 의 산식이 보장한다).
 *  - imported: 저장까지 끝난 수. '사본으로 추가' 와 '덮어쓰기' 둘 다 여기다.
 *  - failed:   파일에는 있었으나 저장되지 못한 수 = 손상(마이그레이션·검증 탈락으로 후보조차
 *              못 된 것) + 커밋 단계 실패(outcome.failed). §6.1c 의 "조용히 건너뛴 손상 항목" 이
 *              여기 합산된다 — 이 숫자가 없으면 사용자는 10개짜리 파일에서 7개만 들어온 것을
 *              영영 모른다(이 항목의 존재 이유).
 *  - skipped:  사용자가 '건너뛰기' 를 골랐거나 동일 내용(identical)이라 건너뛴 수. */
export interface ImportReport {
  imported: number;
  failed: number;
  skipped: number;
}

/** ⚠️ broken 은 따로 세지 않고 산식으로 구한다: 후보가 된 것은 전부 written/skipped/failed 중
 *  하나로 끝나므로(commitDrillImports 의 루프 불변식), drillsInFile 에서 그 셋을 빼면 남는 것이
 *  곧 "후보조차 못 된 손상 항목" 이다. prepareDrillCandidates 에 카운터를 다는 대신 이 산식을
 *  쓰는 이유: 4.1 의 restoreBackup 도 같은 셈(drillsInFile - written - skipped)을 쓰고 있어,
 *  집계 지점이 갈라지면 두 화면의 숫자가 서로 다르게 거짓말할 수 있다. */
export function buildImportReport(drillsInFile: number, outcome: ImportOutcome): ImportReport {
  const broken = drillsInFile - (outcome.written.length + outcome.skipped.length + outcome.failed.length);
  return {
    imported: outcome.written.length,
    failed: broken + outcome.failed.length,
    skipped: outcome.skipped.length,
  };
}

/** 토스트 한 줄. 0 이어도 세 숫자를 전부 보여준다(로드맵 4.2 완료 판정: "세 숫자가 전부 나온다").
 *  0 을 숨기면 "7개 가져옴" 만 보고 나머지 3개가 어떻게 됐는지 물을 곳이 없다 — 컨트롤 예산(§3)
 *  때문에 상세 보기 버튼을 더할 수 없으므로, 이 한 줄이 보고의 전부다. */
export function importReportLine(r: ImportReport, locale: Locale = 'ko'): string {
  return translate(locale, 'library.transfer.importReportLine', { imported: r.imported, failed: r.failed, skipped: r.skipped });
}
