// §4.7 파일 I/O 저수준 유틸 — 파일명 생성·읽기·다운로드. 봉투·가져오기 비즈니스 로직은 transfer.ts.
import type { Drill } from '../model/drill.ts';
import type { SpinFileKind } from './transfer.ts';

const FORBIDDEN_CHARS = /[\x00-\x1f<>:"/\\|?*]/g;

/** NFC 정규화 → 금지문자를 '-' 로 → 연속 '-' 축약 → 앞뒤 '-' 제거 → 코드포인트 단위로 자른다
 *  (서로게이트 페어 보호). 빈 문자열이면 'drill'. 한글은 그대로 유지된다. */
export function slugify(title: string, max = 40): string {
  const cleaned = title
    .normalize('NFC')
    .replace(FORBIDDEN_CHARS, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safe = cleaned.length > 0 ? cleaned : 'drill';
  return [...safe].slice(0, max).join('');
}

export function ymdLocal(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** 봉투 종류별 삼중 확장자 `.spin.<종류>.json` (2026-08-26 기현 지시).
 *
 *  전에는 전 종류가 `.spin.json` 하나였다 — 여전히 JSON 으로 열리고 SPIN 파일임도 보였지만,
 *  **어느 화면에 넣어야 하는 파일인지가 이름에 없었다.** 실제로 드릴 파일을 설정 화면의 기기
 *  이사 복원에 넣는 사고가 났고(파일은 멀쩡했다), 두 화면의 `accept` 가 똑같아서 파일 선택창이
 *  걸러 주지도 못했다. 종류를 이름에 실으면 목록에서 눈으로 갈리고 `accept` 로 좁힐 수도 있다.
 *
 *  ⚠️ **판별은 여전히 봉투 안 `spin` 필드가 한다** — 파일명은 사람이 읽는 표지일 뿐이다.
 *  그래서 2026-08-26 이전에 뽑은 `.spin.json` 파일도 이름 그대로 계속 열린다(가져오기 경로는
 *  파일명을 보지 않는다). 이름만 바꾼 파일이 통과하는 것도 같은 이유로 정상이다. */
export const SPIN_EXT: Record<SpinFileKind, string> = {
  drill: '.spin.drill.json',
  session: '.spin.session.json',
  library: '.spin.library.json',
  backup: '.spin.backup.json',
  prefs: '.spin.prefs.json',
  drillSet: '.spin.drillset.json',
  team: '.spin.team.json',
};

/** 화면별 파일 선택 필터. 옛 `.spin.json` 과 맨 `.json` 을 **남긴다** — 필터는 힌트이지 검증이
 *  아니고(사용자는 언제나 '모든 파일' 을 고를 수 있다), 예전에 뽑아 둔 파일이 목록에서 사라지면
 *  그게 더 나쁘다. 진짜 방어는 봉투를 읽고 갈 곳을 알려주는 안내 쪽이다. */
export const ACCEPT_LIBRARY = `${SPIN_EXT.drill},${SPIN_EXT.session},${SPIN_EXT.library},.spin.json,.json,application/json`;
export const ACCEPT_BACKUP = `${SPIN_EXT.backup},.spin.json,.json,application/json`;
/** [팀] 툴바 [가져오기]. 옛 `.spin.json` 을 같이 남기는 것은 위 규율 그대로 — 필터는 힌트다.
 *  ⚠️ 여기에 `.spin.backup.json` 을 넣지 않는다: 기기 이사 파일을 팀 화면에서 열어도 팀만
 *  들어오지 않고 통째 복원이 돌아야 하는데, 그 결정(설정 복원·전술판 정책)은 설정 화면 몫이다.
 *  잘못 들어오면 문구가 갈 곳을 말해 준다(`features/team/transfer.ts`). */
export const ACCEPT_TEAM = `${SPIN_EXT.team},.spin.json,.json,application/json`;

/** 예: SPIN_측면-돌파-후-크로스_20260807.spin.drill.json */
export function drillFileName(d: Drill): string {
  return `SPIN_${slugify(d.title)}_${ymdLocal(Date.now())}${SPIN_EXT.drill}`;
}

export function readTextFile(f: File): Promise<string> {
  return f.text();
}

/** revoke 유예 (4.3). setTimeout(0) 도 "같은 틱 아님"은 만족하지만 실제 다운로드를 못 견딘다 —
 *  브라우저는 blob: URL 을 a.click() 시점이 아니라 **다운로드 fetch 시작 시점**에 역참조하는데,
 *  데스크톱 Chrome/Firefox 의 "저장 위치 묻기"가 켜져 있으면 그 fetch 는 사용자가 대화상자를
 *  닫을 때까지 몇십 초든 미뤄진다. 0ms 면 그 사이 URL 이 죽어 0 바이트 파일이 남는다.
 *  40초는 FileSaver.js 가 같은 자리에서 쓰는 선례 값(4E4)이다 — blob 메모리를 영원히 잡아 두지
 *  않는 상한이면서, 저장 대화상자를 열어 두는 통상 시간을 덮는다. 실기 대조는 FIELD-TEST E-9. */
export const REVOKE_DELAY_MS = 40_000;

/** DOMException 은 구현에 따라 Error 를 상속하지 않는다 — instanceof 대신 name 으로 가른다. */
function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/** 앵커 다운로드 폴백. File System Access API 는 쓰지 않는다 — 앵커로 충분하다. */
function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ⚠️ 같은 틱 revoke 로 되돌리면 안 된다 (§6.1d): 다운로드 fetch 가 시작되기 전에 대상이
  // 사라져 Safari 계열에서 0 바이트 파일이 조용히 저장된다. 유예값 근거는 REVOKE_DELAY_MS 주석.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** 내보내기 출구 (4.3). iPad Safari(특히 standalone)에서는 a[download] 가 사실상 동작하지
 *  않으므로, 파일 공유가 가능하면(canShare) iOS 공유 시트로 보내고 아니면 앵커 다운로드다.
 *
 *  ⚠️ 호출 순서가 계약이다: navigator.share 는 사용자 제스처(transient activation) 안에서만
 *  허용된다. canShare 는 동기 함수라 제스처를 소모하지 않지만, share 호출 **앞에** await 를
 *  한 번이라도 끼우면 제스처가 만료돼 iOS 에서 NotAllowedError 로 조용히 실패한다.
 *  그래서 이 함수는 async 가 아니고, share 를 클릭 핸들러와 같은 틱에서 동기 호출한다.
 *
 *  ⚠️ share 의 거부 중 AbortError 는 "사용자가 공유 시트를 취소"다 — 실패로 취급해 앵커
 *  폴백으로 흘리면 **취소했는데 다운로드가 시작된다**. 그 외 거부(NotAllowedError 등)만
 *  폴백한다. 폴백은 제스처 밖(마이크로태스크)에서 돌지만, a[download] 클릭은 제스처를
 *  요구하지 않으므로 최선의 차선이다. */
export function downloadBlob(blob: Blob, filename: string): void {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch((err: unknown) => {
      if (isAbortError(err)) return; // 사용자 취소 — 아무것도 하지 않는다
      anchorDownload(blob, filename);
    });
    return;
  }
  anchorDownload(blob, filename);
}
