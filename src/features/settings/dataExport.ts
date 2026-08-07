// §4.7 데이터 내보내기 — 전체 드릴을 하나의 library 봉투로 묶어 다운로드한다.
// 작업지시: "설정 내보내기(prefs)는 1차 범위가 아니다 — 만들지 마라." 이 파일은 드릴만 다룬다.
// storage/transfer.ts 의 exportLibraryFile·downloadBlob 을 조합만 한다(§8 "screen-home-library
// 의 features/library/transfer.ts 와 같은 오케스트레이션 역할이지만, 파일 소유권이 갈려 있어
// 그 파일을 import 하지 않고 이 모듈 안에 독립적으로 다시 둔다).
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { exportLibraryFile } from '../../storage/transfer.ts';
import { downloadBlob, ymdLocal } from '../../storage/files.ts';
import type { DrillId } from '../../core/ids.ts';

/** ids 순서대로 조회한다. 조회 시점 사이 삭제된 드릴(동시 편집)은 조용히 건너뛴다.
 *  반환값은 실제로 내보낸 드릴 수 — 0 이면 파일을 만들지 않는다(호출부가 안내 메시지를 낸다). */
export async function exportAllDrillsToFile(ids: readonly DrillId[]): Promise<number> {
  const { repo } = await resolveDrillRepo();
  const map = await repo.getDrills(ids as DrillId[]);
  const drills = ids.map((id) => map.get(id)).filter((d): d is NonNullable<typeof d> => d !== undefined);
  if (drills.length === 0) return 0;
  downloadBlob(exportLibraryFile(drills), `SPIN_전체_${ymdLocal(Date.now())}.spin.json`);
  return drills.length;
}
