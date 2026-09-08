// [팀] 메뉴의 파일 내보내기·가져오기 화면 로직 (2026-09-09 · PLAN-TEAM.md 결정 13).
// `storage/transfer.ts`·`storage/files.ts` 의 순수 함수만 조합한다 — `features/library/transfer.ts`
// 가 드릴·세션에 대해 하는 일과 같은 자리다(그 파일을 본떴다).
//
// ⚠️ **여기에 공유 링크 경로를 만들지 않는다**(결정 12, 기현 지시 2026-09-09: *"기기 저장,
// 구글 드라이브 동기화, 파일 내보내기만 허용, 공유 링크 없음"*). 이 파일이 `share/` 를
// import 하는 순간 그 울타리가 무너진다 — 팀이 밖으로 나가는 길은 이 파일의 두 함수와
// 기기 이사 파일뿐이다.
import {
  parseSpinFile,
  prepareTeamImport,
  commitTeamImports,
  exportTeamFile,
  type ExportTeamOptions,
  type ImportResolution,
} from '../../storage/transfer.ts';
import { downloadBlob, readTextFile, slugify, ymdLocal, SPIN_EXT } from '../../storage/files.ts';
import { getTeam } from '../../storage/teamRepo.ts';
import { StorageError } from '../../storage/errors.ts';
import type { TeamId } from '../../core/ids.ts';
import type { Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';
// ★ 타입만 가져온다 — 보고의 **모양**은 한 벌이어야 하고(AGENTS §3), 값 의존(다른 feature 의
//   함수 호출)은 만들지 않는다. 산식은 아래에 팀의 것으로 따로 쓴다.
import type { ImportReport } from '../library/transfer.ts';

/** 팀 하나 → `.spin.team.json`. i18n C4 — 파일명 세그먼트는 번역하지 않는다(세션 쪽
 *  `SPIN_session_…` 과 같은 규율): 다운로드 파일명은 UI 문구가 아니라 파일 시스템 호환성이
 *  우선이다. 팀 **이름**은 사용자 데이터라 그대로 slugify 되어 들어간다. */
export async function exportOneTeam(id: TeamId, opts: ExportTeamOptions = {}, locale: Locale = 'ko'): Promise<void> {
  const t = await getTeam(id);
  if (!t) throw new Error(translate(locale, 'team.transfer.notFoundError'));
  downloadBlob(exportTeamFile(t, opts), `SPIN_team_${slugify(t.name)}_${ymdLocal(Date.now())}${SPIN_EXT.team}`);
}

/** 이 화면이 아니라 **다른 화면**에서 여는 봉투들 → 각자의 안내 문구.
 *  `features/settings/dataExport.ts` 의 `OPENS_ON_ANOTHER_SCREEN` 과 같은 장치이고 같은 이유다:
 *  앱이 스스로 만들어 준 파일에 «지원하지 않는 종류» 라고 말하면 사용자는 파일이 깨졌다고
 *  믿는다(2026-08-26 실제 사고). 여기 빠진 종류(drillSet 등)만 일반 문구로 흘린다. */
function reasonForElsewhere(spin: string, locale: Locale): string {
  if (spin === 'drill' || spin === 'session' || spin === 'library') return translate(locale, 'team.transfer.reasonLibraryFile');
  if (spin === 'backup' || spin === 'prefs') return translate(locale, 'team.transfer.reasonBackupFile');
  return translate(locale, 'team.transfer.reasonUnsupportedFormat');
}

/** [팀] 툴바 [가져오기]. 팀 파일 하나를 읽어 저장하고 세 숫자로 보고한다.
 *
 *  충돌은 **묻지 않고 기본값('copy')으로 간다** — 파일 하나에 팀 하나뿐이라 3택 다이얼로그가
 *  물을 것이 «덮을까 말까» 하나이고, 그 하나를 잘못 누르면 몇 달치 명단이 사라진다. 사본은
 *  목록에 나란히 보이므로 사용자가 눈으로 보고 지울 수 있다(되돌릴 수 있는 쪽이 기본값).
 *  같은 파일을 두 번 넣으면 'identical' 로 걸려 사본이 생기지 않는다(멱등). */
export async function importTeamFile(file: File, locale: Locale = 'ko'): Promise<ImportReport> {
  const parsed = parseSpinFile(await readTextFile(file));
  if (parsed.spin !== 'team') {
    throw new StorageError('E_UNSUPPORTED_KIND', reasonForElsewhere(parsed.spin, locale), { localized: true, detail: parsed.spin });
  }
  const candidates = await prepareTeamImport(parsed);
  const outcome = await commitTeamImports(
    candidates.map((candidate) => ({
      candidate,
      resolution: (candidate.conflict === 'identical' ? 'skip' : 'copy') satisfies ImportResolution,
    })),
    { copyName: (name) => translate(locale, 'team.transfer.copyName', { name }) },
  );
  // ⚠️ broken 을 따로 세지 않고 산식으로 구한다(library/transfer.ts `buildImportReport` 와 같은
  //    규율): 후보가 된 것은 전부 written/skipped/failed 중 하나로 끝나므로, 파일에 있던 수에서
  //    그 셋을 빼면 남는 것이 «후보조차 못 된 손상 항목» 이다. 팀 파일은 팀 하나짜리라 이 값이
  //    0 또는 1 이지만, 그 1 이 곧 "아무 일도 안 일어난 것처럼 보이는" 실패다.
  const broken = 1 - (outcome.written.length + outcome.skipped.length + outcome.failed.length);
  return {
    imported: outcome.written.length,
    failed: broken + outcome.failed.length,
    skipped: outcome.skipped.length,
  };
}
