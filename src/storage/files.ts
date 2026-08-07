// §4.7 파일 I/O 저수준 유틸 — 파일명 생성·읽기·다운로드. 봉투·가져오기 비즈니스 로직은 transfer.ts.
import type { Drill } from '../model/drill.ts';

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

/** .spin.json 이중 확장자 — 여전히 JSON 으로 열리고, 목록에서 SPIN 파일임이 보이며,
 *  <input accept=".json,application/json"> 에 그대로 걸린다. 예: SPIN_측면-돌파-후-크로스_20260807.spin.json */
export function drillFileName(d: Drill): string {
  return `SPIN_${slugify(d.title)}_${ymdLocal(Date.now())}.spin.json`;
}

export function readTextFile(f: File): Promise<string> {
  return f.text();
}

/** File System Access API 는 쓰지 않는다 — 앵커 다운로드로 충분하다. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
