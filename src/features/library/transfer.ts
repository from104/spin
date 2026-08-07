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
  exportLibraryFile,
  type SpinFile,
  type ImportCandidate,
  type ImportResolution,
  type ImportOutcome,
} from '../../storage/transfer.ts';
import { drillFileName, slugify, ymdLocal, readTextFile, downloadBlob } from '../../storage/files.ts';
import type { Drill } from '../../model/drill.ts';
import type { TrainingSession } from '../../model/session.ts';
import type { DrillId } from '../../core/ids.ts';

export async function exportOneDrill(id: DrillId): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const d = await repo.getDrill(id);
  if (!d) throw new Error('드릴을 찾을 수 없습니다');
  downloadBlob(exportDrillFile(d), drillFileName(d));
}

export async function exportAllDrills(ids: DrillId[]): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const map = await repo.getDrills(ids);
  const drills = ids.map((id) => map.get(id)).filter((d): d is Drill => d !== undefined);
  downloadBlob(exportLibraryFile(drills), `SPIN_전체_${ymdLocal(Date.now())}.spin.json`);
}

export async function exportOneSession(session: TrainingSession): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const map = await repo.getDrills(session.drillIds);
  const drills = session.drillIds.map((id) => map.get(id)).filter((d): d is Drill => d !== undefined);
  downloadBlob(exportSessionFile(session, drills), `SPIN_세션_${slugify(session.title)}_${ymdLocal(Date.now())}.spin.json`);
}

/** 가져오기 1단계: 파일을 읽고 파싱해 후보 목록을 만든다. UI 는 이 결과로 conflict:'exists' 만
 *  사용자에게 물으면 된다. */
export type ImportPreview =
  | { kind: 'drills'; file: SpinFile; drills: ImportCandidate<Drill>[] }
  | { kind: 'session'; file: SpinFile; drills: ImportCandidate<Drill>[]; session: ImportCandidate<TrainingSession> }
  | { kind: 'unsupported'; reason: string };

export async function readImportFile(file: File): Promise<ImportPreview> {
  const text = await readTextFile(file);
  const parsed = parseSpinFile(text);
  if (parsed.spin === 'drill' || parsed.spin === 'library') {
    return { kind: 'drills', file: parsed, drills: await prepareDrillImport(parsed) };
  }
  if (parsed.spin === 'session') {
    const { drills, session } = await prepareSessionImport(parsed);
    return { kind: 'session', file: parsed, drills, session };
  }
  if (parsed.spin === 'prefs') return { kind: 'unsupported', reason: '설정 파일은 설정 화면에서 가져오세요.' };
  return { kind: 'unsupported', reason: '지원하지 않는 파일 형식입니다.' };
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
