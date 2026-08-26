// §6.4 내보내기 파일 이름 조립. **컴포넌트 파일에서 분리한 이유는 린트다** — .tsx 가 컴포넌트
// 아닌 것을 함께 export 하면 react(only-export-components) 경고가 뜨고(Fast Refresh 가 깨진다),
// 이 저장소는 경고 수를 게이트로 쓴다.
//
// 4.1 이 "파일 이름은 여기서 만들지 않았다(files.ts 는 4.3 소유). 4.7 이 조립해 downloadBlob 에
// 넘겨라" 고 남긴 자리가 여기다.
import { slugify, ymdLocal, SPIN_EXT } from '../../storage/files.ts';

/** 기기 이사 파일. 확장자 규약은 files.ts 의 `SPIN_EXT` 를 그대로 따른다.
 *
 *  ⚠️ 이름 세그먼트를 `백업` 에서 `backup` 으로 바꿨다(2026-08-26) — 드릴·세션 파일명이
 *  이미 언어 중립인데(i18n C4: "파일명 세그먼트는 번역하지 않는다") 백업만 한국어라
 *  같은 폴더에서 셋이 다른 규칙으로 보였다. 옛 이름 파일은 그대로 열린다(판별은 파일명이
 *  아니라 봉투 안 `spin` 필드다). */
export function backupFileName(nowMs: number): string {
  return `SPIN_backup_${ymdLocal(nowMs)}${SPIN_EXT.backup}`;
}

/** 여러 장을 한 벌로 받을 때(2026-08-27). 낱개 순차 다운로드 대신 ZIP 을 쓰는 이유는
 *  `storage/zip.ts` 머리말과 ExportSheet 의 분기 주석에 있다 — 요지는 호환성이다.
 *  안에 들어가는 낱장 이름은 `sceneFileName` 그대로라 풀면 번호가 붙은 PNG 들이 나온다. */
export function sceneZipName(title: string): string {
  return `SPIN_${slugify(title)}_${ymdLocal(Date.now())}.png.zip`;
}

/** 한 장면 그림. 스텝 번호는 **1-based** — 캡션에 찍히는 'n/N'(staticSceneLayout.captionSubText)
 *  과 같은 숫자여야 코치가 파일과 그림을 짝지을 수 있다.
 *
 *  ⚠️ **두 자리로 채운다**(2026-08-27 기현 지시). 여러 장을 한 번에 뽑을 수 있게 되면서
 *  드러난 문제다: 패딩이 없으면 파일 탐색기가 문자열로 정렬해 `1, 10, 11, 2, …` 로 흩어진다.
 *  스텝 상한이 60(`LIMITS.maxSteps`)이라 두 자리면 전부 덮지만, `padStart` 라 혹시 상한이
 *  올라가도 세 자리로 자연히 늘어난다(잘리지 않는다).
 *
 *  캡션의 'n/N' 과는 여전히 짝이 맞는다 — 앞의 0 은 읽는 사람이 같은 숫자로 읽는다. */
export function sceneFileName(title: string, stepIndex: number): string {
  return `SPIN_${slugify(title)}_${String(stepIndex + 1).padStart(2, '0')}.png`;
}
