// §6.4 내보내기 파일 이름 조립. **컴포넌트 파일에서 분리한 이유는 린트다** — .tsx 가 컴포넌트
// 아닌 것을 함께 export 하면 react(only-export-components) 경고가 뜨고(Fast Refresh 가 깨진다),
// 이 저장소는 경고 수를 게이트로 쓴다.
//
// 4.1 이 "파일 이름은 여기서 만들지 않았다(files.ts 는 4.3 소유). 4.7 이 조립해 downloadBlob 에
// 넘겨라" 고 남긴 자리가 여기다.
import { slugify, ymdLocal } from '../../storage/files.ts';

/** 기기 이사 파일. `.spin.json` 이중 확장자는 files.ts 의 규약을 그대로 따른다 — 여전히 JSON
 *  으로 열리고, 목록에서 SPIN 파일임이 보이며, `accept=".json"` 에 그대로 걸린다. */
export function backupFileName(nowMs: number): string {
  return `SPIN_백업_${ymdLocal(nowMs)}.spin.json`;
}

/** 한 장면 그림. 스텝 번호는 **1-based** — 캡션에 찍히는 'n/N'(staticSceneLayout.captionSubText)
 *  과 같은 숫자여야 코치가 파일과 그림을 짝지을 수 있다. */
export function sceneFileName(title: string, stepIndex: number): string {
  return `SPIN_${slugify(title)}_${stepIndex + 1}.png`;
}
