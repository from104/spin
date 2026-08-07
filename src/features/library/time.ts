// 세션 드로어의 <input type="datetime-local"> 값 ↔ epoch ms 왕복. 로케일 포맷팅에 기대지 않고
// (§6.11/§3.12 의 formatSessionWhen 과 같은 원칙) 로컬 캘린더 필드를 직접 문자열로 조립·해석한다.
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${hh}:${mm}`;
}

/** 빈 문자열·잘못된 값이면 undefined. */
export function fromLocalInputValue(v: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return undefined;
  const [, y, mo, day, hh, mm] = m;
  const d = new Date(Number(y), Number(mo) - 1, Number(day), Number(hh), Number(mm));
  return Number.isFinite(d.getTime()) ? d.getTime() : undefined;
}
